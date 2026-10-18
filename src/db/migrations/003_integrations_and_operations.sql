ALTER TABLE telegram_integrations ADD COLUMN webhook_secret TEXT;
ALTER TABLE payment_requests ADD COLUMN checkout_url TEXT;

ALTER TABLE telegram_updates RENAME TO telegram_updates_legacy;
CREATE TABLE telegram_updates (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  update_id INTEGER NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, update_id)
);
INSERT OR IGNORE INTO telegram_updates (user_id, update_id, processed_at)
  SELECT user_id, update_id, processed_at FROM telegram_updates_legacy;
DROP TABLE telegram_updates_legacy;

CREATE TABLE service_credentials (
  provider TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX system_logs_created_idx ON system_logs (created_at DESC);