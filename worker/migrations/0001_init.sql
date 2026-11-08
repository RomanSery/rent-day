-- User accounts (replaces the Mongo "users" collection)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  modified_username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  curr_game_id TEXT,
  curr_game_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Lobby index of games. The authoritative game state lives in each game's
-- Durable Object; this table only exists so the lobby can list games.
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  max_players INTEGER NOT NULL,
  players_joined INTEGER NOT NULL DEFAULT 0,
  has_password INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_status_created ON games (status, created_at);
