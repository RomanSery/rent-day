import mongoose from "mongoose";
import { Bidder } from "./Bidder";

export interface AuctionState {
  readonly id: mongoose.Types.ObjectId;
  readonly gameId: mongoose.Types.ObjectId;
  readonly winnerId: mongoose.Types.ObjectId;
  readonly finished: boolean;
  readonly squareId: number;
  readonly bidders: Array<Bidder>;
  readonly isTie: boolean;
}
