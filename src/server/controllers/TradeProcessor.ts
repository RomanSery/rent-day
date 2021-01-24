import { Auction, AuctionDocument } from "../../core/schema/AuctionSchema";
import mongoose from "mongoose";
import {
  GameInstance,
  GameInstanceDocument,
} from "../../core/schema/GameInstanceSchema";

export class TradeProcessor {
  private bid: number;
  private gameId: mongoose.Types.ObjectId;
  private userId: mongoose.Types.ObjectId;
  private game?: GameInstanceDocument | null;
  private auction?: AuctionDocument | null;

  constructor(
    bid: number,
    gameId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ) {
    this.bid = bid;
    this.gameId = gameId;
    this.userId = userId;
  }

  private async init(): Promise<void> {
    this.game = await GameInstance.findById(this.gameId);
    if (this.game) {
      this.auction = await Auction.findById(this.game.auctionId);
    }
  }
}
