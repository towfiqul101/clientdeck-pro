"use server";

import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateGHLContactFields } from "@/lib/ghl/api";
import { buildClientSyncFields } from "@/lib/ghl/client-fields";
import { generatePortalLink } from "@/lib/utils/portal-token";
import type { Client } from "@/types";

type ForceSyncResult =
  | { success: true; fieldCount: number }
  | { success: false; error: string };

/**
 * "Fix it now" action: writes ALL of a client's current values (round, item
 * counts, scores, portal link, client id) to their GHL contact's `rtp__*`
 * custom fields in one call. Regenerates the portal link so GHL always holds a
 * fresh one. Used to backfill contacts whose fields were left empty by the old
 * key/format bug.
 */
export async function forceSyncClientToGHL(clientId: string): Promise<ForceSyncResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return { success: false, error: "Connect GHL (API key + Location ID) in Settings first." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select(
      "id, ghl_contact_id, current_round, total_items_deleted, total_items_current, score_eq_current, score_exp_current, score_tu_current"
    )
    .eq("id", clientId)
    .single();

  if (!client) return { success: false, error: "Client not found." };
  const c = client as Pick<
    Client,
    | "id"
    | "ghl_contact_id"
    | "current_round"
    | "total_items_deleted"
    | "total_items_current"
    | "score_eq_current"
    | "score_exp_current"
    | "score_tu_current"
  >;

  if (!c.ghl_contact_id) {
    return { success: false, error: "This client isn't linked to a GHL contact yet." };
  }

  // Fresh portal link (also persists the rotated token on the client row).
  const portalLink = await generatePortalLink(clientId, session.agency.id).catch(() => null);

  const fields = buildClientSyncFields(c, portalLink);

  try {
    await updateGHLContactFields(c.ghl_contact_id, fields, {
      apiKey: ghl_api_key,
      locationId: ghl_location_id,
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "GHL rejected the update.",
    };
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "GHL fields force-synced",
    description: `Pushed ${Object.keys(fields).length} custom field(s) to GHL contact.`,
  });

  return { success: true, fieldCount: Object.keys(fields).length };
}
