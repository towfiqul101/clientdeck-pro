CREATE TABLE snapshot_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  ghl_location_id TEXT,
  agency_name TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'installed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reads/writes only through the service-role client (public insert via server
-- action, admin read via service role). RLS on with no policies = deny all to
-- anon/authenticated; service role bypasses RLS.
ALTER TABLE snapshot_requests ENABLE ROW LEVEL SECURITY;
