// Per-turn snapshots of a game, for replays, net-worth charts and undo.
//
// Kept as small as possible so they fit comfortably in the free plan: a
// snapshot holds only what changes during a game (each player's money,
// position, assets and state, and who owns which square with how many
// houses). Names, colours, prices and the theme never change, so they are
// read from the game itself when a snapshot is unpacked. Players are stored
// by their seat in game.players, which is fixed once a game has started.
//
// A snapshot is written once per turn, when the turn starts (so snapshot N is
// the board as turn N begins), plus one final snapshot when the game ends.
// About 300 bytes each; a 250-turn game is under 100 KB. The whole game,
// snapshots included, is deleted some time after it finishes (GameRoom).

import { PlayerState } from "@core/enums/PlayerState";
import { GameInstanceDocument } from "./model";
import { areIdsEqual } from "./ids";

export const SNAPSHOT_PREFIX = "snap:";
/** sorts after every numbered key, so a prefix listing returns it last */
export const FINAL_SNAPSHOT_KEY = SNAPSHOT_PREFIX + "end";

export const snapshotKey = (turn: number): string =>
  SNAPSHOT_PREFIX + String(turn).padStart(5, "0");

const STATES: PlayerState[] = [PlayerState.ACTIVE, PlayerState.IN_ISOLATION, PlayerState.BANKRUPT];

/** [money, position, totalAssets, state index] per seat */
type PackedPlayer = [number, number, number, number];
/** [squareId, owner seat, houses, mortgaged 0/1], owned squares only */
type PackedSquare = [number, number, number, number];
/** [turn, seat to act or -1, players, squares] */
type PackedSnapshot = [number, number, PackedPlayer[], PackedSquare[]];

export interface TurnSnapshot {
  turn: number;
  /** the snapshot taken when the game ended */
  final: boolean;
  nextPlayerToAct: string | null;
  players: Array<{
    _id: string;
    money: number;
    position: number;
    totalAssets: number;
    state: PlayerState;
  }>;
  squares: Array<{
    squareId: number;
    owner: string;
    numHouses: number;
    isMortgaged: boolean;
  }>;
}

const seatOf = (game: GameInstanceDocument, playerId: string | null | undefined): number =>
  playerId ? game.players.findIndex((p) => areIdsEqual(p._id, playerId)) : -1;

/** The game's changing state as a compact JSON string. */
export const packSnapshot = (game: GameInstanceDocument): string => {
  const players: PackedPlayer[] = game.players.map((p) => [
    p.money,
    p.position,
    p.totalAssets,
    Math.max(0, STATES.indexOf(p.state)),
  ]);
  const squares: PackedSquare[] = [];
  for (const s of game.squareState) {
    const owner = seatOf(game, s.owner);
    if (owner >= 0) {
      squares.push([s.squareId, owner, s.numHouses, s.isMortgaged ? 1 : 0]);
    }
  }
  const packed: PackedSnapshot = [game.turnNumber ?? 0, seatOf(game, game.nextPlayerToAct), players, squares];
  return JSON.stringify(packed);
};

/** Expand a stored snapshot back into readable form, using the game for ids. */
export const unpackSnapshot = (
  game: GameInstanceDocument,
  raw: string,
  final: boolean
): TurnSnapshot => {
  const [turn, next, players, squares] = JSON.parse(raw) as PackedSnapshot;
  const idAt = (seat: number): string => game.players[seat]?._id ?? "";
  return {
    turn,
    final,
    nextPlayerToAct: next >= 0 ? idAt(next) : null,
    players: players.map(([money, position, totalAssets, state], seat) => ({
      _id: idAt(seat),
      money,
      position,
      totalAssets,
      state: STATES[state] ?? PlayerState.ACTIVE,
    })),
    squares: squares.map(([squareId, owner, numHouses, mortgaged]) => ({
      squareId,
      owner: idAt(owner),
      numHouses,
      isMortgaged: mortgaged === 1,
    })),
  };
};
