-- ============================================
-- ClientDeck Pro — Score history
-- Point-in-time credit score snapshots so the portal can chart progress.
-- ============================================

CREATE TABLE score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  score_eq INTEGER,
  score_exp INTEGER,
  score_tu INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  round_number INTEGER,
  notes TEXT
);

CREATE INDEX idx_score_history_client ON score_history(client_id, recorded_at ASC);

ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency sees own score history" ON score_history
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY "Agency manages score history" ON score_history
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

-- Portal access — clients read their own score history via the admin client
-- after portal_token validation (no RLS policy needed for that path).
