ALTER TABLE telegram_integrations ADD COLUMN link_code TEXT;
CREATE UNIQUE INDEX telegram_link_code_idx
  ON telegram_integrations (link_code) WHERE link_code IS NOT NULL;

ALTER TABLE payment_requests ADD COLUMN provider_reference TEXT;