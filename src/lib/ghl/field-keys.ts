// ============================================================================
// GHL Custom Field Keys for RoundTrack Pro — SINGLE SOURCE OF TRUTH
// ----------------------------------------------------------------------------
// These keys MUST match the field keys GHL actually stores. GHL auto-generates
// a field's key from its NAME when the field is created: it lowercases, turns
// spaces into underscores, and strips other punctuation. So the setup field
// named "RTP - Portal Link" becomes key `rtp__portal_link` — the " - " collapses
// to a DOUBLE underscore. Every key below is the real GHL-generated key for the
// matching field in `setup-config.ts` (verified against a live GHL location).
//
// GHL silently ignores writes to non-existent keys (no error), so a mismatch
// here shows up as "custom fields exist but are always empty (--)". Do not
// rename a key here without renaming the corresponding field in GHL.
//
// Merge tags in GHL workflows reference these as `{{contact.<key>}}`, e.g.
// `{{contact.rtp__portal_link}}`.
//
// RENAME NOTE (2026-07): these were `cdp__*` (from the ClientDeck Pro era) and
// were renamed to `rtp__*` in a CLEAN BREAK — no dual-support period. GHL derives
// the stored key from the field NAME, so the "RTP - ..." names in setup-config.ts
// are what produce these keys. The old `cdp__*` fields still physically exist in
// any GHL location that ran the old setup tool; they are orphaned and can be
// deleted by hand. Every `{{contact.cdp__*}}` merge tag in an agency's GHL
// workflows must be repointed to `{{contact.rtp__*}}` or it renders blank.
// ============================================================================

export const GHL_FIELD_KEYS = {
  // Core tracking
  PORTAL_LINK: "rtp__portal_link",
  CLIENT_ID: "rtp__client_id",
  ROUND_NUMBER: "rtp__round_number",

  // Item counts
  ITEMS_DELETED: "rtp__items_deleted",
  TOTAL_ITEMS: "rtp__total_items",
  ITEMS_DISPUTED: "rtp__items_disputed",

  // Round-specific notification data
  DELETIONS_THIS_ROUND: "rtp__deletions_this_round",
  DELETED_ITEMS_LIST: "rtp__deleted_items_list",
  NEXT_DISPUTE_DATE: "rtp__next_dispute_date",

  // Scores
  EQ_SCORE: "rtp__eq_score",
  EXP_SCORE: "rtp__exp_score",
  TU_SCORE: "rtp__tu_score",
  SCORE_IMPROVEMENT: "rtp__score_improvement",

  // Payment / contact
  MONTHLY_FEE: "rtp__monthly_fee",
  AGENCY_PHONE: "rtp__agency_phone",
  GOOGLE_REVIEW_LINK: "rtp__google_review_link",

  // ── Identity / onboarding intake (RTP-owned, READ side) ───────────────────
  // These 9 were previously agency-configurable rows in Settings → GHL, mapped
  // onto whatever field the agency happened to have. In a GHL location shared
  // with other products (TaxIntake Pro `ti__*`, Due Diligence Pro `dd_*`) the
  // name-matching heuristic collided catastrophically — "Equifax Score" resolved
  // to a field literally named "Equifax Password", and "SSN Last 4" to a
  // *dependent's* SSN. Owning these keys ourselves removes the ambiguity: the
  // onboarding webhook now reads them by fixed key, never by agency mapping.
  //
  // NOTE: the agency's GHL onboarding form/workflow must be updated to WRITE
  // into these fields — that part cannot be automated (see the banner in
  // Settings → GHL).
  // NOTE the key is `..._last_4`, not `..._last4`: GHL derives the key from the
  // NAME "RTP - SSN Last 4", turning each space into an underscore. Verified
  // against the same derivation that produces `rtp__eq_score` from "RTP - EQ
  // Score". Getting this wrong creates the field fine and then reads it as
  // permanently empty.
  SSN_LAST4: "rtp__ssn_last_4",
  DOB: "rtp__dob",
  SIGNATURE_STATUS: "rtp__signature_status",
  SIGNATURE_DATE: "rtp__signature_date",
  ID_DOCUMENT: "rtp__id_document",
  PROOF_OF_ADDRESS: "rtp__proof_of_address",
  CREDIT_REPORT_EQ: "rtp__credit_report_eq",
  CREDIT_REPORT_EXP: "rtp__credit_report_exp",
  CREDIT_REPORT_TU: "rtp__credit_report_tu",

  // ── Staff-alert data ──────────────────────────────────────────────────────
  // Staff alerts (new client / round overdue / next round ready) now tag the
  // CLIENT's contact rather than a staff member's, so the agency's workflow can
  // read that client's merge fields. These three carry the alert-specific values
  // the client's own fields don't have.
  //
  // They are deliberately NOT reusing ROUND_NUMBER. `staff_next_round_ready`
  // carries the round about to be prepared (N+1), which has not been sent — and
  // ROUND_NUMBER is the field the client-facing "Round Sent" and "Monthly
  // Update" messages read. Writing a future round there would make the CLIENT's
  // own SMS quote a round that hasn't happened yet.
  ALERT_ROUND_NUMBER: "rtp__alert_round_number",
  ALERT_DAYS_OVERDUE: "rtp__alert_days_overdue",
  ALERT_DASHBOARD_LINK: "rtp__alert_dashboard_link",
} as const;

export type GHLFieldKey = (typeof GHL_FIELD_KEYS)[keyof typeof GHL_FIELD_KEYS];
