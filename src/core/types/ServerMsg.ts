export interface ServerMsg {
  readonly title: string;
  readonly body: string;
  /** set for an elimination, so the client can draw a notice for it */
  readonly bankruptcy?: {
    readonly playerId: string;
    /** where they finished, 1 being the winner */
    readonly finishedRank: number;
    readonly numPlayers: number;
  };
}
