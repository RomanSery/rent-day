import { ChanceEvent } from "@core/types/ChanceEvent";
import { Player } from "@core/types/Player";
import { GameInstanceDocument } from "../model";

export interface ServerChanceEvent extends ChanceEvent {
  makeItHappen: (game: GameInstanceDocument, player: Player) => number | null;
  getSubLine: (game: GameInstanceDocument, player: Player) => string;
}

/** Strip the functions so the event can be sent to clients. */
export const toClientChanceEvent = (e: ServerChanceEvent): ChanceEvent => ({
  isGood: e.isGood,
  headline: e.headline,
  subLine: e.subLine,
  chanceId: e.chanceId,
});
