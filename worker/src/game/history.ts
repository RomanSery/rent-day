// Summary of a finished game for the lasting history in D1 (db/history.ts).
//
// Built once, when the game ends, from the game and its per-turn snapshots
// (snapshots.ts): the snapshots are the only record of how the game went, and
// they are deleted with the rest of the game some time later.

import { PlayerState } from "@core/enums/PlayerState";
import { HistorySeat } from "@core/types/PlayerProfile";
import { GameInstanceDocument } from "./model";
import { TurnSnapshot } from "./snapshots";

/** properties kept per player per game */
const PROPERTIES_KEPT = 8;

export interface HistoryPlayerRow {
  userId: string;
  playerClass: string;
  rank: number | null;
  won: boolean;
  finalWorth: number;
  maxDeficit: number;
  deficitTurn: number | null;
  /** [squareId, name, turnsHeld], longest held first */
  properties: Array<[number, string, number]>;
}

export interface GameHistoryRecord {
  gameId: string;
  name: string;
  startedAt: string;
  endedAt: string;
  minutes: number | null;
  turns: number;
  winnerName: string | null;
  seats: HistorySeat[];
  /** humans only: computer players have no profile */
  players: HistoryPlayerRow[];
}

export const summariseGame = (
  game: GameInstanceDocument,
  snapshots: TurnSnapshot[]
): GameHistoryRecord => {
  const turnSnaps = snapshots.filter((s) => !s.final);
  const endedAt = new Date().toISOString();

  // a player who went bankrupt or resigned is out: what cash they kept is
  // not a result, so they finish with nothing
  const worthOf = (p: GameInstanceDocument["players"][number]): number =>
    p.state === PlayerState.BANKRUPT ? 0 : Math.round(p.totalAssets ?? 0);

  const seats: HistorySeat[] = game.players.map((p) => ({
    id: p._id,
    name: p.name,
    bot: !!p.isBot,
    cls: p.playerClass,
    rank: p.finishedRank,
    worth: worthOf(p),
    color: p.color,
  }));

  const squareName = (squareId: number): string =>
    game.theme?.[String(squareId)]?.name ?? "Square " + squareId;

  const players: HistoryPlayerRow[] = game.players
    .filter((p) => !p.isBot)
    .map((p) => {
      // furthest behind the richest other player while still in the game
      let maxDeficit = 0;
      let deficitTurn: number | null = null;
      const held = new Map<number, number>();
      for (const snap of turnSnaps) {
        const me = snap.players.find((x) => x._id === p._id);
        if (!me || me.state === PlayerState.BANKRUPT) {
          continue;
        }
        const leader = Math.max(
          0,
          ...snap.players.filter((x) => x._id !== p._id).map((x) => x.totalAssets)
        );
        const deficit = Math.round(leader - me.totalAssets);
        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          deficitTurn = snap.turn;
        }
        for (const sq of snap.squares) {
          if (sq.owner === p._id) {
            held.set(sq.squareId, (held.get(sq.squareId) ?? 0) + 1);
          }
        }
      }
      // what they own at the very end counts too (a short game may have no
      // turn snapshot after a purchase)
      for (const sq of game.squareState) {
        if (sq.owner === p._id && !held.has(sq.squareId)) {
          held.set(sq.squareId, 1);
        }
      }
      const properties = Array.from(held, ([id, turns]): [number, string, number] => [id, squareName(id), turns])
        .sort((a, b) => b[2] - a[2] || a[0] - b[0])
        .slice(0, PROPERTIES_KEPT);

      return {
        userId: p._id,
        playerClass: p.playerClass,
        rank: p.finishedRank ?? null,
        won: p.finishedRank === 1,
        finalWorth: worthOf(p),
        maxDeficit,
        deficitTurn,
        properties,
      };
    });

  return {
    gameId: game._id,
    name: game.name,
    startedAt: game.createdAt,
    endedAt,
    minutes: game.gameLength ?? null,
    turns: game.turnNumber ?? turnSnaps.length,
    winnerName: game.winner ?? null,
    seats,
    players,
  };
};
