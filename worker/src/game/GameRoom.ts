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

/** Result of a game action: errMsg is "" on success. */
export interface ActionResult {
  errMsg: string;
  data?: Record<string, unknown>;
}

interface WsAttachment {
  userId: string;
  playerName: string;
}

interface PendingEvent {
  at: number;
  event: GameEvent;
  payload: unknown;
}

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
      events: {
        send: (event, payload) => this.broadcastServerEvent(event, payload),
        sendDelayed: (delayMs, event, payload) =>
          this.scheduleEvent(delayMs, event, payload),
        refreshGameState: async () => {
          const game = toClientGame(await this.store.getGame());
          this.broadcastAll(GameEvent.UPDATE_GAME_STATE, game);
        },
      },
    };
  }

  // ---------------------------------------------------------------------
  // RPC methods called by the Worker
  // ---------------------------------------------------------------------

  async createGame(params: CreateGameParams): Promise<string> {
    return this.run(async () => {
      const existing = await this.store.getGame();
      if (existing) {
        throw new Error("game already exists");
      }
      const game = await GameProcessor.createGame(this.gameCtx, params);
      await this.gamesIndex.upsert({
        id: game._id,
        name: game.name,
        status: game.status,
        maxPlayers: game.settings.maxPlayers,
        playersJoined: 0,
        hasPassword: !!game.settings.password,
        createdBy: game.createdBy,
        createdAt: game.createdAt,
      });
      await this.ctx.storage.put<IndexState>(INDEX_STATE_KEY, {
        status: game.status,
        playersJoined: 0,
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
      return ok({ newTradeId: processor.getNewTradeId() });
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
        this.broadcastOthers(ws, GameEvent.SHOW_SNACK_MSG, me.playerName + " re-connected");
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
        const auction = await this.store.getAuction(
          typeof auctionId === "string" ? auctionId : null
        );
        // each player gets a view that hides the other players' bids
        for (const socket of this.ctx.getWebSockets()) {
          const viewer = this.attachmentOf(socket);
          this.sendTo(socket, GameEvent.AUCTION_UPDATE, AuctionProcessor.viewFor(auction, viewer.userId));
        }
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
  // Delayed events (replaces setTimeout on the old server)
  // ---------------------------------------------------------------------

  private async scheduleEvent(delayMs: number, event: GameEvent, payload: unknown): Promise<void> {
    const pending = (await this.ctx.storage.get<PendingEvent[]>(PENDING_EVENTS_KEY)) ?? [];
    const at = Date.now() + delayMs;
    pending.push({ at, event, payload });
    await this.ctx.storage.put(PENDING_EVENTS_KEY, pending);

    const current = await this.ctx.storage.getAlarm();
    if (current == null || at < current) {
      await this.ctx.storage.setAlarm(at);
    }
  }

  async alarm(): Promise<void> {
    const pending = (await this.ctx.storage.get<PendingEvent[]>(PENDING_EVENTS_KEY)) ?? [];
    const now = Date.now() + 50; // alarms can fire a few ms early
    const due = pending.filter((p) => p.at <= now);
    const rest = pending.filter((p) => p.at > now);

    for (const e of due) {
      this.broadcastServerEvent(e.event, e.payload);
    }

    await this.ctx.storage.put(PENDING_EVENTS_KEY, rest);
    if (rest.length > 0) {
      await this.ctx.storage.setAlarm(Math.min(...rest.map((r) => r.at)));
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
