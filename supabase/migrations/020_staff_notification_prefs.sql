-- ============================================
-- 020: Per-staff notification preferences
--
-- Replaces the single agencies.settings.owner_ghl_contact_id target for the
-- 3 staff-facing notification types (staff_new_client, staff_round_overdue,
-- staff_next_round_ready) with per-team-member opt-in. A plain text array
-- fits better than a junction table here — there's no need to query "which
-- staff want type X" independently of "what does staff member Y want",
-- and team_members has no existing precedent for a settings-style jsonb
-- blob the way agencies does.
--
-- Empty array is the default for everyone. An OWNER with an empty array is
-- treated as subscribed to all 3 types at the application layer (backward
-- compatibility with the old single-owner-target behavior) — see
-- src/lib/team/notification-prefs.ts. Non-owners default to none.
-- ============================================

ALTER TABLE team_members
  ADD COLUMN subscribed_notification_types TEXT[] NOT NULL DEFAULT '{}';
