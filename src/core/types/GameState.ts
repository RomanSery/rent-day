import mongoose from "mongoose";
import { LastResult } from "./LastResult";
import { Player } from "./Player";
import { Settings } from "./Settings";
import { SquareGameData } from "./SquareGameData";
import { SquareThemeData } from "./SquareThemeData";

export interface GameState {
  readonly id: mongoose.Types.ObjectId;
  readonly name: string;
  readonly settings: Settings;
  readonly theme: Array<SquareThemeData>;
  readonly squareState: Array<SquareGameData>;
  readonly players: Array<Player>;
  readonly nextPlayerToAct: mongoose.Types.ObjectId;
  readonly auctionId: mongoose.Types.ObjectId;
  readonly auctionSquareId: number;
  readonly results: LastResult;
}
