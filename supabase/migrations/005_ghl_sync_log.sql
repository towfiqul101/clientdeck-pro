-- ============================================
-- ClientDeck Pro — GHL outbound sync log
-- Records every outbound sync attempt so failures can be surfaced and retried.
-- ============================================

CREATE TABLE ghl_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  sync_action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'retrying')),
  error_message TEXT,
  payload JSONB,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ghl_sync_log_agency ON ghl_sync_log(agency_id, attempted_at DESC);
CREATE INDEX idx_ghl_sync_log_failed ON ghl_sync_log(status) WHERE status = 'failed';

ALTER TABLE ghl_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own sync log" ON ghl_sync_log
  FOR SELECT USING (agency_id = get_user_agency_id());
