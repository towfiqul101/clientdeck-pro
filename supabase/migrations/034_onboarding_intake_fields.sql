-- 034_onboarding_intake_fields.sql — 10 onboarding intake fields on `clients`.
--
-- Standard onboarding-form data (credit-history self-report, program fit,
-- employment/bankruptcy screening, and any concerns the client raised at
-- signup) — not a secondary sales-qualification step, hence "Onboarding
-- Details" rather than "Intake Details" everywhere this surfaces.
--
-- All 10 are nullable with no default: they're populated by the GHL
-- onboarding webhook (see RTP_IDENTITY_ONBOARDING_FIELDS / GHL_FIELD_KEYS)
-- when the agency's own onboarding form captures them, same as ssn_last4/dob
-- above. A value staying NULL means "not captured," not "no."
--
-- credit_score_range / results_timeline / employment_status are enums typed
-- CHECK (col IS NULL OR col IN (...)) — same pattern as ssn_last4 (migration
-- 030): an unrecognized value coming from GHL is normalized best-effort by
-- the webhook and dropped to NULL rather than raised as a DB error, so this
-- constraint can never break the onboarding insert/update.

ALTER TABLE clients
  ADD COLUMN credit_score_range TEXT CHECK (credit_score_range IS NULL OR credit_score_range IN (
    'below_580', '580_669', '670_739', '740_799', '800_plus', 'not_sure'
  )),
  ADD COLUMN reviewed_credit_report_recently BOOLEAN,
  ADD COLUMN negative_items_reported BOOLEAN,
  ADD COLUMN enrolled_other_program BOOLEAN,
  ADD COLUMN primary_goal TEXT,
  ADD COLUMN results_timeline TEXT CHECK (results_timeline IS NULL OR results_timeline IN (
    'asap', '3_months', '6_months', '1_year', 'no_rush'
  )),
  ADD COLUMN employment_status TEXT CHECK (employment_status IS NULL OR employment_status IN (
    'employed', 'self_employed', 'unemployed', 'retired', 'student', 'other'
  )),
  ADD COLUMN bankruptcy_filed BOOLEAN,
  ADD COLUMN bankruptcy_date DATE,
  ADD COLUMN intake_concerns TEXT;
