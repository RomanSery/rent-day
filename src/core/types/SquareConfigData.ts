import { BoardSection } from "../enums/BoardSection";
import { SquareType } from "../enums/SquareType";

export interface SquareConfigData {
  readonly type: SquareType;
  readonly section: BoardSection;
  readonly groupId?: number;
}
