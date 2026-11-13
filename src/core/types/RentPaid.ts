/** The last rent paid in a game, so every screen can show it as it happens. */
export interface RentPaid {
  /** counts up with every rent paid in the game; a new value means new rent */
  seq: number;
  squareId: number;
  amount: number;
  payerId: string;
  ownerId: string;
}
