"use server";

import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePortalLink } from "@/lib/utils/portal-token";
import { updateGHLContactFields } from "@/lib/ghl/api";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import {
  notifyPortalLink,
  NOTIFIABLE_CLIENT_COLUMNS,
  type NotifiableClient,
} from "@/lib/ghl/notifications";

/**
 * Rotates the client's portal token, returns a fresh magic-link URL, and
 * (best-effort) pushes it into the GHL `clientdeck_portal_link` custom field so
 * an agency workflow can SMS it to the client.
 */
export async function generateAndSyncPortalLink(
  clientId: string
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  // Confirm the client belongs to this agency (RLS-scoped read).
  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();
  if (!client) return { success: false, error: "Client not found." };

  let url: string;
  try {
    url = await generatePortalLink(clientId, session.agency.id);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not generate link.",
    };
  }

  // Best-effort GHL field sync.
  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id && client.ghl_contact_id) {
    try {
      await updateGHLContactFields(
        client.ghl_contact_id,
        { clientdeck_portal_link: url },
        { apiKey: ghl_api_key, locationId: ghl_location_id }
      );
    } catch (e) {
      console.error("Failed to sync portal link to GHL:", e);
    }
  }

  // Best-effort GHL webhook notification. `client.portal_token` was just
  // rotated by generatePortalLink() above but the in-memory row still has the
  // old value, so build the payload from the fresh `url` instead of relying
  // on notifyPortalLink()'s own portal_token lookup.
  await notifyPortalLink(session.agency, {
    ...(client as NotifiableClient),
    portal_token: new URL(url).searchParams.get("token"),
  });

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Portal link generated",
    description: "A new client portal magic link was generated.",
  });

  await markOnboardingStep(session.agency.id, "test_portal_viewed", true);

  return { success: true, url };
}
