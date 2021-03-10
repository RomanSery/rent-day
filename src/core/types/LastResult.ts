import { ChanceEvent } from "./ChanceEvent";

export interface LastResult {
  roll: { die1: number; die2: number };
  description: string;
  chance?: ChanceEvent | null;
}
