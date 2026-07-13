import { createAdminClient } from "@/lib/supabase/admin";
import type { ClientStatus } from "@/types";

/**
 * Core client fields exposed over the Agency API — deliberately excludes
 * SSN, signature, and document fields (stricter than the CSV export, which
 * includes ssn_last4 for authenticated staff downloads).
 */
export const CLIENT_API_FIELDS =
  "id, first_name, last_name, email, phone, status, assigned_to, current_round";

export interface ApiClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  assigned_to: string | null;
  current_round: number;
}

/**
 * Looks up a single client scoped to `agencyId`. Returns null both when the
 * id doesn't exist at all and when it belongs to a different agency —
 * callers must respond identically (404) in both cases so a valid key for
 * one agency can never confirm whether a client id exists in another.
 */
export async function findAgencyClient(
  clientId: string,
  agencyId: string
): Promise<ApiClient | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select(CLIENT_API_FIELDS)
    .eq("id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return (data as ApiClient | null) ?? null;
}
