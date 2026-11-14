import { DurableObject } from "cloudflare:workers";
import { GameEvent } from "@core/types/GameEvent";
import { GameStatus } from "@core/enums/GameStatus";
import { PieceType } from "@core/enums/PieceType";
import { PlayerClass } from "@core/enums/PlayerClass";
import { SkillType } from "@core/enums/SkillType";
import { JoinResult } from "@core/types/JoinResult";
import { ChatMsg } from "@core/types/ChatMsg";
import { JoinedGameMsg } from "@core/types/messages";
import { DiceRoll } from "@core/types/DiceRoll";
import { DiceRollResult } from "@core/types/DiceRollResult";
import { auctionTimeLimit, turnTimeLimit } from "@core/constants";
import { Env, isDevEnv } from "../env";
import { UsersRepo } from "../db/users";
import { GamesIndexRepo } from "../db/gamesIndex";
import { HistoryRepo } from "../db/history";
import { summariseGame } from "./history";
import { GameContext } from "./GameContext";
import { DurableObjectGameStore } from "./DurableObjectGameStore";
import {
  AuctionDocument,
  GameInstanceDocument,
  LottoDocument,
  TradeDocument,
} from "./model";
import { CreateGameParams, GameProcessor } from "./controllers/GameProcessor";
import { RollProcessor } from "./controllers/RollProcessor";
import { AuctionProcessor } from "./controllers/AuctionProcessor";
import { LottoProcessor } from "./controllers/LottoProcessor";
import { PropertyProcessor } from "./controllers/PropertyProcessor";
import { TradeProcessor } from "./controllers/TradeProcessor";
import { PlayerProcessor } from "./controllers/PlayerProcessor";
import { AutoMoveProcessor } from "./controllers/AutoMoveProcessor";
import { BotLevel } from "@core/enums/BotLevel";
import { PlayerState } from "@core/enums/PlayerState";
import { areIdsEqual } from "./controllers/helpers";
import { BotPlayer, isBotId } from "./bots/BotPlayer";
import { movementDurationMs } from "@core/movementTiming";
import { FINAL_SNAPSHOT_KEY, SNAPSHOT_PREFIX, TurnSnapshot, unpackSnapshot } from "./snapshots";
import { emptyRoomUsage, meterD1, meterStorage, RoomUsage } from "../dev/usage";

/** development only: where the usage meters are kept (not metered itself) */
const USAGE_KEY = "__devUsage";

/** Result of a game action: errMsg is "" on success. */
export interface ActionResult {
  errMsg: string;
  data?: Record<string, unknown>;
}

interface WsAttachment {
  userId: string;
  playerName: string;
  /** connected to watch a game in progress, not to play (see isWatchable) */
  watcher?: boolean;
}

/** Work the object has scheduled for itself through its alarm. */
type Job = { attempts?: number } & (
  | { kind: "event"; at: number; event: GameEvent; payload: unknown }
  | { kind: "raw"; at: number; event: GameEvent; args: unknown[] }
  | { kind: "refresh"; at: number }
  | { kind: "botStep"; at: number; botId: string }
  | { kind: "botBids"; at: number }
  | { kind: "botTrade"; at: number; tradeId: string }
  | { kind: "purge"; at: number }
  | { kind: "expireLobby"; at: number }
);

/** A lobby that hasn't filled up after this long is deleted. */
const LOBBY_LIFETIME_SECONDS = 24 * 60 * 60;
/** close code for "this lobby expired" (the client stops reconnecting) */
export const WS_CLOSE_LOBBY_EXPIRED = 4004;

const MAX_JOB_ATTEMPTS = 3;

/** Stored entries written before job kinds existed. */
interface LegacyPendingEvent {
  at: number;
  event: GameEvent;
  payload: unknown;
}

const MAX_BOT_STEPS_PER_TURN = 60;
/** a bots-only simulation that has not ended by then is scored by assets */
const MAX_SIMULATION_TURNS = 400;
/**
 * A finished game, its snapshots, auctions and trades are deleted this long
 * after it ends, so storage does not grow forever on the free plan.
 */
const PURGE_FINISHED_AFTER_SECONDS = 30 * 24 * 60 * 60;

interface IndexState {
  status: GameStatus;
  playersJoined: number;
  /** when the lobby index last heard of a move in this game (ms) */
  touchedAt?: number;
}

/**
 * How often a game in progress tells the lobby index it is still being
 * played, so the watch list can leave out abandoned games. One D1 write per
 * interval of play at most.
 */
const ACTIVITY_TOUCH_SECONDS = 5 * 60;

