import { createAdminClient } from "@/lib/supabase/admin";
import { maxTeamMembersForPlan } from "@/lib/billing/plans";
import type { Plan } from "@/types";

/** Count of active team members for an agency (service-role, cross-RLS safe). */
export async function getTeamMemberCount(agencyId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("is_active", true);
  return count ?? 0;
}

export interface TeamLimit {
  allowed: boolean;
  current: number;
  max: number;
}

export async function checkTeamMemberLimit(
  agencyId: string,
  plan: Plan
): Promise<TeamLimit> {
  const current = await getTeamMemberCount(agencyId);
  const max = maxTeamMembersForPlan(plan);
  return { allowed: current < max, current, max };
}
