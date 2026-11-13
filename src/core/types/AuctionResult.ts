/** How the last auction in a game ended, so every screen can show it for a while. */
export interface AuctionResult {
  auctionId: string;
  squareId: number;
  /** null when the top bids tied and nobody won */
  winnerId: string | null;
  isTie: boolean;
  /** what the winner paid: the second-highest bid (or their own if nobody else bid) */
  price: number;
  /** the turn the auction ended on */
  turn: number;
  /** every bid, highest first; noBid when the player let the timer run out */
  bids: Array<{ playerId: string; name: string; color: string; bid: number; noBid: boolean }>;
}
