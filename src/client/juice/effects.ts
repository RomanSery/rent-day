// Board effects worked out from what changed between two game states: a rent
// pop and coin sound when rent is paid, a pop and hammer sound when a house
// is built. Game updates reach the board only after a piece has landed, so
// these play as the piece arrives.

import { create } from "zustand";
import { GameState } from "../../core/types/GameState";
import { dollarFormatter } from "../helpers";
import { playBuildSound, playRentSound } from "./sfx";

export interface SquarePop {
  id: number;
  squareId: number;
  text: string;
  /** the pill's background: the colour of the player the money or house goes to */
  color: string;
  kind: "rent" | "build";
}

interface EffectsStore {
  pops: SquarePop[];
  addPop: (pop: Omit<SquarePop, "id">) => void;
  removePop: (id: number) => void;
}

/** how long a pop stays on the board, in ms */
const POP_MS = 2200;
let nextPopId = 1;

export const useEffectsStore = create<EffectsStore>()((set) => ({
  pops: [],
  addPop: (pop) => {
    const id = nextPopId++;
    set((s) => ({ pops: [...s.pops, { ...pop, id }] }));
    setTimeout(() => set((s) => ({ pops: s.pops.filter((p) => p.id !== id) })), POP_MS);
  },
  removePop: (id) => set((s) => ({ pops: s.pops.filter((p) => p.id !== id) })),
}));

const colorOf = (game: GameState, playerId: string | undefined): string =>
  game.players.find((p) => p._id === playerId)?.color ?? "#555";

/** Call with the board's previous and new game state. */
export const playEffects = (prev: GameState | undefined, next: GameState | undefined): void => {
  // nothing on the first load or when switching games: only live changes
  if (!prev || !next || prev._id !== next._id) {
    return;
  }
  const { addPop } = useEffectsStore.getState();

  const rent = next.lastRent;
  if (rent && rent.seq !== prev.lastRent?.seq) {
    addPop({
      squareId: rent.squareId,
      text: "Rent " + dollarFormatter.format(rent.amount),
      color: colorOf(next, rent.ownerId),
      kind: "rent",
    });
    playRentSound();
  }

  let built = false;
  for (const sq of next.squareState) {
    const before = prev.squareState.find((s) => s.squareId === sq.squareId);
    if (!before || !sq.owner || before.owner !== sq.owner) {
      continue;
    }
    const added = sq.numHouses - before.numHouses;
    if (added > 0) {
      built = true;
      addPop({
        squareId: sq.squareId,
        text: added === 1 ? "+1 house" : `+${added} houses`,
        color: colorOf(next, sq.owner),
        kind: "build",
      });
    }
  }
  if (built) {
    playBuildSound();
  }
};
