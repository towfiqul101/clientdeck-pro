import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Agency, TeamMember } from "@/types";

export interface SessionContext {
  userId: string;
  teamMember: TeamMember;
  agency: Agency;
}

/**
 * Resolves the authenticated user, their team_member record, and their agency.
 * Wrapped in React `cache()` so the layout and any child page/component in the
 * same request share a single set of queries.
 *
 * Returns null when there is no signed-in user OR no active team_member row
 * (e.g. mid-signup before the agency has been provisioned).
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: teamMember, error } = await supabase
      .from("team_members")
      .select("*, agency:agencies(*)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (error || !teamMember || !teamMember.agency) return null;

    const { agency, ...member } = teamMember as TeamMember & { agency: Agency };

    return {
      userId: user.id,
      teamMember: member as TeamMember,
      agency: agency as Agency,
    };
  }
);
