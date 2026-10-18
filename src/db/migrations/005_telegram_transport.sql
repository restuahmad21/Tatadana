ALTER TABLE telegram_integrations
  ADD COLUMN transport TEXT NOT NULL DEFAULT 'polling'
  CHECK (transport IN ('polling', 'webhook'));