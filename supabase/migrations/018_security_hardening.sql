-- 018_security_hardening.sql
-- Fable 5 security audit: defense-in-depth hardening.
--
-- Adds the missing UPDATE policy on documents. The table already has
-- SELECT / INSERT / DELETE policies (002_rls_policies.sql) but no UPDATE
-- policy — harmless today (no update code path), added as defense-in-depth.
-- Run in the Supabase SQL Editor.

-- Postgres has no CREATE POLICY IF NOT EXISTS, so guard for idempotency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents' AND policyname = 'Agency updates own docs'
  ) THEN
    CREATE POLICY "Agency updates own docs" ON documents
      FOR UPDATE
      USING (agency_id = get_user_agency_id())
      WITH CHECK (agency_id = get_user_agency_id());
  END IF;
END $$;

COMMENT ON POLICY "Agency sees own docs" ON documents IS
  'RLS: staff can only see documents belonging to their agency';
