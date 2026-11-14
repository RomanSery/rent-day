-- Messages sent from the Contact Us page (POST /api/contact), read by the
-- site's admins on /admin/messages. Anyone may write one, signed in or not.
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  email TEXT NOT NULL,           -- the address they want an answer at
  name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,         -- general, feedback, questions, bugs, other
  message TEXT NOT NULL,
  user_id TEXT,                  -- their account, when they were signed in
  username TEXT
);

-- Newest first for the inbox, and the daily cap counts the last 24 hours.
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages (created_at);
