-- ============================================
-- 032: staff push subscriptions
--
-- Extends push_subscriptions (migration 022, client-portal only) so the same
-- VAPID/web-push plumbing can also push to staff in the dashboard.
-- client_id is no longer NOT NULL; a CHECK enforces every row has exactly
-- one owner, so the endpoint upsert (onConflict: "endpoint") can never
-- silently reassign a subscription from one owner type to the other if the
-- same browser endpoint is ever reused across a client-portal session and a
-- staff dashboard session on the same device.
-- ============================================

ALTER TABLE push_subscriptions ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE push_subscriptions
  ADD COLUMN team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_exactly_one_owner
  CHECK (
    (client_id IS NOT NULL AND team_member_id IS NULL) OR
    (client_id IS NULL AND team_member_id IS NOT NULL)
  );

CREATE INDEX idx_push_subscriptions_team_member ON push_subscriptions(team_member_id);
