import { Player } from "./Player";
import { SquareThemeData } from "./SquareThemeData";

export interface GameState {
  readonly id: string;
  readonly name: string;
  readonly numPlayers: number;
  readonly theme: Array<SquareThemeData>;
  readonly players: Array<Player>;
  readonly nextPlayerToAct: string;
}
