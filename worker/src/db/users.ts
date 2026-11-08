import { UserDocument } from "../game/model";

interface UserRow {
  id: string;
  email: string;
  username: string;
  modified_username: string;
  password: string;
  wins: number;
  losses: number;
  games_played: number;
  curr_game_id: string | null;
  curr_game_name: string | null;
  created_at: string;
  updated_at: string;
}

const toDoc = (row: UserRow): UserDocument => ({
  _id: row.id,
  email: row.email,
  username: row.username,
  modifiedUsername: row.modified_username,
  password: row.password,
  wins: row.wins,
  losses: row.losses,
  gamesPlayed: row.games_played,
  currGameId: row.curr_game_id ?? undefined,
  currGameName: row.curr_game_name ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const COLUMNS =
  "id, email, username, modified_username, password, wins, losses, games_played, curr_game_id, curr_game_name, created_at, updated_at";

export class UsersRepo {
  constructor(private readonly db: D1Database) {}

  async findById(id: string | null | undefined): Promise<UserDocument | null> {
    if (!id) {
      return null;
    }
    const row = await this.db
      .prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`)
      .bind(id)
      .first<UserRow>();
    return row ? toDoc(row) : null;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    const row = await this.db
      .prepare(`SELECT ${COLUMNS} FROM users WHERE email = ?`)
      .bind(email)
      .first<UserRow>();
    return row ? toDoc(row) : null;
  }

  async existsByEmailOrUsername(
    email: string,
    modifiedUsername: string
  ): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT id FROM users WHERE email = ? OR modified_username = ? LIMIT 1`)
      .bind(email, modifiedUsername)
      .first<{ id: string }>();
    return row != null;
  }

  async create(user: UserDocument): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO users (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user._id,
        user.email,
        user.username,
        user.modifiedUsername,
        user.password,
        user.wins,
        user.losses,
        user.gamesPlayed,
        user.currGameId ?? null,
        user.currGameName ?? null,
        user.createdAt,
        user.updatedAt
      )
      .run();
  }

  async save(user: UserDocument): Promise<void> {
    await this.db
      .prepare(
        `UPDATE users SET password = ?, wins = ?, losses = ?, games_played = ?,
           curr_game_id = ?, curr_game_name = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        user.password,
        user.wins,
        user.losses,
        user.gamesPlayed,
        user.currGameId ?? null,
        user.currGameName ?? null,
        new Date().toISOString(),
        user._id
      )
      .run();
  }

  async listAll(): Promise<UserDocument[]> {
    const result = await this.db
      .prepare(`SELECT ${COLUMNS} FROM users ORDER BY wins DESC, username ASC`)
      .all<UserRow>();
    return (result.results ?? []).map(toDoc);
  }
}
