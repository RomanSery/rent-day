import { PieceType } from "../enums/PieceType";

export interface Bidder {
  readonly _id?: string;
  readonly name: string;
  readonly type: PieceType;
  readonly color: string;
  bid?: number;
  submittedBid: boolean;
}
