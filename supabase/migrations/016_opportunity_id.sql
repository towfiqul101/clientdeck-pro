-- 016_opportunity_id.sql — GHL opportunity id cache for pipeline-stage sync
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ghl_opportunity_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_opportunity ON clients(ghl_opportunity_id);
