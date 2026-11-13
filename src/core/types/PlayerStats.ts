/** Running totals for one player over a game (missing on games started before they existed). */
export interface PlayerStats {
  rentCollected: number;
  rentPaid: number;
  auctionsWon: number;
  /** what they paid for the auctions they won */
  auctionSpend: number;
  /** times they passed Payday and collected a salary */
  paydays: number;
  lottoWinnings: number;
}

export const emptyPlayerStats = (): PlayerStats => ({
  rentCollected: 0,
  rentPaid: 0,
  auctionsWon: 0,
  auctionSpend: 0,
  paydays: 0,
  lottoWinnings: 0,
});
