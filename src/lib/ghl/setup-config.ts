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
