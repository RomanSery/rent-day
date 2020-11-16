import { PieceType } from "../enums/PieceType";

export interface Player {
  readonly _id?: string;
  readonly name: string;
  money: number;
  position: number;
  color: string;
  readonly type: PieceType;
}
