import { Player } from "./Player";
import { SquareThemeData } from "./SquareThemeData";

export interface GameState {
  readonly id: string;
  readonly theme: Array<SquareThemeData>;
  readonly players: [Player];
  readonly nextPlayerToAct: string;
}
