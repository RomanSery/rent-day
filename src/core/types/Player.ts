import { PieceType } from "../enums/PieceType";

export interface Player {
  readonly id: string;
  readonly name: string;
  money: number;
  position: number;
  readonly color: string;
  readonly type: PieceType;
}
