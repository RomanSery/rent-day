-- Finished games, kept after the game's Durable Object purges its own copy,
-- so players have a history and a profile. Written once per game, by the
-- game's Durable Object, when the game ends (see GameRoom.recordHistory).
CREATE TABLE IF NOT EXISTS game_history (
  id TEXT PRIMARY KEY,           -- the game id
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  minutes INTEGER,
  turns INTEGER NOT NULL DEFAULT 0,
  winner_name TEXT,
  -- JSON array, every seat including computer players:
  -- [{ id, name, bot, cls, rank, worth, color }]
  players TEXT NOT NULL
);

-- One row per human player per finished game: what a profile is built from.
CREATE TABLE IF NOT EXISTS game_history_players (
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  player_class TEXT NOT NULL,
  finished_rank INTEGER,
  won INTEGER NOT NULL,
  final_worth INTEGER NOT NULL,
  -- furthest behind the richest other player at the start of any turn, and when
  max_deficit INTEGER NOT NULL DEFAULT 0,
  deficit_turn INTEGER,
  -- JSON array of the properties they held longest: [[squareId, name, turnsHeld]]
  properties TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, game_id)
);

-- A profile reads one player's games, newest first
CREATE INDEX IF NOT EXISTS idx_history_players_user_ended
  ON game_history_players (user_id, ended_at DESC);
