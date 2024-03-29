import { GameStatus } from "../enums/GameStatus";
import { ChatMsg } from "./ChatMsg";
import { LastResult } from "./LastResult";
import { Player } from "./Player";
import { Settings } from "./Settings";
import { SquareGameData } from "./SquareGameData";
import { SquareThemeData } from "./SquareThemeData";

export interface GameState {
  readonly _id: string;
  readonly name: string;
  readonly settings: Settings;
  readonly theme: Array<SquareThemeData>;
  readonly squareState: Array<SquareGameData>;
  readonly players: Array<Player>;
  readonly nextPlayerToAct: string;
  readonly nextPlayerActBy?: string;
  readonly auctionId: string;
  readonly auctionSquareId: number;
  readonly lottoId: string;
  readonly results: LastResult;
  readonly status: GameStatus;
  readonly messages: Array<ChatMsg>;
  readonly log: Array<ChatMsg>;
  readonly gameLength: number;
  readonly winner: string;
}
