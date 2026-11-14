import { GameStore } from "./GameContext";
import {
  AuctionDocument,
  GameInstanceDocument,
  LottoDocument,
  TradeDocument,
  UserDocument,
} from "./model";
import { UsersRepo } from "../db/users";
import { GameStatus } from "@core/enums/GameStatus";
import { FINAL_SNAPSHOT_KEY, packSnapshot, snapshotKey } from "./snapshots";

export const GAME_KEY = "game";

/**
 * GameStore backed by a Durable Object's storage (game, auctions, lottos and
 * trades) plus D1 for user accounts.
 */
export class DurableObjectGameStore implements GameStore {
  constructor(
    private readonly storage: DurableObjectStorage,
    private readonly users: UsersRepo
  ) {}

  /** the last snapshot written by this instance (turn number, or "end") */
  private lastSnapshot: number | "end" | undefined;

  /**
   * When this instance last saved anything (ms, 0 if nothing yet): a bid or
   * a trade saves no game document, but is still a move. In memory only;
   * read in the same request as the save (GameRoom.syncIndex).
   */
  lastChangeAt = 0;

  async getGame(): Promise<GameInstanceDocument | null> {
    const game = await this.storage.get<GameInstanceDocument>(GAME_KEY);
    return game ?? null;
  }

  async saveGame(game: GameInstanceDocument): Promise<void> {
    this.lastChangeAt = Date.now();
    game.updatedAt = new Date(this.lastChangeAt).toISOString();
    // The game logic keeps class instances (DiceRoll) in the state while a
    // request runs; persist plain JSON like the old Mongo documents were.
    await this.storage.put(GAME_KEY, JSON.parse(JSON.stringify(game)));
    await this.snapshotIfNewTurn(game);
  }

  /**
   * One snapshot per turn, taken by the first save of that turn, and one when
   * the game ends. Later saves in the same turn write nothing, so this costs
   * one extra storage write per turn. See snapshots.ts.
   */
  private async snapshotIfNewTurn(game: GameInstanceDocument): Promise<void> {
    let marker: number | "end";
    if (game.status === GameStatus.ACTIVE) {
      marker = game.turnNumber ?? 0;
    } else if (game.status === GameStatus.FINISHED) {
      marker = "end";
    } else {
      return;
    }
    if (marker === this.lastSnapshot) {
      return;
    }
    const key = marker === "end" ? FINAL_SNAPSHOT_KEY : snapshotKey(marker);
    // a fresh instance (after the object was evicted) does not know what was
    // written before: keep the snapshot taken at the start of the turn
    const alreadyTaken =
      this.lastSnapshot === undefined && (await this.storage.get(key)) !== undefined;
    if (!alreadyTaken) {
      await this.storage.put(key, packSnapshot(game));
    }
    this.lastSnapshot = marker;
  }

  async getAuction(auctionId: string | null | undefined): Promise<AuctionDocument | null> {
    if (!auctionId) {
      return null;
    }
    const auction = await this.storage.get<AuctionDocument>(`auction:${auctionId}`);
    return auction ?? null;
  }

  async saveAuction(auction: AuctionDocument): Promise<void> {
    this.lastChangeAt = Date.now();
    await this.storage.put(`auction:${auction._id}`, auction);
  }

  async getLotto(lottoId: string | null | undefined): Promise<LottoDocument | null> {
    if (!lottoId) {
      return null;
    }
    const lotto = await this.storage.get<LottoDocument>(`lotto:${lottoId}`);
    return lotto ?? null;
  }

  async saveLotto(lotto: LottoDocument): Promise<void> {
    this.lastChangeAt = Date.now();
    await this.storage.put(`lotto:${lotto._id}`, lotto);
  }

  async getTrade(tradeId: string | null | undefined): Promise<TradeDocument | null> {
    if (!tradeId) {
      return null;
    }
    const trade = await this.storage.get<TradeDocument>(`trade:${tradeId}`);
    return trade ?? null;
  }

  async saveTrade(trade: TradeDocument): Promise<void> {
    this.lastChangeAt = Date.now();
    await this.storage.put(`trade:${trade._id}`, trade);
  }

  async getUser(userId: string | null | undefined): Promise<UserDocument | null> {
    return this.users.findById(userId);
  }

  async saveUser(user: UserDocument): Promise<void> {
    await this.users.save(user);
  }
}
