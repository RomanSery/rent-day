import { ChanceChoiceOption, ChanceEvent } from "@core/types/ChanceEvent";
import { Player } from "@core/types/Player";
import { GameInstanceDocument } from "../model";

/** A Chance card the player who drew it settles by picking one option. */
export interface ServerChanceChoice {
  /** the options shown on the card; the first one is the default when the player times out */
  getOptions: (game: GameInstanceDocument, player: Player) => ChanceChoiceOption[];
  /** carry out the picked option; returns a square to move to, or null */
  resolve: (game: GameInstanceDocument, player: Player, key: string) => number | null;
  /** what a computer player picks */
  botPick: (game: GameInstanceDocument, player: Player) => string;
  /** one line for the game log saying what the player picked */
  describe: (game: GameInstanceDocument, player: Player, key: string) => string;
}

export interface ServerChanceEvent extends ChanceEvent {
  makeItHappen: (game: GameInstanceDocument, player: Player) => number | null;
  /** worked out before makeItHappen runs, so amounts describe the state the card read */
  getSubLine: (game: GameInstanceDocument, player: Player) => string;
  /** cards whose tone depends on the board (e.g. whether the drawer is the leader) */
  getIsGood?: (game: GameInstanceDocument, player: Player) => boolean;
  /** cards that only make sense on some boards; left out of the draw otherwise */
  isAvailable?: (game: GameInstanceDocument, player: Player) => boolean;
  choice?: ServerChanceChoice;
}

/** Strip the functions so the event can be sent to clients. */
export const toClientChanceEvent = (e: ServerChanceEvent): ChanceEvent => ({
  isGood: e.isGood,
  headline: e.headline,
  subLine: e.subLine,
  chanceId: e.chanceId,
  ...(e.choices ? { choices: e.choices } : {}),
});
