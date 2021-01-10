import { BoardSection } from "../enums/BoardSection";
import { SquareType } from "../enums/SquareType";

export interface SquareConfigData {
  readonly type: SquareType;
  readonly section: BoardSection;
  readonly groupId?: number;
  readonly description?: string;

  readonly houseCost?: number;
  readonly tax?: number;
  readonly rent?: Map<number, number>;
}
