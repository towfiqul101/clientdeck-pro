-- ============================================
-- 023: letter compliance checks
-- Rule-based (non-AI) pre-send checks run right after letter generation
-- (src/lib/compliance/validate-letter.ts) — missing statutory citation,
-- unresolved template placeholders, suspiciously short output, and output
-- that's near-identical to the raw unfilled template. Surfaced as a badge
-- in the letter review UI and in the round-level summary shown before
-- "Mark Round as Sent".
-- ============================================

ALTER TABLE disputes
  ADD COLUMN compliance_status TEXT CHECK (compliance_status IN ('pass', 'flagged')),
  ADD COLUMN compliance_checks JSONB,
  ADD COLUMN compliance_checked_at TIMESTAMPTZ;
