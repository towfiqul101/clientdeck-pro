-- 017_credit_monitoring.sql — Agency-plan credit monitoring provider integration
CREATE TABLE IF NOT EXISTS credit_monitoring_pulls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('myfreescorenow', 'identityiq', 'smartcredit', 'manual')),
  pulled_at TIMESTAMPTZ DEFAULT NOW(),
  score_eq INTEGER,
  score_exp INTEGER,
  score_tu INTEGER,
  raw_response JSONB,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_pulls_client ON credit_monitoring_pulls(client_id, pulled_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_pulls_agency ON credit_monitoring_pulls(agency_id, pulled_at DESC);

ALTER TABLE credit_monitoring_pulls ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Agency sees own pulls" ON credit_monitoring_pulls
    FOR SELECT USING (agency_id = get_user_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Agency manages pulls" ON credit_monitoring_pulls
    FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS credit_monitoring_service TEXT
  CHECK (credit_monitoring_service IN ('myfreescorenow', 'identityiq', 'smartcredit', 'none'))
  DEFAULT 'none';

ALTER TABLE agencies ADD COLUMN IF NOT EXISTS credit_monitoring_api_key TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS credit_monitoring_api_secret TEXT;
