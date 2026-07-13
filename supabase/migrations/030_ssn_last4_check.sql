-- 030_ssn_last4_check.sql — Backstop for the "NEVER store full SSN" rule.
--
-- The GHL onboarding webhook previously wrote the mapped GHL field's value
-- into clients.ssn_last4 verbatim (see the fix in extractClientData,
-- src/app/api/ghl/onboarding/route.ts). Because the auto-detect heuristic
-- matches GHL fields named "SSN"/"Social Security Number" — which normally
-- hold the FULL number — a full SSN could land in this column and then flow
-- into CSV exports and the Claude letter prompt.
--
-- The webhook is fixed, but a DB-level constraint means no future code path,
-- however it's introduced, can slip a longer value in again. The dashboard
-- form and CSV import already enforce the same 4-digit rule in application
-- code; this makes the database the source of truth.
--
-- !! PREREQUISITE !!
-- Postgres will REFUSE to add this constraint if any existing row violates
-- it. Run the read-only audit first:
--
--   SELECT agency_id, id, length(ssn_last4)
--   FROM clients
--   WHERE ssn_last4 IS NOT NULL AND ssn_last4 !~ '^\d{4}$';
--
-- Any rows returned must be remediated (a decision that may need human/legal
-- sign-off, since it concerns already-stored sensitive data) BEFORE this
-- migration can be applied.

ALTER TABLE clients
  ADD CONSTRAINT clients_ssn_last4_check
  CHECK (ssn_last4 IS NULL OR ssn_last4 ~ '^\d{4}$');
