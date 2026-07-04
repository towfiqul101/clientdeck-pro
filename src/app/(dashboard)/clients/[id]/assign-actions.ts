"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { createGHLTask } from "@/lib/ghl/api";

export async function assignClient(
  clientId: string,
  teamMemberId: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("clients")
    .update({
      assigned_to: teamMemberId,
      assigned_at: teamMemberId ? new Date().toISOString() : null,
    })
    .eq("id", clientId);
  if (error) return { success: false, error: error.message };

  let memberName = "Unassigned";
  if (teamMemberId) {
    const { data: m } = await supabase
      .from("team_members").select("name").eq("id", teamMemberId).maybeSingle();
    memberName = m?.name ?? "a team member";
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client assigned",
    description: teamMemberId
      ? `Client assigned to ${memberName}.`
      : "Client unassigned.",
  });

  // Best-effort GHL task for the newly assigned specialist.
  if (teamMemberId) {
    const { ghl_api_key, ghl_location_id } = session.agency;
    if (ghl_api_key && ghl_location_id) {
      const { data: c } = await supabase
        .from("clients").select("ghl_contact_id, first_name, last_name")
        .eq("id", clientId).maybeSingle();
      if (c?.ghl_contact_id) {
        try {
          await createGHLTask(
            c.ghl_contact_id,
            `You've been assigned ${c.first_name} ${c.last_name} (${memberName})`,
            new Date().toISOString(),
            { apiKey: ghl_api_key, locationId: ghl_location_id }
          );
        } catch (e) { console.error("assignClient: GHL task failed", e); }
      }
    }
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/team");
  return { success: true };
}
