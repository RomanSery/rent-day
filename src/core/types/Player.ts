import { PieceType } from "../enums/PieceType";

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly money: number;
  readonly position: number;
  readonly color: string;
  readonly type: PieceType;
}
