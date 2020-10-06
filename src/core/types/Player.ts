import { BoardSection } from "../enums/BoardSection";
import { SquareType } from "../enums/SquareType";

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly money: number;
  readonly position: number;
  readonly color: string;
}
