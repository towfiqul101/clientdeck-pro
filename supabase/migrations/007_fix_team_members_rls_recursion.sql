-- ============================================
-- ClientDeck Pro — Fix infinite recursion in team_members RLS
-- ============================================
-- The original "Owners manage team" policy (migration 002) was FOR ALL and its
-- USING clause sub-queried team_members directly. Evaluating a SELECT on
-- team_members therefore re-evaluated the same policy → "infinite recursion
-- detected in policy for relation team_members". This blocked getSessionContext
-- and bounced every dashboard load back to /login.
--
-- Fix: use the existing SECURITY DEFINER helpers (get_user_agency_id /
-- is_agency_owner), which run with the definer's rights and BYPASS RLS, so they
-- can read team_members without re-triggering the policy.

DROP POLICY IF EXISTS "Owners manage team" ON team_members;

CREATE POLICY "Owners manage team" ON team_members
  FOR ALL
  USING (agency_id = get_user_agency_id() AND is_agency_owner())
  WITH CHECK (agency_id = get_user_agency_id() AND is_agency_owner());
