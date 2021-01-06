import mongoose from "mongoose";
import { PieceType } from "../enums/PieceType";
import { PlayerClass } from "../enums/PlayerClass";
import { PlayerState } from "../enums/PlayerState";
import { DiceRoll } from "./DiceRoll";

export interface Player {
  _id: mongoose.Types.ObjectId;
  readonly name: string;
  money: number;
  position: number;
  color: string;
  readonly type: PieceType;
  readonly playerClass: PlayerClass;
  state: PlayerState;

  negotiation: number;
  speed: number;
  intelligence: number;

  hasRolled: boolean;
  lastRoll?: DiceRoll;
  secondRoll?: DiceRoll;
  thirdRoll?: DiceRoll;
}
