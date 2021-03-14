import { GameInstanceDocument } from "../../core/schema/GameInstanceSchema";
import { ChanceEvent } from "../../core/types/ChanceEvent";
import { Player } from "../../core/types/Player";

export interface ServerChanceEvent extends ChanceEvent {
  makeItHappen: (game: GameInstanceDocument, player: Player) => boolean;
}
