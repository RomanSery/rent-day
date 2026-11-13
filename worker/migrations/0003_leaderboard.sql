-- Leaderboard records per account, updated when a game ends for the player
ALTER TABLE users ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0;
-- net worth at the end of the best win
ALTER TABLE users ADD COLUMN best_win_worth INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN rent_collected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN auctions_won INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_played_at TEXT;
