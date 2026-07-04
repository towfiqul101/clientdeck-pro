// ============================================
// ClientDeck Pro — TypeScript Types
// ============================================

export type Plan = "solo" | "pro" | "agency" | "enterprise";
export type PlanStatus = "trialing" | "active" | "past_due" | "cancelled" | "paused";
export type TeamRole = "owner" | "admin" | "staff" | "viewer";

export type ClientStatus = "onboarding" | "analysis" | "active" | "on_hold" | "completed" | "cancelled";
export type PaymentStatus = "active" | "failed" | "paused" | "cancelled" | "pending";
export type CreditGoal = "buy_home" | "car_loan" | "lower_rates" | "get_approved" | "improve_general" | "business_loan" | "rental" | "other";

export type Bureau = "equifax" | "experian" | "transunion";
export type AccountType = "credit_card" | "auto_loan" | "mortgage" | "personal_loan" | "student_loan" | "medical" | "collection" | "utility" | "other";
export type NegativeType = "late_payment" | "collection" | "charge_off" | "repossession" | "bankruptcy" | "foreclosure" | "tax_lien" | "judgment" | "inquiry" | "identity_theft" | "other";
export type DisputeStatus = "not_disputed" | "in_dispute" | "deleted" | "updated" | "verified" | "pending";

export type RoundStatus = "preparing" | "letters_generated" | "sent" | "awaiting_response" | "complete";
export type LetterType = "initial_dispute" | "method_of_verification" | "escalation" | "goodwill" | "debt_validation" | "cfpb_complaint" | "identity_theft" | "custom";
export type DisputeResult = "pending" | "deleted" | "updated" | "verified" | "no_response" | "in_progress";

export type DocumentCategory = "id_document" | "proof_of_address" | "credit_report" | "dispute_letter" | "bureau_response" | "agreement" | "other";
export type ActorType = "system" | "staff" | "client" | "ghl" | "stripe";

export type SignatureStatus = "pending" | "signed" | "not_required";
export type SignatureType = "drawn" | "typed" | "electronic";

/**
 * Per-agency map of GHL custom-field keys → CDP data. Values are the GHL
 * custom-field id/fieldKey for that location (which is unique per location).
 */
export interface GhlFieldKeys {
  ssn_last4?: string;
  dob?: string;
  score_eq?: string;
  score_exp?: string;
  score_tu?: string;
  signature_status?: string;
  signed_at?: string;
  credit_report_eq?: string;
  credit_report_exp?: string;
  credit_report_tu?: string;
  id_document?: string;
  proof_of_address?: string;
  [key: string]: string | undefined;
}

// ============================================
// Database Row Types
// ============================================

