import { PieceType } from "../enums/PieceType";
import { PlayerClass } from "../enums/PlayerClass";
import { PlayerState } from "../enums/PlayerState";
import { DiceRoll } from "./DiceRoll";
import { BotLevel } from "../enums/BotLevel";

export interface Player {
  _id: string;
  readonly name: string;

  /** computer-controlled player */
  isBot?: boolean;
  botLevel?: BotLevel;
  /** turn number of the bot's last trade proposal */
  botLastOfferTurn?: number;

  finishedRank?: number;

  money: number;

  taxesPerTurn: number;
  electricityCostsPerTurn: number;
  taxTooltip: string;
  electricityTooltip: string;

  totalAssets: number;
  mortgageableValue: number;
  redeemableValue: number;

  position: number;
  color: string;
  readonly type: PieceType;
  readonly playerClass: PlayerClass;
  state: PlayerState;

  numAbilityPoints: number;
  negotiation: number;
  luck: number;
  corruption: number;

  hasRolled: boolean;
  hasTraveled: boolean;
  canTravel: boolean;
  rollHistory: Array<DiceRoll>;
  numTurnsInIsolation: number;
  numTimeouts: number;
}
