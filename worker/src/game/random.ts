// One random number generator per game, created with the game.
//
// Every random outcome in a game (dice, chance cards, lotto prizes and draws,
// muggings, seat order, bot classes and bid jitter) comes from here, so a game
// with the same seed and the same player choices plays out the same way: for
// daily challenges, reproducible bug reports and deterministic tests.
//
// The generator is ChaCha20 (RFC 8439) used as a keystream: the game holds a
// 256-bit key (game.rngKey) and the number of draws so far (game.rngState),
// and draw n is word n of the keystream. Without the key, past dice and lotto
// prizes say nothing about future ones. Ordinary games get a random key;
// a game created with a seed (development, daily challenges) derives its key
// from the seed, so anyone who knows that seed can predict it.
//
// Players must never see the key or the draw count: toClientGame strips both,
// and shows the seed (if any) only once the game is over.
//
// Games created before the key existed carry a 32-bit mulberry32 state in
// rngState and no key; they keep using it until they end.

import { GameInstanceDocument } from "./model";

type Seeded = Pick<GameInstanceDocument, "seed" | "rngState" | "rngKey">;

/** A fresh random 32-bit seed. */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];

const toHex = (words: Uint32Array): string =>
  Array.from(words, (w) => w.toString(16).padStart(8, "0")).join("");

const fromHex = (hex: string): Uint32Array => {
  const words = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    words[i] = parseInt(hex.slice(i * 8, i * 8 + 8), 16) >>> 0;
  }
  return words;
};

/** mulberry32 step: the legacy generator, also used to stretch a seed into a key */
const mulberry = (state: number): { state: number; value: number } => {
  let t = (state = (state + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state, value: (t ^ (t >>> 14)) >>> 0 };
};

/**
 * A 256-bit generator key (64 hex characters): random, or derived from a
 * seed so that seeded games replay exactly.
 */
export const newRngKey = (seed?: number): string => {
  const words = new Uint32Array(8);
  if (seed === undefined) {
    crypto.getRandomValues(words);
  } else {
    let state = seed >>> 0;
    for (let i = 0; i < 8; i++) {
      const step = mulberry(state);
      state = step.state;
      words[i] = step.value;
    }
  }
  return toHex(words);
};

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n));

const quarterRound = (x: Uint32Array, a: number, b: number, c: number, d: number): void => {
  x[a] += x[b]; x[d] = rotl(x[d] ^ x[a], 16);
  x[c] += x[d]; x[b] = rotl(x[b] ^ x[c], 12);
  x[a] += x[b]; x[d] = rotl(x[d] ^ x[a], 8);
  x[c] += x[d]; x[b] = rotl(x[b] ^ x[c], 7);
};

/** One 64-byte ChaCha20 block (RFC 8439 section 2.3) as 16 words. */
export const chacha20Block = (
  key: Uint32Array,
  counter: number,
  nonce: readonly number[] = [0, 0, 0]
): Uint32Array => {
  const input = new Uint32Array(16);
  input[0] = 0x61707865;
  input[1] = 0x3320646e;
  input[2] = 0x79622d32;
  input[3] = 0x6b206574;
  input.set(key, 4);
  input[12] = counter >>> 0;
  input[13] = nonce[0];
  input[14] = nonce[1];
  input[15] = nonce[2];
  const x = input.slice();
  for (let i = 0; i < 10; i++) {
    quarterRound(x, 0, 4, 8, 12);
    quarterRound(x, 1, 5, 9, 13);
    quarterRound(x, 2, 6, 10, 14);
    quarterRound(x, 3, 7, 11, 15);
    quarterRound(x, 0, 5, 10, 15);
    quarterRound(x, 1, 6, 11, 12);
    quarterRound(x, 2, 7, 8, 13);
    quarterRound(x, 3, 4, 9, 14);
  }
  for (let i = 0; i < 16; i++) {
    x[i] += input[i];
  }
  return x;
};

// draws come in runs of 16 from the same block: keep the last one
let cached: { key: string; block: number; words: Uint32Array } | null = null;

const keystreamWord = (keyHex: string, n: number): number => {
  const block = Math.floor(n / 16);
  if (!cached || cached.key !== keyHex || cached.block !== block) {
    cached = { key: keyHex, block, words: chacha20Block(fromHex(keyHex), block) };
  }
  return cached.words[n % 16];
};

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
  if (!game.rngKey && game.rngState !== undefined) {
    // a game from before the key existed: keep its mulberry32 sequence
    const step = mulberry(game.rngState);
    game.rngState = step.state;
    return step.value / 4294967296;
  }
  if (!game.rngKey) {
    // a game with no generator at all gets one on first use
    game.rngKey = newRngKey(game.seed);
    game.rngState = 0;
  }
  const n = game.rngState ?? 0;
  game.rngState = n + 1;
  return keystreamWord(game.rngKey, n) / 4294967296;
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
