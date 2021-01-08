import mongoose, { Schema } from "mongoose";
import { Bidder } from "../types/Bidder";

const BidderSchema = new mongoose.Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  bid: { type: Number },
  color: { type: String, required: true },
  type: { type: String, required: true },
  submittedBid: { type: Boolean, required: true },
});

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
