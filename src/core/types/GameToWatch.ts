/** A game in progress that signed-in users may watch (no password set). */
export interface GameToWatch {
  readonly gameId: string;
  readonly name: string;
  /** seats taken, computer players included */
  readonly playersJoined: number;
  readonly bots: number;
  /** roughly when the latest move was made (recorded every few minutes of play) */
  readonly lastMoveAt: string;
  /** who created the game, when their account still exists */
  readonly hostName?: string;
}
