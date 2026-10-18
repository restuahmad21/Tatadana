ALTER TABLE budgets RENAME TO budgets_legacy;

CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_key TEXT NOT NULL,
  month TEXT NOT NULL,
  limit_amount INTEGER NOT NULL CHECK (limit_amount > 0),
  alert_threshold INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold BETWEEN 1 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, category_id, period_type, period_key)
);

INSERT INTO budgets (id, user_id, category_id, period_type, period_key, month, limit_amount, alert_threshold, created_at)
  SELECT id, user_id, category_id, 'monthly', month, month, limit_amount, alert_threshold, created_at
  FROM budgets_legacy;

DROP TABLE budgets_legacy;
CREATE INDEX budgets_user_period_idx ON budgets (user_id, period_type, period_key);