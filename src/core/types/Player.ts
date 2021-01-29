import { PieceType } from "../enums/PieceType";
import { PlayerClass } from "../enums/PlayerClass";
import { PlayerState } from "../enums/PlayerState";
import { DiceRoll } from "./DiceRoll";

export interface Player {
  _id: string;
  readonly name: string;
  money: number;
  taxesPerTurn: number;
  electricityCostsPerTurn: number;
  position: number;
  color: string;
  readonly type: PieceType;
  readonly playerClass: PlayerClass;
  state: PlayerState;

  negotiation: number;
  luck: number;
  corruption: number;

  hasRolled: boolean;
  rollHistory: Array<DiceRoll>;
  numTurnsInIsolation: number;
}
