export interface GameContext {
  readonly gameId: string | null;
  readonly userId: string | null;
  readonly authToken: string;
}
