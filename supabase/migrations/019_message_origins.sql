-- ============================================
-- 019: message_origins
-- Supports the GHL Conversations-based Messages tab (agency + portal).
--
-- GHL stamps every conversation message "outbound" regardless of who
-- actually sent it (staff via the agency dashboard, or the client via the
-- portal), so there is no field on the message itself to tell them apart.
-- We record the true origin ourselves at send time and merge it back in
-- when displaying the thread. No message content/subject/body is stored
-- here — messages themselves are never cached, always fetched live from
-- GHL (see src/lib/ghl/api.ts conversation methods).
-- ============================================

CREATE TABLE message_origins (
  message_id TEXT PRIMARY KEY, -- GHL message id
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK (origin IN ('staff', 'client')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_origins_client ON message_origins(client_id);

ALTER TABLE message_origins ENABLE ROW LEVEL SECURITY;

-- Agency-side reads/writes go through the staff Supabase session (RLS-scoped).
CREATE POLICY "Agency sees own message origins" ON message_origins
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency logs message origins" ON message_origins
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

-- Portal-side reads/writes use the service-role client (no Supabase Auth
-- session to scope RLS against — same pattern as every other portal table).
