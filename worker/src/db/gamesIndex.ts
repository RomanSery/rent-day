import { GameToJoin } from "@core/types/GameToJoin";
import { GameToWatch } from "@core/types/GameToWatch";
import { GameStatus } from "@core/enums/GameStatus";

export interface GameIndexRow {
  id: string;
  name: string;
  status: GameStatus;
  maxPlayers: number;
  playersJoined: number;
  hasPassword: boolean;
  bots: number;
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
        `INSERT INTO games (id, name, status, max_players, players_joined, has_password, bots, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           players_joined = excluded.players_joined,
           bots = excluded.bots,
           updated_at = excluded.updated_at`
      )
      .bind(
        row.id,
        row.name,
        row.status,
        row.maxPlayers,
        row.playersJoined,
        row.hasPassword ? 1 : 0,
        row.bots,
        row.createdBy,
        row.createdAt,
        now
      )
      .run();
  }

  async remove(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM games WHERE id = ?`).bind(id).run();
  }

  /** Lobbies this user created that are still waiting for players. */
  async countOpenLobbies(userId: string): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM games WHERE created_by = ? AND status = ?`)
      .bind(userId, GameStatus.JOINING)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async listJoining(createdAfterIso: string): Promise<GameToJoin[]> {
    const result = await this.db
      .prepare(
        `SELECT g.id, g.name, g.max_players, g.players_joined, g.bots, g.has_password, g.created_at,
                u.username AS host_name
         FROM games g LEFT JOIN users u ON u.id = g.created_by
         WHERE g.status = ? AND julianday(g.created_at) > julianday(?)
         ORDER BY julianday(g.created_at) DESC
         LIMIT 100`
      )
      .bind(GameStatus.JOINING, createdAfterIso)
      .all<{
        id: string; name: string; max_players: number; players_joined: number; bots: number;
        has_password: number; created_at: string; host_name: string | null;
      }>();

    return (result.results ?? []).map((r) => ({
      gameId: r.id,
      name: r.name,
      maxPlayers: r.max_players,
      playersJoined: r.players_joined,
      bots: r.bots,
      hasPassword: r.has_password === 1,
      createdAt: r.created_at,
      hostName: r.host_name ?? undefined,
    }));
  }

  /**
   * Games in progress that anyone signed in may watch: started, no password,
   * at least one person playing. Bounded by creation date so the status +
   * julianday(created_at) index serves it, and so games abandoned without
   * ever finishing drop off the list.
   */
  async listWatchable(createdAfterIso: string): Promise<GameToWatch[]> {
    const result = await this.db
      .prepare(
        `SELECT g.id, g.name, g.players_joined, g.bots, g.updated_at, u.username AS host_name
         FROM games g LEFT JOIN users u ON u.id = g.created_by
         WHERE g.status = ? AND julianday(g.created_at) > julianday(?)
           AND g.has_password = 0 AND g.players_joined > g.bots
         ORDER BY julianday(g.created_at) DESC
         LIMIT 50`
      )
      .bind(GameStatus.ACTIVE, createdAfterIso)
      .all<{
        id: string; name: string; players_joined: number; bots: number;
        updated_at: string; host_name: string | null;
      }>();

    return (result.results ?? []).map((r) => ({
      gameId: r.id,
      name: r.name,
      playersJoined: r.players_joined,
      bots: r.bots,
      startedAt: r.updated_at,
      hostName: r.host_name ?? undefined,
    }));
  }
}
