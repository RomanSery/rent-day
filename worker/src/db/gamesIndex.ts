import { GameToJoin } from "@core/types/GameToJoin";
import { GameStatus } from "@core/enums/GameStatus";

export interface GameIndexRow {
  id: string;
  name: string;
  status: GameStatus;
  maxPlayers: number;
  playersJoined: number;
  hasPassword: boolean;
  createdBy: string;
  createdAt: string;
}

/**
 * Lobby index of games kept in D1. Each game's Durable Object is the source
 * of truth and keeps this row up to date.
 */
export class GamesIndexRepo {
  constructor(private readonly db: D1Database) {}

  async upsert(row: GameIndexRow): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO games (id, name, status, max_players, players_joined, has_password, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           players_joined = excluded.players_joined,
           updated_at = excluded.updated_at`
      )
      .bind(
        row.id,
        row.name,
        row.status,
        row.maxPlayers,
        row.playersJoined,
        row.hasPassword ? 1 : 0,
        row.createdBy,
        row.createdAt,
        now
      )
      .run();
  }

  async listJoining(createdAfterIso: string): Promise<GameToJoin[]> {
    const result = await this.db
      .prepare(
        `SELECT id, name, max_players, players_joined FROM games
         WHERE status = ? AND created_at > ?
         ORDER BY created_at DESC`
      )
      .bind(GameStatus.JOINING, createdAfterIso)
      .all<{ id: string; name: string; max_players: number; players_joined: number }>();

    return (result.results ?? []).map((r) => ({
      gameId: r.id,
      name: r.name,
      maxPlayers: r.max_players,
      playersJoined: r.players_joined,
    }));
  }
}
