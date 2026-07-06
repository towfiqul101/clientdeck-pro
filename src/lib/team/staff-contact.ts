import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the email a staff-facing notification for this client should go
 * to: the assigned team member's email if one is set (and still resolves),
 * otherwise the agency owner's email.
 */
export async function resolveAssignedStaffEmail(
  supabase: SupabaseClient,
  assignedTo: string | null,
  ownerEmail: string
): Promise<string> {
  if (assignedTo) {
    const { data } = await supabase
      .from("team_members")
      .select("email")
      .eq("id", assignedTo)
      .maybeSingle();
    if (data?.email) return data.email;
  }
  return ownerEmail;
}
