-- 013_client_assignment.sql — client → team-member assignment
ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  assigned_to UUID REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS
  assigned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_clients_assigned ON clients(agency_id, assigned_to);
