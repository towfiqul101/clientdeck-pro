-- 027_agency_api_keys.sql — Agency API key management (Step 1: key issuance +
-- auth only; no /api/v1/* data endpoints yet, see src/lib/api/auth.ts).
CREATE TABLE IF NOT EXISTS agency_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agency_api_keys_agency ON agency_api_keys(agency_id, created_at DESC);

ALTER TABLE agency_api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Agency sees own API keys" ON agency_api_keys
    FOR SELECT USING (agency_id = get_user_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Agency creates own API keys" ON agency_api_keys
    FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Agency revokes own API keys" ON agency_api_keys
    FOR UPDATE USING (agency_id = get_user_agency_id())
    WITH CHECK (agency_id = get_user_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
