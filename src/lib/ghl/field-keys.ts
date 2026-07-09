// ============================================================================
// GHL Custom Field Keys for ClientDeck Pro — SINGLE SOURCE OF TRUTH
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
} as const;

export type GHLFieldKey = (typeof GHL_FIELD_KEYS)[keyof typeof GHL_FIELD_KEYS];
