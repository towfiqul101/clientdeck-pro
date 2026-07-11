-- ============================================
-- 021: Make subscribed_notification_types nullable
--
-- Distinguishes "never configured" (NULL — apply the role-based default:
-- owner gets all 3 staff-facing types, everyone else gets none) from
-- "explicitly configured to nothing" (an empty array — a real save with
-- every toggle off, which must stick). With a NOT NULL '{}' default these
-- two cases were indistinguishable, so an owner who deliberately unchecked
-- everything would silently revert to "subscribed to all" on the next
-- event. Safe to backfill unconditionally here since this column was only
-- just introduced in migration 020 — no real user has saved a deliberate
-- empty selection yet, so every existing '{}' row is genuinely "unset".
-- ============================================

ALTER TABLE team_members ALTER COLUMN subscribed_notification_types DROP DEFAULT;
ALTER TABLE team_members ALTER COLUMN subscribed_notification_types DROP NOT NULL;

UPDATE team_members
SET subscribed_notification_types = NULL
WHERE subscribed_notification_types = '{}';
