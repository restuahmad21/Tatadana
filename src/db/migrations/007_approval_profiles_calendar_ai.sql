ALTER TABLE users ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE users ADD COLUMN approved_at TEXT;
ALTER TABLE users ADD COLUMN rejected_at TEXT;
ALTER TABLE users ADD COLUMN rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN job_title TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '';

CREATE INDEX users_approval_status_idx ON users (approval_status, created_at DESC);

ALTER TABLE wallets ADD COLUMN wallet_type TEXT NOT NULL DEFAULT 'cash'
  CHECK (wallet_type IN ('cash', 'bank', 'ewallet'));
ALTER TABLE wallets ADD COLUMN institution TEXT NOT NULL DEFAULT '';

ALTER TABLE budgets ADD COLUMN period_type TEXT NOT NULL DEFAULT 'monthly'
  CHECK (period_type IN ('daily', 'weekly', 'monthly'));

CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_date TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX notes_user_date_idx ON notes (user_id, note_date);

CREATE TABLE tata_ai_drafts (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'awaiting_wallet'
    CHECK (state IN ('awaiting_wallet', 'awaiting_destination')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX tata_ai_drafts_user_idx ON tata_ai_drafts (user_id, expires_at);