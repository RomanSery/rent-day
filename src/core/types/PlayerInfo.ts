export interface PlayerInfo {
  readonly playerId: string;
  readonly name: string;
  readonly wins: number;
  readonly gamesPlayed: number;
  readonly currGame?: string;
}
