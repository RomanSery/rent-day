import { PieceType } from "../enums/PieceType";
import { PlayerClass } from "../enums/PlayerClass";
import { PlayerState } from "../enums/PlayerState";

export interface Player {
  readonly _id?: string;
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
}
