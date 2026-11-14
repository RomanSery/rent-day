/** A game in progress that signed-in users may watch (no password set). */
export interface GameToWatch {
  readonly gameId: string;
  readonly name: string;
  /** seats taken, computer players included */
  readonly playersJoined: number;
  readonly bots: number;
  /** when the game last changed status: when it started, for a live game */
  readonly startedAt: string;
  /** who created the game, when their account still exists */
  readonly hostName?: string;
}
