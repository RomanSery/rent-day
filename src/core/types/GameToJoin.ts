export interface GameToJoin {
  readonly gameId: string;
  readonly name: string;
  readonly maxPlayers: number;
  readonly playersJoined: number;
}
