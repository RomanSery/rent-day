import { Player } from "./Player";
import { Settings } from "./Settings";
import { SquareThemeData } from "./SquareThemeData";

export interface GameState {
  readonly id: string;
  readonly name: string;
  readonly settings: Settings;
  readonly theme: Array<SquareThemeData>;
  readonly players: Array<Player>;
  readonly nextPlayerToAct: string;
}