export interface Agency {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  owner_user_id: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  brand_color: string;
  custom_domain: string | null;
  ghl_location_id: string | null;
  ghl_api_key: string | null;
  ghl_webhook_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan;
  plan_status: PlanStatus;
  license_key: string;
  max_clients: number;
  trial_ends_at: string | null;
  settings: AgencySettings;
  // GHL custom-field key mapping (migration 011)
  ghl_field_keys: GhlFieldKeys;
  // Google Drive integration (migration 012)
  google_drive_enabled: boolean;
  google_drive_access_token: string | null;
  google_drive_refresh_token: string | null;
  google_drive_root_folder_id: string | null;
  google_drive_connected_at: string | null;
  google_drive_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingSteps {
  ghl_connected: boolean;
  first_client_added: boolean;
  snapshot_installed: boolean;
  test_portal_viewed: boolean;
}

export interface AgencySettings {
  timezone: string;
  letter_signature: string;
  default_monthly_fee: number;
  portal_branding_visible: boolean;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string | null;
  onboarding_steps?: OnboardingSteps;
}

export interface TeamMember {
  id: string;
  agency_id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: TeamRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  agency_id: string;
  ghl_contact_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  ssn_last4: string | null;
  dob: string | null;
  score_eq_start: number | null;
  score_exp_start: number | null;
  score_tu_start: number | null;
  score_eq_current: number | null;
  score_exp_current: number | null;
  score_tu_current: number | null;
  score_goal: number | null;
  credit_goal: CreditGoal | null;
  service_start_date: string;
  monthly_fee: number;
  payment_status: PaymentStatus;
  stripe_customer_id: string | null;
  status: ClientStatus;
  current_round: number;
  total_items_start: number;
  total_items_current: number;
  total_items_deleted: number;
  portal_token: string | null;
  portal_token_expires_at: string | null;
  referral_source: string | null;
  notes: string | null;
  // Signature + onboarding (migration 011)
  signature_status: SignatureStatus;
  signed_at: string | null;
  signature_type: SignatureType | null;
  service_agreement_version: string;
  onboarding_form_submitted: boolean;
  onboarding_submitted_at: string | null;
  ghl_drive_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NegativeItem {
  id: string;
  client_id: string;
  agency_id: string;
  bureau: Bureau;
  creditor_name: string;
  account_number_last4: string | null;
  account_type: AccountType | null;
  negative_type: NegativeType;
  balance: number | null;
  date_opened: string | null;
  date_of_first_delinquency: string | null;
  dispute_status: DisputeStatus;
  round_disputed: number | null;
  round_resolved: number | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisputeRound {
  id: string;
  client_id: string;
  agency_id: string;
  round_number: number;
  status: RoundStatus;
  date_sent: string | null;
  response_deadline: string | null;
  date_responses_received: string | null;
  total_items_disputed: number;
  total_deletions: number;
  total_updates: number;
  total_verified: number;
  total_no_response: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dispute {
  id: string;
  round_id: string;
  client_id: string;
  agency_id: string;
  negative_item_id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  letter_pdf_url: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  finalized_at: string | null;
  result: DisputeResult;
  result_date: string | null;
  result_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LetterTemplate {
  id: string;
  agency_id: string | null;
  name: string;
  description: string | null;
  negative_type: string | null;
  letter_type: LetterType;
  round_suggestion: number | null;
  prompt_template: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  client_id: string;
  agency_id: string;
  uploaded_by: string;
  name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  category: DocumentCategory | null;
  notes: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  agency_id: string;
  client_id: string | null;
  actor_type: ActorType | null;
  actor_id: string | null;
  action: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type SnapshotRequestStatus = "pending" | "sent" | "installed";

export interface SnapshotRequest {
  id: string;
  name: string;
  email: string;
  ghl_location_id: string | null;
  agency_name: string | null;
  message: string | null;
  status: SnapshotRequestStatus;
  created_at: string;
}

export interface ScoreHistory {
  id: string;
  client_id: string;
  agency_id: string;
  score_eq: number | null;
  score_exp: number | null;
  score_tu: number | null;
  recorded_at: string;
  round_number: number | null;
  notes: string | null;
}

export type GhlSyncAction =
  | "sync_round_sent"
  | "sync_deletion"
  | "sync_score_update"
  | "sync_completed";
export type GhlSyncStatus = "success" | "failed" | "retrying";

export interface GhlSyncLog {
  id: string;
  agency_id: string;
  client_id: string | null;
  sync_action: string;
  status: GhlSyncStatus;
  error_message: string | null;
  payload: Record<string, unknown> | null;
  attempted_at: string;
}

/** A GHL contact custom-field entry as returned by the v2 contacts API. */
export interface GHLContactCustomField {
  id?: string;
  fieldKey?: string;
  value?: string | number | null;
}

/** Shape of a GHL contact (v2 API) used by the onboarding webhook. */
export interface GHLContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  customFields?: GHLContactCustomField[];
}

// ============================================
// Computed / UI Types
// ============================================

export interface ClientWithStats extends Client {
  negative_items_count?: number;
  active_disputes_count?: number;
  latest_round?: DisputeRound;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  total_deletions_this_month: number;
  total_deletions_all_time: number;
  clients_at_risk: number;
  overdue_rounds: number;
  revenue_this_month: number;
  avg_deletion_rate: number;
}

export interface RoundWithDisputes extends DisputeRound {
  disputes: (Dispute & { negative_item: NegativeItem })[];
}
