import { GameStatus } from "../enums/GameStatus";
import { ChatMsg } from "./ChatMsg";
import { LastResult } from "./LastResult";
import { Player } from "./Player";
import { Settings } from "./Settings";
import { SquareGameData } from "./SquareGameData";
import { SquareThemeData } from "./SquareThemeData";
import { RentPaid } from "./RentPaid";
import { AuctionResult } from "./AuctionResult";
import { PendingChanceChoice } from "./ChanceEvent";

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
  /** a Chance card whose player still has to pick an option */
  readonly pendingChance?: PendingChanceChoice | null;
  readonly results: LastResult;
  readonly status: GameStatus;
  readonly messages: Array<ChatMsg>;
  readonly log: Array<ChatMsg>;
  readonly gameLength: number;
  readonly winner: string;
  readonly createdBy: string;
  /** completed turns so far */
  readonly turnNumber?: number;
  /** how the last auction ended */
  readonly lastAuction?: AuctionResult;
  /** the last rent paid in the game */
  readonly lastRent?: RentPaid;
  /** shown once the game is over */
  readonly seed?: number;
}
