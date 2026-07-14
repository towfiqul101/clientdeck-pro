-- ============================================
-- 033: staff_notifications
--
-- In-app notification feed for staff, delivered alongside (never instead
-- of) the existing GHL-tag/Resend channel in src/lib/ghl/notifications.ts.
-- Rows are written only by the server-side notification pipeline
-- (createAdminClient(), bypasses RLS) for the 4 staff-facing types, using
-- the same recipient list resolveStaffRecipients() already computes for
-- GHL/email — no separate routing logic exists here. Reads and mark-read
-- happen through the authenticated staff session (RLS-scoped to the
-- requesting team member).
-- ============================================

CREATE TABLE staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_notifications_recipient
  ON staff_notifications(team_member_id, created_at DESC);

ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;

-- No INSERT policy: rows are written only by createAdminClient() (service
-- role, bypasses RLS) from src/lib/ghl/notifications.ts. An authenticated
-- staff session can never create a notification for themselves or anyone
-- else.
CREATE POLICY "Staff see own notifications" ON staff_notifications
  FOR SELECT USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Staff mark own notifications read" ON staff_notifications
  FOR UPDATE USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
