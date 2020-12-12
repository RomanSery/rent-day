import { PieceType } from "../enums/PieceType";
import { PlayerState } from "../enums/PlayerState";

export interface Player {
  readonly _id?: string;
  readonly name: string;
  money: number;
  position: number;
  color: string;
  readonly type: PieceType;
  state: PlayerState;
}
