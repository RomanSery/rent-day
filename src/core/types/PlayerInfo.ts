/** One account on the leaderboard. */
export interface PlayerInfo {
  readonly playerId: string;
  readonly name: string;
  readonly wins: number;
  readonly losses: number;
  readonly gamesPlayed: number;
  /** wins in a row right now, and the most ever */
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** net worth at the end of their best win */
  readonly bestWinWorth: number;
  /** lifetime totals across finished games */
  readonly rentCollected: number;
  readonly auctionsWon: number;
  /** when a game last ended for them */
  readonly lastPlayedAt?: string;
  readonly memberSince: string;
  readonly currGame?: string;
}
