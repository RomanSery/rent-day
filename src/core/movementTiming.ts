/**
 * How long a piece takes to move along a path, shared by the board animation
 * (client) and the bot scheduler (server), so a bot waits exactly until its
 * piece has landed before acting again.
 *
 * A path lists every square passed, the start included. Neighbouring squares
 * are a hop each; a square repeated in a row is a pause (the beat on a Chance
 * square before a card moves the piece); two squares that aren't neighbours,
 * like the two stations of a subway ride, are one leap.
 */

/** seconds per square; long walks speed up so none takes much over MAX_TRIP */
export const STEP_SECONDS = 0.45;
export const MAX_TRIP_SECONDS = 10;
/** a leap between squares that aren't neighbours */
export const JUMP_SECONDS = 1.1;

export type MoveStepKind = "pause" | "hop" | "jump";

/** next to each other on the board (either direction, wrapping at 40) */
export const areNeighbours = (a: number, b: number): boolean => {
  const d = (b - a + 40) % 40;
  return d === 1 || d === 39;
};

export const movementStepKinds = (squares: number[]): MoveStepKind[] =>
  squares.slice(1).map((to, i) => {
    const from = squares[i];
    return from === to ? "pause" : areNeighbours(from, to) ? "hop" : "jump";
  });

/** seconds each step of the path takes */
export const movementStepSeconds = (squares: number[]): number[] => {
  const kinds = movementStepKinds(squares);
  const walkSteps = kinds.filter((k) => k !== "jump").length;
  const step = walkSteps > 0 ? Math.min(STEP_SECONDS, MAX_TRIP_SECONDS / walkSteps) : STEP_SECONDS;
  return kinds.map((k) => (k === "jump" ? JUMP_SECONDS : step));
};

/** total time the piece animation takes, in ms */
export const movementDurationMs = (squares: number[]): number =>
  Math.round(movementStepSeconds(squares).reduce((a, b) => a + b, 0) * 1000);
