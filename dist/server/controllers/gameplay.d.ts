import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { GameContext } from "../../core/types/GameContext";
export declare const processRoll: (context: GameContext) => Promise<void | GameInstanceDocument>;
