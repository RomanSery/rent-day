export interface PlayerInfo {
  readonly name: string;
  readonly wins: number;
  readonly gamesPlayed: number;
  readonly currGame?: string;
}
