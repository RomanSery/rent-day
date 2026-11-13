export interface GameToJoin {
  readonly gameId: string;
  readonly name: string;
  readonly maxPlayers: number;
  readonly playersJoined: number;
  readonly bots: number;
  readonly hasPassword: boolean;
  readonly createdAt: string;
  /** who created the game, when their account still exists */
  readonly hostName?: string;
}
