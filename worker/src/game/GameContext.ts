import { GameEvent } from "@core/types/GameEvent";
import {
  AuctionDocument,
  GameInstanceDocument,
  LottoDocument,
  TradeDocument,
  UserDocument,
} from "./model";

/**
 * Persistence used by the game logic. Inside a Durable Object the game,
 * auctions, lottos and trades live in the object's own storage; users live
 * in D1.
 */
export interface GameStore {
  getGame(): Promise<GameInstanceDocument | null>;
  saveGame(game: GameInstanceDocument): Promise<void>;

  getAuction(auctionId: string | null | undefined): Promise<AuctionDocument | null>;
  saveAuction(auction: AuctionDocument): Promise<void>;

  getLotto(lottoId: string | null | undefined): Promise<LottoDocument | null>;
  saveLotto(lotto: LottoDocument): Promise<void>;

  getTrade(tradeId: string | null | undefined): Promise<TradeDocument | null>;
  saveTrade(trade: TradeDocument): Promise<void>;

  getUser(userId: string | null | undefined): Promise<UserDocument | null>;
  saveUser(user: UserDocument): Promise<void>;
}

/**
 * Pushes events to every client connected to this game.
 * Matches the old socket.io `sendEventToGameClients(gameId, event, payload)`:
 * the client receives the payload wrapped in an array.
 */
export interface GameEvents {
  send(event: GameEvent, payload: unknown): void;
  sendDelayed(delayMs: number, event: GameEvent, payload: unknown): Promise<void>;
  /** Push the current game state to every connected client. */
  refreshGameState(): Promise<void>;
}

export interface GameContext {
  readonly store: GameStore;
  readonly events: GameEvents;
  /** development mode: forced dice are honoured */
  readonly isDev: boolean;
  /** dev shortcut: the second player starts owning every property */
  readonly devPreownProperties: boolean;
}
