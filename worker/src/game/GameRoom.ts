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

/** Result of a game action: errMsg is "" on success. */
export interface ActionResult {
  errMsg: string;
  data?: Record<string, unknown>;
}

interface WsAttachment {
  userId: string;
  playerName: string;
}

/** Work the object has scheduled for itself through its alarm. */
type Job = { attempts?: number } & (
  | { kind: "event"; at: number; event: GameEvent; payload: unknown }
  | { kind: "raw"; at: number; event: GameEvent; args: unknown[] }
  | { kind: "refresh"; at: number }
  | { kind: "botStep"; at: number; botId: string }
  | { kind: "botBids"; at: number }
  | { kind: "botTrade"; at: number; tradeId: string }
);

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

interface IndexState {
  status: GameStatus;
  playersJoined: number;
}

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
const MAX_CHAT_LENGTH = 200;

/** Replace the game password hash before a game leaves the server. */
export const toClientGame = (
  game: GameInstanceDocument | null
): GameInstanceDocument | null => {
  if (!game) {
    return null;
  }
  return {
    ...game,
    settings: {
      ...game.settings,
      password: game.settings.password ? "protected" : null,
    },
  };
};

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
  private readonly gameCtx: GameContext;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new DurableObjectGameStore(ctx.storage, new UsersRepo(env.DB));
    this.gamesIndex = new GamesIndexRepo(env.DB);
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
      await this.ctx.storage.put<IndexState>(INDEX_STATE_KEY, {
        status: game.status,
        playersJoined: game.players.length,
      });
      return game._id;
    });
  }

  async getGame(): Promise<GameInstanceDocument | null> {
    return toClientGame(await this.store.getGame());
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
    return AuctionProcessor.getAuction(this.gameCtx, auctionId, userId);
  }

  async getLotto(lottoId: string): Promise<LottoDocument | null> {
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
    forceDie2: number | null
  ): Promise<ActionResult> {
    return this.runAction(async () => {
      const processor = new RollProcessor(this.gameCtx, userId, forceDie1, forceDie2);
      const errMsg = await processor.roll(false, false);
      if (errMsg) {
        return fail(errMsg);
      }
      const frames = processor.getMovementKeyFrames();
      const needToAnimate =
        processor.getOrigPosition() !== processor.getNewPosition() &&
        frames &&
        frames.length > 0;
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
      return ok({
        needToAnimate: true,
        playerId: userId,
        diceRoll: toDiceResult(processor.getLastDiceRoll()),
        frames: processor.getMovementKeyFrames(),
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

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }

    // The Worker verified the session cookie and passes the identity along.
    const userId = request.headers.get("X-User-Id");
    const playerName = request.headers.get("X-User-Name") ?? "";
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    const attachment: WsAttachment = { userId, playerName };
    server.serializeAttachment(attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
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
        this.broadcastOthers(ws, GameEvent.SHOW_SNACK_MSG, me.playerName + " re-connected");
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
        const [, playerId, diceRoll, frames] = args;
        this.broadcastAll(GameEvent.STOP_ANIMATE_DICE, playerId, diceRoll, frames);
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
    this.broadcastOthers(
      ws,
      GameEvent.SHOW_SNACK_MSG,
      me.playerName + " disconnected: " + (reason || (wasClean ? "closed" : "connection lost"))
    );
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
    const stored = (await this.ctx.storage.get<Array<Job | LegacyPendingEvent>>(PENDING_EVENTS_KEY)) ?? [];
    return stored.map((j) => ("kind" in j ? j : { kind: "event", at: j.at, event: j.event, payload: j.payload }));
  }

  private async saveJobs(jobs: Job[]): Promise<void> {
    await this.ctx.storage.put(PENDING_EVENTS_KEY, jobs);
  }

  private async armAlarm(): Promise<void> {
    const jobs = await this.loadJobs();
    if (jobs.length === 0) {
      return;
    }
    const next = Math.min(...jobs.map((j) => j.at));
    const current = await this.ctx.storage.getAlarm();
    if (current == null || next < current) {
      await this.ctx.storage.setAlarm(next);
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
      if (!game || game.status !== GameStatus.ACTIVE) {
        return;
      }

      const humanLeft = game.players.some((p) => !p.isBot && p.state !== PlayerState.BANKRUPT);
      const overLong = game.settings.botsOnly && (game.turnNumber ?? 0) >= MAX_SIMULATION_TURNS;
      if ((!humanLeft && game.players.some((p) => p.isBot) && !game.settings.botsOnly) || overLong) {
        await BotPlayer.finishWithoutHumans(this.gameCtx, game);
        await this.gameCtx.events.refreshGameState();
        await this.syncIndex();
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

  private async syncIndex(): Promise<void> {
    const game = await this.store.getGame();
    if (!game) {
      return;
    }
    const current: IndexState = {
      status: game.status,
      playersJoined: game.players.length,
    };
    const last = await this.ctx.storage.get<IndexState>(INDEX_STATE_KEY);
    if (last && last.status === current.status && last.playersJoined === current.playersJoined) {
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
      });
      await this.ctx.storage.put(INDEX_STATE_KEY, current);
    } catch (e) {
      console.log("failed to update lobby index", e);
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
