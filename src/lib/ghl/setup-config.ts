import type { GHLCustomFieldSpec, GHLPipelineSpec } from "@/lib/ghl/api";
import { GHL_FIELD_KEYS } from "@/lib/ghl/field-keys";

/**
 * The 9 core tracking fields. Created in an
 * agency's GHL location by the "Setup GHL Custom Fields" admin tool.
 *
 * NOTE: `fieldKey` is documentation only — GHL derives the real key from the
 * field NAME on creation (so "RTP - Portal Link" → `rtp__portal_link`). The
 * values below are pinned to `GHL_FIELD_KEYS` so this file, the write side, and
 * the merge-tag docs never drift apart. If you change a NAME, re-derive its key.
 *
 * RENAME NOTE (2026-07): names were "CDP - ..." and are now "RTP - ...". Because
 * GHL derives the stored key from the NAME, this is what changes the keys from
 * `cdp__*` to `rtp__*`. Running the setup tool against a location that already has
 * the old fields CREATES NEW ONES — it does not rename them. The old `cdp__*`
 * fields are left orphaned and should be deleted by hand once workflows are
 * repointed.
 */
export const RTP_CUSTOM_FIELDS: GHLCustomFieldSpec[] = [
  { name: "RTP - Round Number", fieldKey: GHL_FIELD_KEYS.ROUND_NUMBER, dataType: "NUMERICAL" },
  { name: "RTP - Items Deleted", fieldKey: GHL_FIELD_KEYS.ITEMS_DELETED, dataType: "NUMERICAL" },
  { name: "RTP - Total Items", fieldKey: GHL_FIELD_KEYS.TOTAL_ITEMS, dataType: "NUMERICAL" },
  { name: "RTP - Next Dispute Date", fieldKey: GHL_FIELD_KEYS.NEXT_DISPUTE_DATE, dataType: "DATE" },
  { name: "RTP - EQ Score", fieldKey: GHL_FIELD_KEYS.EQ_SCORE, dataType: "NUMERICAL" },
  { name: "RTP - EXP Score", fieldKey: GHL_FIELD_KEYS.EXP_SCORE, dataType: "NUMERICAL" },
  { name: "RTP - TU Score", fieldKey: GHL_FIELD_KEYS.TU_SCORE, dataType: "NUMERICAL" },
  { name: "RTP - Portal Link", fieldKey: GHL_FIELD_KEYS.PORTAL_LINK, dataType: "TEXT" },
  { name: "RTP - Client ID", fieldKey: GHL_FIELD_KEYS.CLIENT_ID, dataType: "TEXT" },
];

/**
 * Additional fields carrying tag-notification event data (Session 7 Final).
 * Created alongside RTP_CUSTOM_FIELDS by the same setup tools.
 */
export const RTP_NOTIFICATION_FIELDS: GHLCustomFieldSpec[] = [
  { name: "RTP - Items Disputed", fieldKey: GHL_FIELD_KEYS.ITEMS_DISPUTED, dataType: "NUMERICAL" },
  { name: "RTP - Deletions This Round", fieldKey: GHL_FIELD_KEYS.DELETIONS_THIS_ROUND, dataType: "NUMERICAL" },
  { name: "RTP - Deleted Items List", fieldKey: GHL_FIELD_KEYS.DELETED_ITEMS_LIST, dataType: "TEXT" },
  { name: "RTP - Score Improvement", fieldKey: GHL_FIELD_KEYS.SCORE_IMPROVEMENT, dataType: "NUMERICAL" },
  { name: "RTP - Monthly Fee", fieldKey: GHL_FIELD_KEYS.MONTHLY_FEE, dataType: "TEXT" },
  { name: "RTP - Agency Phone", fieldKey: GHL_FIELD_KEYS.AGENCY_PHONE, dataType: "TEXT" },
  { name: "RTP - Google Review Link", fieldKey: GHL_FIELD_KEYS.GOOGLE_REVIEW_LINK, dataType: "TEXT" },
];

/**
 * Identity / intake fields RoundTrack Pro OWNS and READS from (Option B).
 *
 * Previously these were agency-configurable mapping rows pointed at whatever
 * field the agency already had. In a GHL location shared with TaxIntake Pro
 * (`ti__*`) and Due Diligence Pro (`dd_*`) that produced real cross-product
 * contamination — auto-detect resolved "Equifax Score" to a field named
 * "Equifax Password", and "SSN Last 4" to a *dependent's* SSN. Fixed keys make
 * the collision impossible.
 *
 * The agency must update their own GHL onboarding form/workflow to write into
 * these fields; creating them here does not populate them.
 */
