import type { GHLCustomFieldSpec, GHLPipelineSpec } from "@/lib/ghl/api";
import { GHL_FIELD_KEYS } from "@/lib/ghl/field-keys";

/**
 * The 9 custom fields the RoundTrack Pro GHL snapshot expects. Created in an
 * agency's GHL location by the "Setup GHL Custom Fields" admin tool.
 *
 * NOTE: `fieldKey` is documentation only — GHL derives the real key from the
 * field NAME on creation (so "CDP - Portal Link" → `cdp__portal_link`). The
 * values below are pinned to `GHL_FIELD_KEYS` so this file, the write side, and
 * the merge-tag docs never drift apart. If you change a NAME, re-derive its key.
 *
 * REBRAND NOTE (ClientDeck Pro → RoundTrack Pro): field NAMES deliberately keep
 * the "CDP - " prefix. GHL generates the stored key from the name, so renaming
 * to "RTP - " would produce `rtp__*` keys and break the `cdp__*` mapping that
 * existing agency installations (and this codebase) depend on. Keep "CDP - ".
 * Field keys can be migrated later when agencies reinstall the GHL snapshot.
 */
export const CDP_CUSTOM_FIELDS: GHLCustomFieldSpec[] = [
  { name: "CDP - Round Number", fieldKey: GHL_FIELD_KEYS.ROUND_NUMBER, dataType: "NUMERICAL" },
  { name: "CDP - Items Deleted", fieldKey: GHL_FIELD_KEYS.ITEMS_DELETED, dataType: "NUMERICAL" },
  { name: "CDP - Total Items", fieldKey: GHL_FIELD_KEYS.TOTAL_ITEMS, dataType: "NUMERICAL" },
  { name: "CDP - Next Dispute Date", fieldKey: GHL_FIELD_KEYS.NEXT_DISPUTE_DATE, dataType: "DATE" },
  { name: "CDP - EQ Score", fieldKey: GHL_FIELD_KEYS.EQ_SCORE, dataType: "NUMERICAL" },
  { name: "CDP - EXP Score", fieldKey: GHL_FIELD_KEYS.EXP_SCORE, dataType: "NUMERICAL" },
  { name: "CDP - TU Score", fieldKey: GHL_FIELD_KEYS.TU_SCORE, dataType: "NUMERICAL" },
  { name: "CDP - Portal Link", fieldKey: GHL_FIELD_KEYS.PORTAL_LINK, dataType: "TEXT" },
  { name: "CDP - Client ID", fieldKey: GHL_FIELD_KEYS.CLIENT_ID, dataType: "TEXT" },
];

/**
 * Additional fields carrying tag-notification event data (Session 7 Final).
 * Created alongside CDP_CUSTOM_FIELDS by the same setup tools.
 */
export const CDP_NOTIFICATION_FIELDS: GHLCustomFieldSpec[] = [
  { name: "CDP - Items Disputed", fieldKey: GHL_FIELD_KEYS.ITEMS_DISPUTED, dataType: "NUMERICAL" },
  { name: "CDP - Deletions This Round", fieldKey: GHL_FIELD_KEYS.DELETIONS_THIS_ROUND, dataType: "NUMERICAL" },
  { name: "CDP - Deleted Items List", fieldKey: GHL_FIELD_KEYS.DELETED_ITEMS_LIST, dataType: "TEXT" },
  { name: "CDP - Score Improvement", fieldKey: GHL_FIELD_KEYS.SCORE_IMPROVEMENT, dataType: "NUMERICAL" },
  { name: "CDP - Monthly Fee", fieldKey: GHL_FIELD_KEYS.MONTHLY_FEE, dataType: "TEXT" },
  { name: "CDP - Agency Phone", fieldKey: GHL_FIELD_KEYS.AGENCY_PHONE, dataType: "TEXT" },
  { name: "CDP - Google Review Link", fieldKey: GHL_FIELD_KEYS.GOOGLE_REVIEW_LINK, dataType: "TEXT" },
];

/** All 16 fields — used by both the admin and agency-self-service setup tools. */
export const CDP_ALL_CUSTOM_FIELDS: GHLCustomFieldSpec[] = [
  ...CDP_CUSTOM_FIELDS,
  ...CDP_NOTIFICATION_FIELDS,
];

/** The two pipelines the CDP snapshot sets up. */
export const CDP_PIPELINES: GHLPipelineSpec[] = [
  {
    name: "Credit Sales",
    stages: [
      "New Lead",
      "Contacted",
      "Consultation Booked",
      "Agreement Sent",
      "Signed / Won",
      "Lost",
    ],
  },
  {
    name: "Active Client",
    stages: [
      "Onboarding",
      "Analysis",
      "Round 1 Sent",
      "Awaiting Response",
      "Round 2+",
      "Goal Achieved",
    ],
  },
];