const devSeconds = (env: Env, value: string | undefined, fallback: number): number => {
  if (!isDevEnv(env) || !value) {
    return fallback;
  }
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const devMillis = (env: Env, value: string | undefined, fallback: number): number => {
  if (!isDevEnv(env) || !value) {
    return fallback;
  }
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Base delay between computer player actions (ms). Everything a bot does is a
 * multiple of it, so humans can follow along; DEV_BOT_PACE_MS overrides it in
 * development (the API tests run bots at 30ms).
 */
const DEFAULT_BOT_PACE_MS = 1600;

const PENDING_EVENTS_KEY = "pendingEvents";
const INDEX_STATE_KEY = "indexState";
/** set once the finished game is in the D1 history */
const HISTORY_RECORDED_KEY = "historyRecorded";
const MAX_CHAT_LENGTH = 200;
/** chat kept on the game document; older messages are dropped */
const MAX_STORED_CHAT = 100;
/** sockets one user may hold open to one game (tabs, reconnects) */
const MAX_SOCKETS_PER_USER = 4;
/** incoming WebSocket messages larger than this are ignored */
const MAX_WS_MESSAGE_BYTES = 4096;
/** per socket: messages allowed per window, chat messages per window */
const WS_WINDOW_MS = 10_000;
const WS_MAX_MESSAGES = 40;
const WS_MAX_CHAT = 6;
/** close sockets that keep sending far past the limit */
const WS_ABUSE_FACTOR = 3;
/** close code for "you are not a player in this game" (the client stops reconnecting) */
export const WS_CLOSE_NOT_A_PLAYER = 4003;
const WS_CLOSE_TOO_MANY = 4008;
/** WebSocket tag shared by every spectator's sockets */
const WATCH_TAG = "watch";
/** spectators one game takes; each one is another socket every event goes to */
const MAX_WATCHERS = 50;
const WS_CLOSE_ABUSE = 4029;

/** Counts one socket's messages in the current window (kept in memory only). */
interface SocketBudget {
  windowStart: number;
  messages: number;
  chat: number;
}

/** Replace the game password hash before a game leaves the server. */
export const toClientGame = (
  game: GameInstanceDocument | null
): GameInstanceDocument | null => {
  if (!game) {
    return null;
  }
  // the generator's key and state would let a player predict the dice; the
  // seed (seeded games only) is shown once the game is over, for replays
  const { rngState: _rngState, rngKey: _rngKey, seed, ...rest } = game;
  return {
    ...rest,
    seed: game.status === GameStatus.FINISHED ? seed : undefined,
    settings: {
      ...game.settings,
      password: game.settings.password ? "protected" : null,
    },
  };
};

/** WebSocket tag that groups one user's sockets. */
const userTag = (userId: string): string => "u:" + userId;

const escapeTags = (s: string): string =>
  s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ok = (data?: Record<string, unknown>): ActionResult => ({ errMsg: "", data });
const fail = (errMsg: string): ActionResult => ({ errMsg });

/** RPC results must be plain data: strip the DiceRoll class instance. */
const toDiceResult = (roll: DiceRoll | undefined): DiceRollResult | null =>
  roll ? { die1: roll.die1, die2: roll.die2 } : null;

/**
 * One Durable Object per game. It owns the game state, its auctions, lottos
 * and trades, and the WebSocket connections of the players in the game.
 * This replaces both the MongoDB "games" collection and the socket.io room.
 */
export class GameRoom extends DurableObject<Env> {
  private readonly store: DurableObjectGameStore;
  private readonly gamesIndex: GamesIndexRepo;
  private readonly history: HistoryRepo;
  private readonly gameCtx: GameContext;
  private readonly purgeAfterMs: number;
  private readonly activityTouchMs: number;
  /** ctx.storage, metered in development (see dev/usage.ts) */
  private readonly storage: DurableObjectStorage;
  /** development only: what this object has cost so far */
  private usage: RoomUsage | null = null;
  private usagePersist: Promise<void> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const dev = isDevEnv(env);
    this.storage = dev ? meterStorage(ctx.storage, () => this.devUsage()) : ctx.storage;
    const db = dev ? meterD1(env.DB, () => this.devUsage().d1) : env.DB;
    if (dev) {
      ctx.blockConcurrencyWhile(async () => {
        this.usage = (await ctx.storage.get<RoomUsage>(USAGE_KEY)) ?? emptyRoomUsage();
      });
    }
    this.store = new DurableObjectGameStore(this.storage, new UsersRepo(db));
    this.gamesIndex = new GamesIndexRepo(db);
    this.history = new HistoryRepo(db);
    this.purgeAfterMs = devSeconds(env, env.DEV_PURGE_SECONDS, PURGE_FINISHED_AFTER_SECONDS) * 1000;
    this.activityTouchMs = devSeconds(env, env.DEV_ACTIVITY_TOUCH_SECONDS, ACTIVITY_TOUCH_SECONDS) * 1000;
    this.gameCtx = {
      store: this.store,
      isDev: isDevEnv(env),
      devPreownProperties: isDevEnv(env) && env.DEV_PREOWN_PROPERTIES === "true",
      // development may shorten the timers so timeout flows can be tested
      turnTimeLimit: devSeconds(env, env.DEV_TURN_SECONDS, turnTimeLimit),
      auctionTimeLimit: devSeconds(env, env.DEV_AUCTION_SECONDS, auctionTimeLimit),
      botPaceMs: devMillis(env, env.DEV_BOT_PACE_MS, DEFAULT_BOT_PACE_MS),
      events: {
        send: (event, payload) => this.broadcastServerEvent(event, payload),
        sendDelayed: (delayMs, event, payload) =>
          this.scheduleJob({ kind: "event", at: Date.now() + delayMs, event, payload }),
        refreshGameState: async () => {
          const game = toClientGame(await this.store.getGame());
          this.broadcastAll(GameEvent.UPDATE_GAME_STATE, game);
        },
        broadcast: (event, ...args) => this.broadcastAll(event, ...args),
        broadcastDelayed: (delayMs, event, args) =>
          this.scheduleJob({ kind: "raw", at: Date.now() + delayMs, event, args }),
        onTradeOffered: async (tradeId) => {
          const game = await this.store.getGame();
          const trade = await this.store.getTrade(tradeId);
          if (game && trade && isBotId(game, trade.participant2.playerId)) {
            await this.scheduleJob({ kind: "botTrade", at: Date.now() + this.pace(1.5), tradeId });
          }
        },
      },
    };
  }

  /**
   * The last human roll or trip, kept until the roller's client asks for it
   * to be shown to everyone (STOP_ANIMATE_DICE).
   */
  private lastMove: { playerId: string; diceRoll: DiceRollResult | null; frames: number[] } | null = null;

  /** bot steps taken since the turn last changed hands, per bot */
  private botSteps = new Map<string, number>();
  /** per bot: when its piece will have landed and it may act again (ms) */
  private botBusyUntil = new Map<string, number>();
  private lastTurnPlayer: string | null = null;

  private pace(factor: number): number {
    return Math.round(this.gameCtx.botPaceMs * factor);
  }

  /**
   * A real-time duration (like a piece animation) at the current bot pace:
   * unchanged at the normal pace, shrunk when DEV_BOT_PACE_MS speeds bots up
   * for tests.
   */
  private scaledToPace(ms: number): number {
    return Math.round((ms * this.gameCtx.botPaceMs) / DEFAULT_BOT_PACE_MS);
  }

  // ---------------------------------------------------------------------
  // RPC methods called by the Worker
  // ---------------------------------------------------------------------

  async createGame(
    params: CreateGameParams,
    numBots: number = 0,
    botLevel: BotLevel = BotLevel.Normal,
    botLevels?: BotLevel[]
  ): Promise<string> {
    return this.run(async () => {
      const existing = await this.store.getGame();
      if (existing) {
        throw new Error("game already exists");
      }
      let game = await GameProcessor.createGame(this.gameCtx, params);
      const seatsForBots = params.botsOnly ? params.maxPlayers : params.maxPlayers - 1;
      for (let i = 0; i < numBots && i < seatsForBots; i++) {
        await GameProcessor.addBot(this.gameCtx, botLevels ? botLevels[i % botLevels.length] : botLevel);
      }
      await this.afterAction();
      game = (await this.store.getGame()) ?? game;
      await this.gamesIndex.upsert({
        id: game._id,
        name: game.name,
        status: game.status,
        maxPlayers: game.settings.maxPlayers,
        playersJoined: game.players.length,
        hasPassword: !!game.settings.password,
        bots: game.players.filter((p) => p.isBot).length,
        createdBy: game.createdBy,
        createdAt: game.createdAt,
      });
      await this.storage.put<IndexState>(INDEX_STATE_KEY, {
        status: game.status,
        playersJoined: game.players.length,
        touchedAt: Date.now(),
      });
      if (game.status === GameStatus.JOINING) {
        // lobbies nobody fills would otherwise stay in storage forever
        const lifetimeMs = devSeconds(this.env, this.env.DEV_LOBBY_SECONDS, LOBBY_LIFETIME_SECONDS) * 1000;
        await this.scheduleJob({ kind: "expireLobby", at: Date.now() + lifetimeMs });
      }
      return game._id;
    });
  }

  async getGame(): Promise<GameInstanceDocument | null> {
    return toClientGame(await this.store.getGame());
  }

  /** The game's per-turn snapshots, oldest first, the final one last. */
  async getSnapshots(): Promise<TurnSnapshot[]> {
    const game = await this.store.getGame();
    if (!game) {
      return [];
    }
    const stored = await this.storage.list<string>({ prefix: SNAPSHOT_PREFIX });
    return Array.from(stored, ([key, raw]) => unpackSnapshot(game, raw, key === FINAL_SNAPSHOT_KEY));
  }

  /**
   * What a user may see: a game's players see everything; anyone may look
   * at a lobby (to decide whether to join) or watch a live public game;
   * nobody else sees the game.
   */
  private canView(game: GameInstanceDocument, userId: string): boolean {
    return (
      game.status === GameStatus.JOINING ||
      this.isWatchable(game) ||
      // bots-only simulations (development only) have no players to restrict to
      !!game.settings.botsOnly ||
      game.players.some((p) => areIdsEqual(p._id, userId))
    );
  }

  /**
   * Signed-in users may watch a game while it is being played, unless it has
   * a password. Finished games are not replayed to anyone but their players.
   */
  private isWatchable(game: GameInstanceDocument | null): boolean {
    return !!game && game.status === GameStatus.ACTIVE && !game.settings.password;
  }

  /**
   * Whether a spectator's socket may stay open: while the game is watchable,
   * and once it finishes, so they see how it ended (no new spectators then).
   */
  private watcherMayStay(game: GameInstanceDocument | null): boolean {
    return !!game && !game.settings.password &&
      (game.status === GameStatus.ACTIVE || game.status === GameStatus.FINISHED);
  }

  private isPlayer(game: GameInstanceDocument | null, userId: string): boolean {
    return !!game && game.players.some((p) => areIdsEqual(p._id, userId));
  }

  /** The game as this user may see it; forbidden when they're not in it. */
  async getGameFor(userId: string): Promise<{ game: GameInstanceDocument | null; forbidden: boolean }> {
    const game = await this.store.getGame();
    if (game && !this.canView(game, userId)) {
      return { game: null, forbidden: true };
    }
    return { game: toClientGame(game), forbidden: false };
  }

  /** Snapshots for the game's players only. */
  async getSnapshotsFor(userId: string): Promise<{ snapshots: TurnSnapshot[]; forbidden: boolean }> {
    const game = await this.store.getGame();
    if (game && !game.settings.botsOnly && !this.isPlayer(game, userId)) {
      return { snapshots: [], forbidden: true };
    }
    return { snapshots: await this.getSnapshots(), forbidden: false };
  }

  async getStatus(): Promise<GameStatus | null> {
    const game = await this.store.getGame();
    return game ? game.status : null;
  }

  async isPlayerInGame(userId: string): Promise<boolean> {
    const game = await this.store.getGame();
    return !!game && game.players.some((p) => p._id === userId);
  }

  async getAuction(auctionId: string, userId: string): Promise<AuctionDocument | null> {
    const game = await this.store.getGame();
    // spectators get the same view as a player who isn't bidding: no amounts
    if (!this.isPlayer(game, userId) && !this.isWatchable(game)) {
      return null;
    }
    return AuctionProcessor.getAuction(this.gameCtx, auctionId, userId);
  }

  async getLotto(lottoId: string, userId: string): Promise<LottoDocument | null> {
    const game = await this.store.getGame();
    if (!this.isPlayer(game, userId) && !this.isWatchable(game)) {
      return null;
    }
    return LottoProcessor.getLotto(this.gameCtx, lottoId);
  }

  async joinGame(
    userId: string,
    piece: PieceType,
    playerClass: PlayerClass,
    gamePwd: string | null
  ): Promise<{ errMsg: string; result: JoinResult | null }> {
    return this.runAction(() =>
      GameProcessor.joinGame(this.gameCtx, userId, piece, playerClass, gamePwd)
    );
  }

  /** The game's creator adds a computer player to the lobby. */
  async addBot(userId: string, level: BotLevel): Promise<{ errMsg: string; result: JoinResult | null }> {
    return this.runAction(async () => {
      const game = await this.store.getGame();
      if (!game) {
        return { errMsg: "game not found", result: null };
      }
      if (!areIdsEqual(game.createdBy, userId)) {
        return { errMsg: "Only the game's creator can add computer players", result: null };
      }
      // the creator plays too: a bot may not take the last seat while they
      // haven't joined, or the game would start with only bots
      const creatorSeated = game.players.some((p) => areIdsEqual(p._id, userId));
      if (!creatorSeated && game.players.length >= game.settings.maxPlayers - 1) {
        return { errMsg: "The last seat is kept for you. Join the game first.", result: null };
      }
      const outcome = await GameProcessor.addBot(this.gameCtx, level);
      if (outcome.result) {
        const after = await this.store.getGame();
        const bot = after?.players.find((p) => p.name === outcome.result!.playerName);
        const msg: JoinedGameMsg = {
          playerName: outcome.result.playerName,
          userId: bot?._id ?? "",
          gameId: game._id,
          allJoined: outcome.result.allJoined,
        };
        this.broadcastAll(GameEvent.JOINED_GAME, msg);
      }
      return outcome;
    });
  }

  async leaveGame(userId: string): Promise<void> {
    await this.runAction(() => GameProcessor.leaveGame(this.gameCtx, userId));
  }

  async resignGame(userId: string): Promise<void> {
    await this.runAction(() => GameProcessor.resignGame(this.gameCtx, userId));
  }

  async roll(
    userId: string,
    forceDie1: number | null,
    forceDie2: number | null,
    forceChanceId: number | null = null
  ): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new RollProcessor(this.gameCtx, userId, forceDie1, forceDie2);
      processor.setForceChanceId(forceChanceId);
      const errMsg = await processor.roll(false, false);
      if (errMsg) {
        return fail(errMsg);
      }
      const frames = processor.getMovementKeyFrames();
      const needToAnimate =
        processor.getOrigPosition() !== processor.getNewPosition() &&
        frames &&
        frames.length > 0;
      this.lastMove = { playerId: userId, diceRoll: toDiceResult(processor.getLastDiceRoll()), frames: frames ?? [] };
      return ok({
        needToAnimate,
        playerId: userId,
        diceRoll: toDiceResult(processor.getLastDiceRoll()),
        frames,
      });
    });
  }

  async travel(userId: string, squareId: number): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new RollProcessor(this.gameCtx, userId, null, null);
      const errMsg = await processor.travel(squareId);
      if (errMsg) {
        return fail(errMsg);
      }
      this.lastMove = {
        playerId: userId,
        diceRoll: toDiceResult(processor.getLastDiceRoll()),
        frames: processor.getMovementKeyFrames() ?? [],
      };
      return ok({
        needToAnimate: true,
        playerId: userId,
        diceRoll: toDiceResult(processor.getLastDiceRoll()),
        frames: processor.getMovementKeyFrames(),
      });
    });
  }

  async chooseChance(userId: string, choice: string): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new RollProcessor(this.gameCtx, userId, null, null);
      const errMsg = await processor.chooseChanceOption(choice);
      if (errMsg) {
        return fail(errMsg);
      }
      const frames = processor.getMovementKeyFrames() ?? [];
      if (frames.length > 0) {
        this.lastMove = { playerId: userId, diceRoll: null, frames };
      }
      return ok({
        needToAnimate: frames.length > 0,
        playerId: userId,
        diceRoll: null,
        frames,
      });
    });
  }

  async completeTurn(userId: string): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new RollProcessor(this.gameCtx, userId, null, null);
      return this.toResult(await processor.completeMyTurn(false, false));
    });
  }

  async timesUp(): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new AutoMoveProcessor(this.gameCtx);
      const errMsg = await processor.autoMove();
      if (errMsg) {
        return fail(errMsg);
      }
      return ok({
        needToAnimate: false,
        playerId: processor.getPlayerId() ?? null,
        diceRoll: toDiceResult(processor.getLastDiceRoll()),
        frames: [],
      });
    });
  }

  async bid(userId: string, bidAmount: number): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new AuctionProcessor(this.gameCtx, bidAmount, userId);
      return this.toResult(await processor.placeBid());
    });
  }

  async pickLotto(userId: string, optNum: number): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new LottoProcessor(this.gameCtx, optNum, userId);
      return this.toResult(await processor.pickOption());
    });
  }

  async mortgage(userId: string, squareId: number): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new PropertyProcessor(this.gameCtx, squareId, userId);
      return this.toResult(await processor.mortgageProperty());
    });
  }

  async redeem(userId: string, squareId: number): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new PropertyProcessor(this.gameCtx, squareId, userId);
      return this.toResult(await processor.redeemProperty());
    });
  }

  async buildHouse(userId: string, squareId: number): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new PropertyProcessor(this.gameCtx, squareId, userId);
      return this.toResult(await processor.buildHouse());
    });
  }

  async sellHouse(userId: string, squareId: number): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new PropertyProcessor(this.gameCtx, squareId, userId);
      return this.toResult(await processor.sellHouse());
    });
  }

  async getOut(userId: string): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new RollProcessor(this.gameCtx, userId, null, null);
      return this.toResult(await processor.payToGetOut());
    });
  }

  async offerTrade(
    userId: string,
    tradingWithPlayerId: string,
    mines: number[],
    theirs: number[],
    myAmount: number,
    theirAmount: number
  ): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new TradeProcessor(
        this.gameCtx,
        userId,
        tradingWithPlayerId,
        mines,
        theirs,
        myAmount,
        theirAmount
      );
      const errMsg = await processor.offerTrade();
      if (errMsg) {
        return fail(errMsg);
      }
      const tradeId = processor.getNewTradeId();
      if (tradeId) {
        await this.gameCtx.events.onTradeOffered(tradeId);
      }
      return ok({ newTradeId: tradeId });
    });
  }

  async acceptTrade(userId: string, tradeId: string): Promise<ActionResult> {
    return this.runAction(async () => {
      const game = await this.store.getGame();
      if (!game) {
        return fail("Game not found");
      }
      return this.toResult(
        await TradeProcessor.acceptTrade(this.gameCtx, userId, tradeId, game._id)
      );
    });
  }

  async declineTrade(userId: string, tradeId: string): Promise<ActionResult> {
    return this.runAction(async () => {
      const game = await this.store.getGame();
      if (!game) {
        return fail("Game not found");
      }
      return this.toResult(
        await TradeProcessor.declineTrade(this.gameCtx, userId, tradeId, game._id)
      );
    });
  }

  async upgradeSkill(userId: string, skillType: SkillType): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new PlayerProcessor(this.gameCtx, userId);
      return this.toResult(await processor.upgradeSkill(skillType));
    });
  }

  // ---------------------------------------------------------------------
  // WebSockets (hibernation API)
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // Development-only usage meters (worker/test/usage.mjs)
  // ---------------------------------------------------------------------

  /** The meters, saved after every change so hibernation doesn't lose them. */
  private devUsage(): RoomUsage {
    this.usage ??= emptyRoomUsage();
    this.usagePersist ??= Promise.resolve().then(async () => {
      this.usagePersist = null;
      await this.ctx.storage.put(USAGE_KEY, this.usage);
    });
    return this.usage;
  }

  async getDevUsage(): Promise<RoomUsage | null> {
    return this.gameCtx.isDev ? (this.usage ?? (await this.ctx.storage.get<RoomUsage>(USAGE_KEY)) ?? null) : null;
  }

  async resetDevUsage(): Promise<void> {
    if (this.gameCtx.isDev) {
      this.usage = emptyRoomUsage();
      await this.ctx.storage.put(USAGE_KEY, this.usage);
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (this.gameCtx.isDev) {
      this.devUsage().wsConnects++;
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    // The Worker verified the session cookie and passes the identity along.
    const userId = request.headers.get("X-User-Id");
    const playerName = request.headers.get("X-User-Name") ?? "";
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Players, anyone looking at a lobby (the join page listens for "X has
    // joined" before its user has taken a seat; they are disconnected when
    // the game starts, see dropNonPlayers()), and spectators of a live public
    // game, who ask for it with ?watch=1 and may only listen.
    const game = await this.store.getGame();
    if (!game) {
      return new Response("Game not found", { status: 404 });
    }
    const isPlayer = game.players.some((p) => areIdsEqual(p._id, userId));
    const watching = !isPlayer && new URL(request.url).searchParams.get("watch") === "1";
    if (!isPlayer && game.status !== GameStatus.JOINING && !(watching && this.isWatchable(game))) {
      return new Response("Not a player in this game", { status: 403 });
    }
    if (watching && this.ctx.getWebSockets(userTag(userId)).length === 0 && this.watcherCount() >= MAX_WATCHERS) {
      return new Response("This game has as many spectators as it can take", { status: 429 });
    }

    // one user, a handful of sockets: close the oldest beyond the cap
    const tag = userTag(userId);
    const existing = this.ctx.getWebSockets(tag);
    for (let i = 0; i <= existing.length - MAX_SOCKETS_PER_USER; i++) {
      try {
        existing[i].close(WS_CLOSE_TOO_MANY, "too many connections");
      } catch (e) {
        // already closing
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server, watching ? [tag, WATCH_TAG] : [tag]);
    const attachment: WsAttachment = { userId, playerName, watcher: watching };
    server.serializeAttachment(attachment);
    if (watching) {
      this.broadcastWatcherCount();
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Per-socket message budgets; lost on hibernation, which only resets them. */
  private socketBudgets = new WeakMap<WebSocket, SocketBudget>();

  /** False when the socket is over its budget (the message is dropped). */
  private withinBudget(ws: WebSocket, isChat: boolean): boolean {
    const now = Date.now();
    let budget = this.socketBudgets.get(ws);
    if (!budget || now - budget.windowStart >= WS_WINDOW_MS) {
      budget = { windowStart: now, messages: 0, chat: 0 };
      this.socketBudgets.set(ws, budget);
    }
    budget.messages++;
    if (isChat) {
      budget.chat++;
    }
    if (budget.messages > WS_MAX_MESSAGES * WS_ABUSE_FACTOR) {
      try {
        ws.close(WS_CLOSE_ABUSE, "too many messages");
      } catch (e) {
        // already closing
      }
      return false;
    }
    if (budget.messages > WS_MAX_MESSAGES) {
      return false;
    }
    // the chat limit only holds back chat, not game messages
    return !isChat || budget.chat <= WS_MAX_CHAT;
  }

  /** Once a game has started, only its players and spectators may stay connected. */
  private async dropNonPlayers(game: GameInstanceDocument): Promise<void> {
    if (game.status === GameStatus.JOINING) {
      return;
    }
    const watchersWelcome = this.watcherMayStay(game);
    for (const socket of this.ctx.getWebSockets()) {
      const { userId, watcher } = this.attachmentOf(socket);
      if (watcher && watchersWelcome) {
        continue;
      }
      if (!game.players.some((p) => areIdsEqual(p._id, userId))) {
        try {
          socket.close(WS_CLOSE_NOT_A_PLAYER, "not a player in this game");
        } catch (e) {
          // already closing
        }
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.gameCtx.isDev) {
      this.devUsage().wsMessages++;
    }
    if (typeof message !== "string" || message.length > MAX_WS_MESSAGE_BYTES) {
      return;
    }

    let parsed: { event?: unknown; args?: unknown };
    try {
      parsed = JSON.parse(message);
    } catch (e) {
      return;
    }
    const event = parsed.event;
    const args = Array.isArray(parsed.args) ? parsed.args : [];
    if (typeof event !== "string") {
      return;
    }

    const me = this.attachmentOf(ws);

    if (!this.withinBudget(ws, event === GameEvent.SEND_CHAT_MSG)) {
      return;
    }

    // A lobby watcher who hasn't joined, or a spectator, may only ask for the
    // current state; everything else (chat, announcements, refresh requests)
    // is for players.
    const current = await this.store.getGame();
    const isPlayer = !!current && current.players.some((p) => areIdsEqual(p._id, me.userId));
    if (!isPlayer) {
      const spectating = me.watcher && this.watcherMayStay(current);
      if (!spectating && current && current.status !== GameStatus.JOINING) {
        // the game started after this socket connected
        await this.dropNonPlayers(current);
        return;
      }
      if (event !== GameEvent.JOIN_GAME_ROOM) {
        return;
      }
    }

    switch (event) {
      case GameEvent.JOINED_GAME: {
        // take the lobby state from the game itself rather than the client
        const game = await this.store.getGame();
        const msg: JoinedGameMsg = {
          playerName: me.playerName,
          userId: me.userId,
          gameId: game ? game._id : "",
          allJoined: !!game && game.allJoined,
        };
        this.broadcastOthers(ws, GameEvent.JOINED_GAME, msg);
        return;
      }

      case GameEvent.JOIN_GAME_ROOM: {
        // a (re)connecting player may have missed moves: send them the
        // current state straight away
        const game = toClientGame(await this.store.getGame());
        this.sendTo(ws, GameEvent.UPDATE_GAME_STATE, game);
        if (game && game.auctionId) {
          const auction = await this.store.getAuction(game.auctionId);
          this.sendTo(ws, GameEvent.AUCTION_UPDATE, AuctionProcessor.viewFor(auction, me.userId));
        }
        this.sendTo(ws, GameEvent.WATCHERS, this.watcherCount());
        if (isPlayer) {
          this.broadcastOthers(ws, GameEvent.SHOW_SNACK_MSG, me.playerName + " re-connected");
        }
        return;
      }

      case "devDropConnection": {
        // development only: close every socket of this user so the client's
        // reconnect path can be exercised (used by tests)
        if (this.gameCtx.isDev) {
          for (const socket of this.ctx.getWebSockets()) {
            if (this.attachmentOf(socket).userId === me.userId) {
              socket.close(4001, "dropped for test");
            }
          }
        }
        return;
      }

      case GameEvent.LEAVE_GAME: {
        const game = toClientGame(await this.store.getGame());
        this.broadcastOthers(ws, GameEvent.LEAVE_GAME, me.playerName + " has left", game);
        return;
      }

      case GameEvent.UPDATE_GAME_STATE: {
        const game = toClientGame(await this.store.getGame());
        this.broadcastAll(GameEvent.UPDATE_GAME_STATE, game);
        return;
      }

      case GameEvent.ROLL_DICE: {
        this.broadcastAll(GameEvent.ANIMATE_DICE);
        return;
      }

      case GameEvent.STOP_ANIMATE_DICE: {
        // The roller's client says "show the result now"; the result itself
        // is the one the server rolled, never what the client sent.
        const move = this.lastMove;
        if (move && areIdsEqual(move.playerId, me.userId)) {
          this.lastMove = null;
          this.broadcastAll(GameEvent.STOP_ANIMATE_DICE, move.playerId, move.diceRoll, move.frames);
        }
        return;
      }

      case GameEvent.AUCTION_BID: {
        const auctionId = args[1];
        await this.broadcastAuctionViews(typeof auctionId === "string" ? auctionId : null);
        return;
      }

      case GameEvent.SEND_TRADE_OFFER:
      case GameEvent.TRADE_OFFER_REVIEWED: {
        const tradeId = args[0];
        const trade: TradeDocument | null = await this.store.getTrade(
          typeof tradeId === "string" ? tradeId : null
        );
        if (trade) {
          this.broadcastAll(event, trade);
        }
        return;
      }

      case GameEvent.LOTTO_UPDATE: {
        const lottoId = args[1];
        const lotto = await this.store.getLotto(typeof lottoId === "string" ? lottoId : null);
        this.broadcastAll(GameEvent.LOTTO_UPDATE, lotto);
        return;
      }

      case GameEvent.SEND_CHAT_MSG: {
        const incoming = (args[1] ?? {}) as Partial<ChatMsg>;
        const cleaned = escapeTags(String(incoming.msg ?? "")).substring(0, MAX_CHAT_LENGTH);
        // the sender's name comes from the verified session, not the message
        const newMsg: ChatMsg = {
          msg: cleaned,
          player: me.playerName,
        };

        await this.run(async () => {
          const game = await this.store.getGame();
          if (game) {
            game.messages.push(newMsg);
            if (game.messages.length > MAX_STORED_CHAT) {
              game.messages.splice(0, game.messages.length - MAX_STORED_CHAT);
            }
            await this.store.saveGame(game);
          }
        });

        this.broadcastOthers(ws, GameEvent.NEW_CHAT_MSG, newMsg);
        return;
      }

      case GameEvent.SHOW_SNACK_MSG: {
        const text = args[1];
        if (typeof text === "string") {
          this.broadcastOthers(ws, GameEvent.SHOW_SNACK_MSG, escapeTags(text).substring(0, MAX_CHAT_LENGTH));
        }
        return;
      }

      default:
        return;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const me = this.attachmentOf(ws);
    if (me.watcher) {
      this.broadcastWatcherCount(ws);
    }
    const game = await this.store.getGame();
    if (game && game.players.some((p) => areIdsEqual(p._id, me.userId))) {
      this.broadcastOthers(
        ws,
        GameEvent.SHOW_SNACK_MSG,
        me.playerName + " disconnected: " + (reason || (wasClean ? "closed" : "connection lost"))
      );
    }
    try {
      ws.close(code, "closing");
    } catch (e) {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.log("websocket error", error);
  }

  // ---------------------------------------------------------------------
  // Scheduled work: delayed events and computer player moves, all driven by
  // the object's alarm (replaces setTimeout on the old server)
  // ---------------------------------------------------------------------

  private async loadJobs(): Promise<Job[]> {
    const stored = (await this.storage.get<Array<Job | LegacyPendingEvent>>(PENDING_EVENTS_KEY)) ?? [];
    return stored.map((j) => ("kind" in j ? j : { kind: "event", at: j.at, event: j.event, payload: j.payload }));
  }

  private async saveJobs(jobs: Job[]): Promise<void> {
    await this.storage.put(PENDING_EVENTS_KEY, jobs);
  }

  private async armAlarm(): Promise<void> {
    const jobs = await this.loadJobs();
    if (jobs.length === 0) {
      return;
    }
    const next = Math.min(...jobs.map((j) => j.at));
    const current = await this.storage.getAlarm();
    if (current == null || next < current) {
      await this.storage.setAlarm(next);
    }
  }

  private async scheduleJob(job: Job): Promise<void> {
    const jobs = await this.loadJobs();
    jobs.push(job);
    await this.saveJobs(jobs);
    await this.armAlarm();
  }

  /** Schedule unless an equivalent job is already waiting. */
  private async scheduleOnce(job: Job): Promise<void> {
    const jobs = await this.loadJobs();
    const duplicate = jobs.some(
      (j) => j.kind === job.kind && (j.kind !== "botStep" || job.kind !== "botStep" || j.botId === job.botId)
    );
    if (!duplicate) {
      await this.scheduleJob(job);
    }
  }

  async alarm(): Promise<void> {
    if (this.gameCtx.isDev) {
      this.devUsage().alarms++;
    }
    const jobs = await this.loadJobs();
    const now = Date.now() + 50; // alarms can fire a few ms early
    const due = jobs.filter((j) => j.at <= now).sort((a, b) => a.at - b.at);
    const rest = jobs.filter((j) => j.at > now);
    // persist the remainder first so handlers can schedule new work safely
    await this.saveJobs(rest);

    for (const job of due) {
      try {
        await this.runJob(job);
      } catch (e) {
        const attempts = (job.attempts ?? 0) + 1;
        console.log("scheduled job failed", job.kind, "attempt", attempts, e);
        if (attempts < MAX_JOB_ATTEMPTS) {
          // transient runtime errors happen; try again shortly
          await this.scheduleJob({ ...job, at: Date.now() + 300, attempts });
        }
      }
    }

    await this.armAlarm();
  }

  private async runJob(job: Job): Promise<void> {
    switch (job.kind) {
      case "event":
        this.broadcastServerEvent(job.event, job.payload);
        return;
      case "raw":
        this.broadcastAll(job.event, ...job.args);
        return;
      case "refresh":
        await this.gameCtx.events.refreshGameState();
        return;
      case "botStep":
        await this.run(async () => {
          const steps = (this.botSteps.get(job.botId) ?? 0) + 1;
          this.botSteps.set(job.botId, steps);
          if (steps > MAX_BOT_STEPS_PER_TURN) {
            console.log("bot step limit reached for", job.botId);
            return;
          }
          // the bot's piece is still moving: its next step is already booked
          // for after it lands, so a stray earlier step must not act now
          if (job.at < (this.botBusyUntil.get(job.botId) ?? 0)) {
            return;
          }
          const result = await BotPlayer.step(this.gameCtx, job.botId);
          if (typeof result === "object" && result.kind === "rolled") {
            // let everyone watch: the dice spin (one pace), the piece moves
            // (as long as the board animation takes), then a beat to see where
            // it landed before the bot does anything else
            const landed = Date.now() + this.pace(1) + this.scaledToPace(movementDurationMs(result.frames));
            const nextStep = landed + this.pace(1.25);
            this.botBusyUntil.set(job.botId, nextStep);
            await this.scheduleJob({ kind: "refresh", at: landed + this.pace(0.25) });
            await this.scheduleJob({ kind: "botStep", botId: job.botId, at: nextStep });
          } else if (result === "acted") {
            // one thing at a time (a purchase, a house, a mortgage), each easy to spot
            await this.scheduleJob({ kind: "botStep", botId: job.botId, at: Date.now() + this.pace(1.25) });
          }
          await this.syncIndex();
          await this.afterAction();
        });
        return;
      case "botBids":
        await this.run(async () => {
          const before = await this.store.getGame();
          const auctionId = before?.auctionId ?? null;
          const placed = await BotPlayer.placeBids(this.gameCtx);
          if (placed) {
            await this.broadcastAuctionViews(auctionId);
            const after = await this.store.getGame();
            if (after && !after.auctionId) {
              await this.gameCtx.events.refreshGameState();
            }
          }
          await this.afterAction();
        });
        return;
      case "botTrade":
        await this.run(async () => {
          await BotPlayer.answerTrade(this.gameCtx, job.tradeId);
          await this.syncIndex();
          await this.afterAction();
        });
        return;
      case "purge":
        await this.run(async () => {
          const game = await this.store.getGame();
          if (game && game.status !== GameStatus.FINISHED) {
            return;
          }
          if (game) {
            await this.gamesIndex.remove(game._id);
          }
          // everything this object stores: game, snapshots, auctions, lottos,
          // trades and pending jobs
          await this.storage.deleteAlarm();
          await this.storage.deleteAll();
        });
        return;
      case "expireLobby":
        await this.run(async () => {
          const game = await this.store.getGame();
          if (!game || game.status !== GameStatus.JOINING) {
            return; // it started (or is gone): nothing to do
          }
          await this.gamesIndex.remove(game._id);
          for (const socket of this.ctx.getWebSockets()) {
            try {
              socket.close(WS_CLOSE_LOBBY_EXPIRED, "this game expired before it filled up");
            } catch (e) {
              // already closing
            }
          }
          await this.storage.deleteAlarm();
          await this.storage.deleteAll();
        });
        return;
      default:
        return;
    }
  }

  /**
   * After anything changed the game: end it if no human is left, otherwise
   * make sure the computer players owe nothing (a bid, a move).
   */
  private async afterAction(): Promise<void> {
    try {
      const game = await this.store.getGame();
      if (game) {
        await this.dropNonPlayers(game);
      }
      if (game && game.status === GameStatus.FINISHED) {
        await this.onFinished(game);
        return;
      }
      if (!game || game.status !== GameStatus.ACTIVE) {
        return;
      }

      const humanLeft = game.players.some((p) => !p.isBot && p.state !== PlayerState.BANKRUPT);
      const overLong = game.settings.botsOnly && (game.turnNumber ?? 0) >= MAX_SIMULATION_TURNS;
      if ((!humanLeft && game.players.some((p) => p.isBot) && !game.settings.botsOnly) || overLong) {
        await BotPlayer.finishWithoutHumans(this.gameCtx, game);
        await this.gameCtx.events.refreshGameState();
        await this.syncIndex();
        await this.onFinished(game);
        return;
      }

      if (game.auctionId) {
        const auction = await this.store.getAuction(game.auctionId);
        const botOwesBid =
          !!auction &&
          !auction.finished &&
          auction.bidders.some((b) => !b.submittedBid && isBotId(game, b._id));
        if (botOwesBid) {
          await this.scheduleOnce({ kind: "botBids", at: Date.now() + this.pace(1) });
        }
        return;
      }

      const next = game.players.find((p) => areIdsEqual(p._id, game.nextPlayerToAct));
      if (this.lastTurnPlayer !== game.nextPlayerToAct) {
        // the turn changed hands: reset the loop guard
        this.lastTurnPlayer = game.nextPlayerToAct;
        this.botSteps.clear();
      }
      if (next && next.isBot && next.state !== PlayerState.BANKRUPT) {
        if ((this.botSteps.get(next._id) ?? 0) > MAX_BOT_STEPS_PER_TURN) {
          console.log("bot", next.name, "is stuck; not rescheduling");
          return;
        }
        // a beat after the turn reaches the bot, so it's clear whose turn it is
        await this.scheduleOnce({ kind: "botStep", botId: next._id, at: Date.now() + this.pace(1.25) });
      }
    } catch (e) {
      console.log("afterAction failed", e);
    }
  }

  /** A finished game: keep its summary in the history, then book its deletion. */
  private async onFinished(game: GameInstanceDocument): Promise<void> {
    await this.recordHistory(game);
    await this.schedulePurge();
  }

  /**
   * Summarise a finished game into the D1 history (once). Bots-only
   * simulations are not kept. A failure is retried by the next action on the
   * game, since the marker is only written once the rows are stored.
   */
  private async recordHistory(game: GameInstanceDocument): Promise<void> {
    if (game.settings.botsOnly || !game.players.some((p) => !p.isBot)) {
      return;
    }
    if (await this.storage.get(HISTORY_RECORDED_KEY)) {
      return;
    }
    try {
      const record = summariseGame(game, await this.getSnapshots());
      await this.history.record(record);
      await this.storage.put(HISTORY_RECORDED_KEY, true);
    } catch (e) {
      console.log("recording the game history failed", e);
    }
  }

  /** Book the deletion of a finished game (once; later calls change nothing). */
  private async schedulePurge(): Promise<void> {
    await this.scheduleOnce({ kind: "purge", at: Date.now() + this.purgeAfterMs });
  }

  /** Send every connected player their own view of an auction. */
  private async broadcastAuctionViews(auctionId: string | null): Promise<void> {
    const auction = await this.store.getAuction(auctionId);
    for (const socket of this.ctx.getWebSockets()) {
      const viewer = this.attachmentOf(socket);
      this.sendTo(socket, GameEvent.AUCTION_UPDATE, AuctionProcessor.viewFor(auction, viewer.userId));
    }
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private toResult(errMsg: string): ActionResult {
    return errMsg ? fail(errMsg) : ok();
  }

  /**
   * Runs fn with the input gate closed so two actions on the same game can
   * never interleave (D1 lookups mid-action would otherwise open the gate).
   * Exceptions are rethrown to the caller instead of resetting the object.
   */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    let outcome: { ok: true; value: T } | { ok: false; error: unknown } | undefined;
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        outcome = { ok: true, value: await fn() };
      } catch (error) {
        outcome = { ok: false, error };
      }
    });
    if (!outcome) {
      throw new Error("action did not complete");
    }
    if (!outcome.ok) {
      throw outcome.error;
    }
    return outcome.value;
  }

  /** run() plus keeping the lobby index in sync afterwards. */
  private async runAction<T>(fn: () => Promise<T>): Promise<T> {
    return this.run(async () => {
      const value = await fn();
      await this.syncIndex();
      await this.afterAction();
      return value;
    });
  }

  /**
   * Keeps the game's lobby index row current: on a change of status or
   * player count, and every few minutes of play (its updated_at is the
   * "last move" the watch list filters on). Called after every game action.
   */
  private async syncIndex(): Promise<void> {
    const game = await this.store.getGame();
    if (!game) {
      return;
    }
    const now = Date.now();
    const current: IndexState = {
      status: game.status,
      playersJoined: game.players.length,
      touchedAt: now,
    };
    const last = await this.storage.get<IndexState>(INDEX_STATE_KEY);
    const unchanged = !!last && last.status === current.status && last.playersJoined === current.playersJoined;
    const touchedAt = last?.touchedAt ?? 0;
    // only a real move counts: something was saved since the index last
    // heard of the game (a refused action, e.g. a spectator's, saves nothing)
    const lastMoveAt = Math.max(Date.parse(game.updatedAt ?? "") || 0, this.store.lastChangeAt);
    const movedSince = lastMoveAt > touchedAt;
    const touchDue = game.status === GameStatus.ACTIVE && movedSince && now - touchedAt >= this.activityTouchMs;
    if (unchanged && !touchDue) {
      return;
    }
    try {
      await this.gamesIndex.upsert({
        id: game._id,
        name: game.name,
        status: game.status,
        maxPlayers: game.settings.maxPlayers,
        playersJoined: game.players.length,
        hasPassword: !!game.settings.password,
        bots: game.players.filter((p) => p.isBot).length,
        createdBy: game.createdBy,
        createdAt: game.createdAt,
        // the time of the move itself, which may predate this action
        updatedAt: new Date(lastMoveAt || now).toISOString(),
      });
      await this.storage.put(INDEX_STATE_KEY, current);
    } catch (e) {
      console.log("failed to update lobby index", e);
    }
  }

  /** Distinct users watching (several tabs count once); `except` is closing. */
  private watcherCount(except?: WebSocket): number {
    const users = new Set<string>();
    for (const socket of this.ctx.getWebSockets(WATCH_TAG)) {
      if (socket !== except) {
        users.add(this.attachmentOf(socket).userId);
      }
    }
    return users.size;
  }

  private broadcastWatcherCount(except?: WebSocket): void {
    const count = this.watcherCount(except);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except) {
        this.sendTo(ws, GameEvent.WATCHERS, count);
      }
    }
  }

  private attachmentOf(ws: WebSocket): WsAttachment {
    const att = ws.deserializeAttachment() as WsAttachment | null;
    return att ?? { userId: "", playerName: "" };
  }

  private sendTo(ws: WebSocket, event: GameEvent, ...args: unknown[]): void {
    try {
      ws.send(JSON.stringify({ event, args }));
    } catch (e) {
      // socket is closing; the close handler will tidy up
    }
  }

  private broadcastAll(event: GameEvent, ...args: unknown[]): void {
    for (const ws of this.ctx.getWebSockets()) {
      this.sendTo(ws, event, ...args);
    }
  }

  private broadcastOthers(sender: WebSocket, event: GameEvent, ...args: unknown[]): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) {
        this.sendTo(ws, event, ...args);
      }
    }
  }

  /**
   * Mirrors the old `io.in(gameId).emit(event, args)` where `args` was the
   * rest-array: clients receive the payload wrapped in an array.
   */
  private broadcastServerEvent(event: GameEvent, payload: unknown): void {
    this.broadcastAll(event, [payload]);
  }
}
