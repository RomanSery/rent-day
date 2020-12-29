import mongoose from "mongoose";
import { Bidder } from "../types/Bidder";
import { BidderSchema } from "./BidderSchema";

export type AuctionDocument = mongoose.Document & {
  gameId: mongoose.Types.ObjectId;
  winnerId: mongoose.Types.ObjectId;
  bidders: Bidder[];
  finished: boolean;
  squareId: number;
  isTie: boolean;
};

const auctionSchema = new mongoose.Schema(
  {
    gameId: mongoose.Types.ObjectId,
    winnerId: mongoose.Types.ObjectId,
    bidders: [BidderSchema],
    finished: Boolean,
    isTie: Boolean,
    squareId: Number,
  },
  { timestamps: true }
);

export const Auction = mongoose.model<AuctionDocument>(
  "auctions",
  auctionSchema
);
