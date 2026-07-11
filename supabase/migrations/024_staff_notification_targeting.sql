-- ============================================
-- 024: Expanded staff-notification targeting
--
-- Two additions on top of migration 020/021's per-staff global opt-in:
--
-- 1. team_members.ghl_contact_id — lets any staff member (not just the
--    owner, via agencies.settings.owner_ghl_contact_id) receive GHL-tag
--    notifications through their own GHL contact, instead of being limited
--    to the Resend email fallback. Available on every plan.
--
-- 2. clients.notify_team_member_ids — per-client extra recipients. The
--    baseline recipients for a client's staff-facing events are computed
--    in application code (src/lib/ghl/notifications.ts): the globally
--    opted-in staff (owner by default) plus that client's assigned staff
--    member (for round-overdue/next-round-ready/monthly-progress) or
--    owner+admin (for new-client onboarding, since nobody's assigned yet).
--    This column adds specific additional staff on top, per client — e.g.
--    a manager who wants visibility into one particular case without
--    subscribing to every client's events globally.
-- ============================================

ALTER TABLE team_members ADD COLUMN ghl_contact_id TEXT;
ALTER TABLE clients ADD COLUMN notify_team_member_ids UUID[] NOT NULL DEFAULT '{}';
