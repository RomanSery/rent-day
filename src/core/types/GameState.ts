import { Player } from "./Player";
import { SquareThemeData } from "./SquareThemeData";

export interface GameState {
  readonly id: String;
  readonly theme: Array<SquareThemeData>;
  readonly players: [Player];
}
