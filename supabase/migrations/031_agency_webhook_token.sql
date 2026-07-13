-- 031_agency_webhook_token.sql — Per-agency inbound webhook token.
--
-- The GHL webhooks previously authenticated with a single GLOBAL shared secret
-- (GHL_WEBHOOK_SECRET), which is shown to every agency on their own Settings →
-- GHL page. That means any agency could read it and forge webhooks against
-- ANOTHER agency's locationId (location ids are not secret — they sit in the
-- GHL dashboard URL). Fine with one agency; a cross-tenant hole the moment
-- there are two.
--
-- Each agency now gets its own unguessable token. The token identifies the
-- agency, and the webhook routes additionally verify that the payload's
-- locationId actually belongs to THAT agency — so a valid token for agency A
-- cannot be used to write to agency B.
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS webhook_token TEXT;

-- Backfill every existing agency with a unique random token (32 bytes hex).
UPDATE agencies
SET webhook_token = encode(gen_random_bytes(32), 'hex')
WHERE webhook_token IS NULL;

ALTER TABLE agencies
  ALTER COLUMN webhook_token SET NOT NULL,
  ALTER COLUMN webhook_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_webhook_token
  ON agencies (webhook_token);
