-- 029_agency_api_rate_limits.sql — Fixed-window rate limiting for the Agency
-- API (100 req/hour per key, enforced in src/lib/api/auth.ts). A Postgres
-- table rather than the in-memory src/lib/utils/rate-limit.ts helper: that
-- helper is per-serverless-instance memory, which doesn't enforce a real cap
-- on a billed-tier feature.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES agency_api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (api_key_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_window ON api_rate_limits(api_key_id, window_start);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies: only ever read/written by validateApiKey() via the
-- service-role client (no Supabase Auth session on API-key-authenticated
-- requests to scope RLS against) — same pattern as push_subscriptions.

-- Atomic increment-and-read for the current window. INSERT ... ON CONFLICT
-- avoids a race between concurrent requests for the same key double-counting
-- the same increment.
CREATE OR REPLACE FUNCTION increment_api_rate_limit(p_api_key_id UUID, p_window_start TIMESTAMPTZ)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO api_rate_limits (api_key_id, window_start, request_count)
  VALUES (p_api_key_id, p_window_start, 1)
  ON CONFLICT (api_key_id, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