export const RTP_IDENTITY_FIELDS: GHLCustomFieldSpec[] = [
  { name: "RTP - SSN Last 4", fieldKey: GHL_FIELD_KEYS.SSN_LAST4, dataType: "TEXT" },
  { name: "RTP - DOB", fieldKey: GHL_FIELD_KEYS.DOB, dataType: "DATE" },
  // TEXT, not a boolean/option type: extractClientData derives signed-ness with
  // /^(signed|yes|true|complete)/i against the raw string value.
  { name: "RTP - Signature Status", fieldKey: GHL_FIELD_KEYS.SIGNATURE_STATUS, dataType: "TEXT" },
  { name: "RTP - Signature Date", fieldKey: GHL_FIELD_KEYS.SIGNATURE_DATE, dataType: "DATE" },
  { name: "RTP - ID Document", fieldKey: GHL_FIELD_KEYS.ID_DOCUMENT, dataType: "FILE_UPLOAD" },
  { name: "RTP - Proof of Address", fieldKey: GHL_FIELD_KEYS.PROOF_OF_ADDRESS, dataType: "FILE_UPLOAD" },
  { name: "RTP - Credit Report EQ", fieldKey: GHL_FIELD_KEYS.CREDIT_REPORT_EQ, dataType: "FILE_UPLOAD" },
  { name: "RTP - Credit Report EXP", fieldKey: GHL_FIELD_KEYS.CREDIT_REPORT_EXP, dataType: "FILE_UPLOAD" },
  { name: "RTP - Credit Report TU", fieldKey: GHL_FIELD_KEYS.CREDIT_REPORT_TU, dataType: "FILE_UPLOAD" },
];

/**
 * Onboarding Details intake fields RoundTrack Pro OWNS and READS from — same
 * model as RTP_IDENTITY_FIELDS above. Standard onboarding-form data (credit
 * self-report, program fit, employment/bankruptcy screening, and any
 * concerns raised at signup), not a secondary sales-qualification step.
 *
 * The agency must update their own GHL onboarding form/workflow to write
 * into these fields; creating them here does not populate them.
 */
export const RTP_ONBOARDING_INTAKE_FIELDS: GHLCustomFieldSpec[] = [
  { name: "RTP - Credit Score Range", fieldKey: GHL_FIELD_KEYS.CREDIT_SCORE_RANGE, dataType: "TEXT" },
  { name: "RTP - Reviewed Credit Report Recently", fieldKey: GHL_FIELD_KEYS.REVIEWED_CREDIT_REPORT_RECENTLY, dataType: "TEXT" },
  { name: "RTP - Negative Items Reported", fieldKey: GHL_FIELD_KEYS.NEGATIVE_ITEMS_REPORTED, dataType: "TEXT" },
  { name: "RTP - Enrolled Other Program", fieldKey: GHL_FIELD_KEYS.ENROLLED_OTHER_PROGRAM, dataType: "TEXT" },
  { name: "RTP - Primary Goal", fieldKey: GHL_FIELD_KEYS.PRIMARY_GOAL, dataType: "TEXT" },
  { name: "RTP - Results Timeline", fieldKey: GHL_FIELD_KEYS.RESULTS_TIMELINE, dataType: "TEXT" },
  { name: "RTP - Employment Status", fieldKey: GHL_FIELD_KEYS.EMPLOYMENT_STATUS, dataType: "TEXT" },
  { name: "RTP - Bankruptcy Filed", fieldKey: GHL_FIELD_KEYS.BANKRUPTCY_FILED, dataType: "TEXT" },
  { name: "RTP - Bankruptcy Date", fieldKey: GHL_FIELD_KEYS.BANKRUPTCY_DATE, dataType: "DATE" },
  { name: "RTP - Intake Concerns", fieldKey: GHL_FIELD_KEYS.INTAKE_CONCERNS, dataType: "TEXT" },
];

/**
 * Staff-alert data fields. The 3 staff alerts (new client / round overdue /
 * next round ready) tag the CLIENT's GHL contact, so the agency's workflow can
 * personalise the message with that client's merge fields while still sending
 * to a fixed staff number. These carry the values the client's own fields
 * don't already hold.
 *
 * Client name/email/phone need no field here — on the client's own contact
 * they're the NATIVE {{contact.first_name}} / {{contact.email}} /
 * {{contact.phone}}.
 */
export const RTP_STAFF_ALERT_FIELDS: GHLCustomFieldSpec[] = [
  { name: "RTP - Alert Round Number", fieldKey: GHL_FIELD_KEYS.ALERT_ROUND_NUMBER, dataType: "NUMERICAL" },
  { name: "RTP - Alert Days Overdue", fieldKey: GHL_FIELD_KEYS.ALERT_DAYS_OVERDUE, dataType: "NUMERICAL" },
  { name: "RTP - Alert Dashboard Link", fieldKey: GHL_FIELD_KEYS.ALERT_DASHBOARD_LINK, dataType: "TEXT" },
];

/** All 38 fields — used by both the admin and agency-self-service setup tools. */
export const RTP_ALL_CUSTOM_FIELDS: GHLCustomFieldSpec[] = [
  ...RTP_CUSTOM_FIELDS,
  ...RTP_NOTIFICATION_FIELDS,
  ...RTP_IDENTITY_FIELDS,
  ...RTP_ONBOARDING_INTAKE_FIELDS,
  ...RTP_STAFF_ALERT_FIELDS,
];

/** The two pipelines the RoundTrack Pro snapshot sets up. */
export const RTP_PIPELINES: GHLPipelineSpec[] = [
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
