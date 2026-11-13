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
  current_streak: number;
  best_streak: number;
  best_win_worth: number;
  rent_collected: number;
  auctions_won: number;
  last_played_at: string | null;
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
  currentStreak: row.current_streak ?? 0,
  bestStreak: row.best_streak ?? 0,
  bestWinWorth: row.best_win_worth ?? 0,
  rentCollected: row.rent_collected ?? 0,
  auctionsWon: row.auctions_won ?? 0,
  lastPlayedAt: row.last_played_at ?? undefined,
  currGameId: row.curr_game_id ?? undefined,
  currGameName: row.curr_game_name ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const COLUMNS =
  "id, email, username, modified_username, password, wins, losses, games_played, current_streak, best_streak, best_win_worth, rent_collected, auctions_won, last_played_at, curr_game_id, curr_game_name, created_at, updated_at";

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
        `INSERT INTO users (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        user.currentStreak,
        user.bestStreak,
        user.bestWinWorth,
        user.rentCollected,
        user.auctionsWon,
        user.lastPlayedAt ?? null,
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
           current_streak = ?, best_streak = ?, best_win_worth = ?, rent_collected = ?,
           auctions_won = ?, last_played_at = ?,
           curr_game_id = ?, curr_game_name = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        user.password,
        user.wins,
        user.losses,
        user.gamesPlayed,
        user.currentStreak,
        user.bestStreak,
        user.bestWinWorth,
        user.rentCollected,
        user.auctionsWon,
        user.lastPlayedAt ?? null,
        user.currGameId ?? null,
        user.currGameName ?? null,
        new Date().toISOString(),
        user._id
      )
      .run();
  }

  /** The leaderboard: the top players by wins, without password hashes. */
  async listTop(limit: number): Promise<UserDocument[]> {
    const result = await this.db
      .prepare(
        `SELECT ${COLUMNS.replace("password", "'' AS password")}
           FROM users ORDER BY wins DESC, username ASC LIMIT ?`
      )
      .bind(limit)
      .all<UserRow>();
    return (result.results ?? []).map(toDoc);
  }
}
