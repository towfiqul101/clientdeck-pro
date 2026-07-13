// ============================================================================
// GHL Custom Field Keys for RoundTrack Pro — SINGLE SOURCE OF TRUTH
// ----------------------------------------------------------------------------
// These keys MUST match the field keys GHL actually stores. GHL auto-generates
// a field's key from its NAME when the field is created: it lowercases, turns
// spaces into underscores, and strips other punctuation. So the setup field
// named "CDP - Portal Link" becomes key `cdp__portal_link` — the " - " collapses
// to a DOUBLE underscore. Every key below is the real GHL-generated key for the
// matching field in `setup-config.ts` (verified against a live GHL location).
//
// GHL silently ignores writes to non-existent keys (no error), so a mismatch
// here shows up as "custom fields exist but are always empty (--)". Do not
// rename a key here without renaming the corresponding field in GHL.
//
// Merge tags in GHL workflows reference these as `{{contact.<key>}}`, e.g.
// `{{contact.cdp__portal_link}}`.
//
// REBRAND NOTE (ClientDeck Pro → RoundTrack Pro): keys retain the `cdp__`
// prefix for backward compatibility with existing GHL installations from the
// ClientDeck Pro era. Fresh installs still see field names as "CDP - ..." so
// GHL keeps deriving these same `cdp__` keys. Do NOT switch to `rtp__` here
// unless every agency also recreates their GHL fields with "RTP - " names.
// ============================================================================

export const GHL_FIELD_KEYS = {
  // Core tracking
  PORTAL_LINK: "cdp__portal_link",
  CLIENT_ID: "cdp__client_id",
  ROUND_NUMBER: "cdp__round_number",

  // Item counts
  ITEMS_DELETED: "cdp__items_deleted",
  TOTAL_ITEMS: "cdp__total_items",
  ITEMS_DISPUTED: "cdp__items_disputed",

  // Round-specific notification data
  DELETIONS_THIS_ROUND: "cdp__deletions_this_round",
  DELETED_ITEMS_LIST: "cdp__deleted_items_list",
  NEXT_DISPUTE_DATE: "cdp__next_dispute_date",

  // Scores
  EQ_SCORE: "cdp__eq_score",
  EXP_SCORE: "cdp__exp_score",
  TU_SCORE: "cdp__tu_score",
  SCORE_IMPROVEMENT: "cdp__score_improvement",

  // Payment / contact
  MONTHLY_FEE: "cdp__monthly_fee",
  AGENCY_PHONE: "cdp__agency_phone",
  GOOGLE_REVIEW_LINK: "cdp__google_review_link",

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
  // NAME "CDP - SSN Last 4", turning each space into an underscore. Verified
  // against the same derivation that produces `cdp__eq_score` from "CDP - EQ
  // Score". Getting this wrong creates the field fine and then reads it as
  // permanently empty.
  SSN_LAST4: "cdp__ssn_last_4",
  DOB: "cdp__dob",
  SIGNATURE_STATUS: "cdp__signature_status",
  SIGNATURE_DATE: "cdp__signature_date",
  ID_DOCUMENT: "cdp__id_document",
  PROOF_OF_ADDRESS: "cdp__proof_of_address",
  CREDIT_REPORT_EQ: "cdp__credit_report_eq",
  CREDIT_REPORT_EXP: "cdp__credit_report_exp",
  CREDIT_REPORT_TU: "cdp__credit_report_tu",
} as const;

export type GHLFieldKey = (typeof GHL_FIELD_KEYS)[keyof typeof GHL_FIELD_KEYS];
