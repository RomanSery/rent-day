import mongoose from "mongoose";
import { PieceType } from "../enums/PieceType";

export interface Bidder {
  _id: mongoose.Types.ObjectId;
  readonly name: string;
  readonly type: PieceType;
  readonly color: string;
  bid?: number;
  submittedBid: boolean;
}
