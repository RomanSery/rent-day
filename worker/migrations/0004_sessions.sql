-- Server-side sessions, so a session can be revoked (log out, log out
-- everywhere). The cookie holds a random token; only its SHA-256 is stored.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,          -- hex SHA-256 of the cookie token
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- unix seconds
  remember INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- Failed logins per email address, for the temporary lockout that stops
-- password guessing against one account from many IPs.
CREATE TABLE IF NOT EXISTS login_failures (
  email TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL -- unix seconds of the first failure in the window
);
