export interface User {
  readonly id: string;
  readonly username: string;
  readonly password: string;
  readonly wins: number;
  readonly gamesPlayed: number;
  readonly currGameId?: string;
  readonly currGameName?: string;
}
