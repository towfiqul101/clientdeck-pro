-- ============================================
-- 037: admin_notification_recipients
--
-- Who receives super-admin notification EMAILS (the /admin bell shows them
-- regardless). Cross-agency superadmin config — deliberately NO agency_id.
-- Written/read only via createAdminClient() from the requireAdmin()-guarded
-- /admin/settings UI and src/lib/admin/notify.ts; RLS enabled with NO
-- policies, same service-role-only posture as admin_notifications (036).
--
-- The cap of 3 recipients is enforced in the management UI/action, not here —
-- the only writer is the admin panel itself.
--
-- This table REPLACES the ADMIN_NOTIFY_EMAIL env var design (which never
-- shipped — it existed only in an uncommitted working tree). ADMIN_EMAIL is
-- unrelated and keeps its original "audit label only" meaning.
-- ============================================

CREATE TABLE admin_notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_notification_recipients ENABLE ROW LEVEL SECURITY;
