import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClientStatus,
  CreditScoreRange,
  ResultsTimeline,
  EmploymentStatus,
} from "@/types";

/**
 * Core client fields exposed over the Agency API — deliberately excludes
 * SSN, signature, and document fields (same exclusions as the CSV export).
 * The 10 Onboarding Details intake fields are included — they carry no
 * identity/credential data (that's ssn_last4/dob/signature_*, still excluded
 * above).
 */
export const CLIENT_API_FIELDS =
  "id, first_name, last_name, email, phone, status, assigned_to, current_round, " +
  "credit_score_range, reviewed_credit_report_recently, negative_items_reported, " +
  "enrolled_other_program, primary_goal, results_timeline, employment_status, " +
  "bankruptcy_filed, bankruptcy_date, intake_concerns";

export interface ApiClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  assigned_to: string | null;
  current_round: number;
  credit_score_range: CreditScoreRange | null;
  reviewed_credit_report_recently: boolean | null;
  negative_items_reported: boolean | null;
  enrolled_other_program: boolean | null;
  primary_goal: string | null;
  results_timeline: ResultsTimeline | null;
  employment_status: EmploymentStatus | null;
  bankruptcy_filed: boolean | null;
  bankruptcy_date: string | null;
  intake_concerns: string | null;
}

/**
 * Looks up a single client scoped to `agencyId`. Returns null both when the
 * id doesn't exist at all and when it belongs to a different agency —
 * callers must respond identically (404) in both cases so a valid key for
 * one agency can never confirm whether a client id exists in another.
 *
 * A genuine query failure (bad column, DB unreachable, etc.) is a third,
 * distinct case and must NOT be folded into that same 404 — doing so would
 * make an outage indistinguishable from "this client doesn't exist," so it
 * throws instead; the caller is responsible for turning that into a 500.
 */
export async function findAgencyClient(
  clientId: string,
  agencyId: string
): Promise<ApiClient | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_API_FIELDS)
    .eq("id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) {
    throw new Error(`findAgencyClient query failed: ${error.message}`);
  }
  return (data as ApiClient | null) ?? null;
}
