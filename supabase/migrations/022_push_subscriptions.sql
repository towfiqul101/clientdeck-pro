-- ============================================
-- 022: push_subscriptions
-- Web Push subscriptions for the client portal (PWA). A client may have
-- multiple subscriptions (one per browser/device they enabled push on).
-- The full PushSubscription object (endpoint + keys) is stored as-is in
-- `subscription` since that's exactly what web-push's sendNotification()
-- needs verbatim.
-- ============================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  endpoint TEXT GENERATED ALWAYS AS (subscription->>'endpoint') STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_client ON push_subscriptions(client_id);
CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Portal-side reads/writes use the service-role client (no Supabase Auth
-- session to scope RLS against — same pattern as every other portal table,
-- e.g. message_origins). No agency-staff policy is needed: subscriptions
-- are only ever written/read/deleted by the portal route and the push
-- sender, both of which use createAdminClient().
