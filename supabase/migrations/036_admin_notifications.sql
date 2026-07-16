-- ============================================
-- 036: admin_notifications
--
-- Cross-agency notification feed for the SUPER-ADMIN (/admin panel), which
-- authenticates with the standalone password/cookie session — NOT Supabase
-- Auth. staff_notifications (033) can't serve this: its rows require a
-- team_member_id/agency_id owner and its RLS resolves through auth.uid(),
-- neither of which the super-admin has.
--
-- Rows are written ONLY via createAdminClient() (service role) from
-- src/lib/admin/notify.ts. Reads and mark-read happen through
-- requireAdmin()-guarded routes (/api/admin/notifications/*), also on the
-- service-role client. RLS is enabled with NO policies: anon/authenticated
-- roles can never touch this table.
-- ============================================

CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  -- Nullable: security events (bad webhook credential, invalid API key) often
  -- can't be attributed to an agency. SET NULL keeps the audit row if the
  -- agency is deleted.
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_admin_notifications_created
  ON admin_notifications(created_at DESC);

-- Serves the throttle lookup in notifyAdmin(): "was (type, agency_id) already
-- notified in the last 24h?"
CREATE INDEX idx_admin_notifications_throttle
  ON admin_notifications(type, agency_id, created_at DESC);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
