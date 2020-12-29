import { Bidder } from "./Bidder";

export interface AuctionState {
  readonly id: string;
  readonly gameId: string;
  readonly winnerId: string;
  readonly finished: boolean;
  readonly squareId: number;
  readonly bidders: Array<Bidder>;
}