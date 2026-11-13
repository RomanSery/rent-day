-- Indexes for the queries that scanned whole tables. D1 bills rows scanned,
-- not rows returned, so each of these was paid for per row in the table.

-- Leaderboard: ORDER BY wins DESC, username ASC LIMIT n (findPlayers)
CREATE INDEX IF NOT EXISTS idx_users_leaderboard ON users (wins DESC, username ASC);

-- "Games waiting for players" for one host (the open-lobby cap in createGame)
CREATE INDEX IF NOT EXISTS idx_games_created_by_status ON games (created_by, status);

-- Lobby list: WHERE status = ? AND julianday(created_at) > julianday(?)
-- ORDER BY julianday(created_at) DESC. The query compares julianday() values
-- because created_at is stored in more than one ISO format, so the plain
-- (status, created_at) index could only narrow by status; this one matches
-- the expression and serves both the filter and the sort.
CREATE INDEX IF NOT EXISTS idx_games_status_julian ON games (status, julianday(created_at));
DROP INDEX IF EXISTS idx_games_status_created;

-- Clearing stale failed-login counters: WHERE window_start <= ?
CREATE INDEX IF NOT EXISTS idx_login_failures_window ON login_failures (window_start);
