import type { GHLCustomFieldSpec, GHLPipelineSpec } from "@/lib/ghl/api";

/**
 * The 9 custom fields the ClientDeck Pro GHL snapshot expects. Created in an
 * agency's GHL location by the "Setup GHL Custom Fields" admin tool.
 */
export const CDP_CUSTOM_FIELDS: GHLCustomFieldSpec[] = [
  { name: "CDP - Round Number", fieldKey: "dispute_round_current", dataType: "NUMERICAL" },
  { name: "CDP - Items Deleted", fieldKey: "items_deleted_total", dataType: "NUMERICAL" },
  { name: "CDP - Total Items", fieldKey: "total_negative_items", dataType: "NUMERICAL" },
  { name: "CDP - Next Dispute Date", fieldKey: "next_dispute_date", dataType: "DATE" },
  { name: "CDP - EQ Score", fieldKey: "credit_score_eq_current", dataType: "NUMERICAL" },
  { name: "CDP - EXP Score", fieldKey: "credit_score_exp_current", dataType: "NUMERICAL" },
  { name: "CDP - TU Score", fieldKey: "credit_score_tu_current", dataType: "NUMERICAL" },
  { name: "CDP - Portal Link", fieldKey: "clientdeck_portal_link", dataType: "TEXT" },
  { name: "CDP - Client ID", fieldKey: "clientdeck_client_id", dataType: "TEXT" },
];

/**
 * Additional fields carrying tag-notification event data (Session 7 Final).
 * Created alongside CDP_CUSTOM_FIELDS by the same setup tools.
 */
export const CDP_NOTIFICATION_FIELDS: GHLCustomFieldSpec[] = [
  { name: "CDP - Items Disputed", fieldKey: "cdp_items_disputed", dataType: "NUMERICAL" },
  { name: "CDP - Deletions This Round", fieldKey: "cdp_deletions_this_round", dataType: "NUMERICAL" },
  { name: "CDP - Deleted Items List", fieldKey: "cdp_deleted_items_list", dataType: "TEXT" },
  { name: "CDP - Score Improvement", fieldKey: "cdp_score_improvement", dataType: "NUMERICAL" },
  { name: "CDP - Monthly Fee", fieldKey: "cdp_monthly_fee", dataType: "TEXT" },
  { name: "CDP - Agency Phone", fieldKey: "cdp_agency_phone", dataType: "TEXT" },
  { name: "CDP - Google Review Link", fieldKey: "cdp_google_review_link", dataType: "TEXT" },
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
