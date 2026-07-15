-- 035_drop_ghl_webhook_url.sql — removes a dead column.
--
-- agencies.ghl_webhook_url predates the tag-based notification/webhook-token
-- redesign (see agencies.webhook_token, migration 031). Confirmed zero reads
-- and zero writes anywhere in src/ — the webhook URLs actually shown in
-- Settings → GHL are built dynamically from webhook_token, not this column.

ALTER TABLE agencies DROP COLUMN IF EXISTS ghl_webhook_url;
