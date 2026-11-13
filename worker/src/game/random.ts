// One random number generator per game, seeded when the game is created.
//
// Every random outcome in a game (dice, chance cards, lotto prizes and draws,
// muggings, seat order, bot classes and bid jitter) comes from here, so a game
// with the same seed and the same player choices plays out the same way: for
// daily challenges, reproducible bug reports and deterministic tests.
//
// The generator's state is a single 32-bit number kept on the game document
// (game.rngState) and saved with it; each draw advances it. Players must never
// see it, or they could predict the dice: toClientGame strips it, and the seed
// too until the game is over.
//
// The generator is mulberry32: tiny, fast and plenty random for a board game
// (it is not suitable for anything security related).

import { GameInstanceDocument } from "./model";

type Seeded = Pick<GameInstanceDocument, "seed" | "rngState">;

/** A fresh random 32-bit seed. */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];

/** A seed from user input (a number or any text, like "2026-11-13"). */
export const toSeed = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(Math.abs(value)) >>> 0;
  }
  if (typeof value === "string" && value.length > 0) {
    // FNV-1a hash of the text
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      h = Math.imul(h ^ value.charCodeAt(i), 0x01000193);
    }
    return h >>> 0;
  }
  return undefined;
};

/** A number in [0, 1), advancing the game's generator. */
export const random = (game: Seeded): number => {
  if (game.rngState === undefined) {
    // games created before seeding existed get a seed on first use
    game.seed = game.seed ?? newSeed();
    game.rngState = game.seed;
  }
  let t = (game.rngState = (game.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A whole number from min to max, both included. */
export const randomInt = (game: Seeded, min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(random(game) * (max - min + 1)) + min;
};

/** One item of the array, or undefined when it is empty. */
export const randomPick = <T>(game: Seeded, items: readonly T[]): T | undefined =>
  items.length ? items[Math.floor(random(game) * items.length)] : undefined;

/** A shuffled copy of the array (Fisher-Yates). */
export const shuffled = <T>(game: Seeded, items: readonly T[]): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(game) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
