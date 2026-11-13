import { SquareConfigDataMap } from "../../core/config/SquareData";
import { ActionMode } from "../../core/enums/ActionMode";
import { SquareType } from "../../core/enums/SquareType";
import { GameState } from "../../core/types/GameState";
import { SquareGameData } from "../../core/types/SquareGameData";
import { areObjectIdsEqual } from "../helpers";

/** whether a square can be clicked in the current action mode, and why not */
export interface ActionEligibility {
  eligible: boolean;
  reason?: string;
}

const NO: (reason: string) => ActionEligibility = (reason) => ({ eligible: false, reason });
const YES: ActionEligibility = { eligible: true };

const stateOf = (game: GameState, squareId: number): SquareGameData | undefined =>
  game.squareState.find((s) => s.squareId === squareId);

/** squares in the same colour group (properties only) */
const groupSquares = (game: GameState, groupId: number): SquareGameData[] => {
  const out: SquareGameData[] = [];
  SquareConfigDataMap.forEach((c, id) => {
    if (c.groupId === groupId) {
      const s = stateOf(game, id);
      if (s) {
        out.push(s);
      }
    }
  });
  return out;
};

/**
 * Mirrors the server's checks in PropertyProcessor (mortgage, redeem, build
 * house, sell house) so the board can show which squares a click would work
 * on. The server still has the final say.
 */
export const getActionEligibility = (
  game: GameState,
  squareId: number,
  mode: ActionMode,
  myId: string | null
): ActionEligibility => {
  const config = SquareConfigDataMap.get(squareId);
  const state = stateOf(game, squareId);
  const me = game.players.find((p) => areObjectIdsEqual(p._id, myId));
  if (!config || !state || !me) {
    return NO("Not available");
  }

  const isProperty = config.type === SquareType.Property;
  const isMortgageable = isProperty || config.type === SquareType.TrainStation;
  if (!isMortgageable || (!isProperty && (mode === ActionMode.Build || mode === ActionMode.Sell))) {
    return NO(mode === ActionMode.Build || mode === ActionMode.Sell ? "Only properties have houses" : "Can't be mortgaged");
  }
  if (!state.owner || !areObjectIdsEqual(state.owner, me._id)) {
    return NO("Not yours");
  }

  const group = config.groupId ? groupSquares(game, config.groupId) : [];
  const ownsWholeGroup = group.length > 0 && group.every((s) => s.owner && areObjectIdsEqual(s.owner, me._id));

  switch (mode) {
    case ActionMode.Mortgage:
      if (state.isMortgaged) {
        return NO("Already mortgaged");
      }
      if (group.some((s) => s.numHouses > 0)) {
        return NO("Sell the houses in this group first");
      }
      return YES;

    case ActionMode.Redeem: {
      if (!state.isMortgaged) {
        return NO("Not mortgaged");
      }
      const cost = state.mortgageValue ? Math.round(state.mortgageValue * 1.1) : 0;
      if (me.money < cost) {
        return NO("Not enough money to redeem");
      }
      return YES;
    }

    case ActionMode.Build:
      if (!ownsWholeGroup) {
        return NO("Own the whole colour group to build");
      }
      if (group.some((s) => s.isMortgaged)) {
        return NO("Redeem the group's mortgaged properties first");
      }
      if (state.numHouses >= 5) {
        return NO("Fully built");
      }
      if (me.money < (state.houseCost ?? 0)) {
        return NO("Not enough money for a house");
      }
      if (group.some((s) => s.numHouses < state.numHouses)) {
        return NO("Build evenly: add to the others first");
      }
      return YES;

    case ActionMode.Sell:
      if (state.isMortgaged) {
        return NO("Mortgaged");
      }
      if (!ownsWholeGroup) {
        return NO("No houses here");
      }
      if (state.numHouses <= 0) {
        return NO("No houses here");
      }
      if (group.some((s) => s.numHouses > state.numHouses)) {
        return NO("Sell evenly: sell from the others first");
      }
      return YES;

    default:
      return NO("Not available");
  }
};

/** how many squares can be clicked in this mode */
export const countEligibleSquares = (game: GameState, mode: ActionMode, myId: string | null): number => {
  let n = 0;
  for (let id = 1; id <= 40; id++) {
    if (getActionEligibility(game, id, mode, myId).eligible) {
      n++;
    }
  }
  return n;
};
