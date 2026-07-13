"use server";

import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generatePortalLink } from "@/lib/utils/portal-token";
import { updateGHLContactFields } from "@/lib/ghl/api";
import { GHL_FIELD_KEYS } from "@/lib/ghl/field-keys";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import { sendPortalLinkEmail } from "@/lib/email/templates";
import {
  notifyPortalLink,
  NOTIFIABLE_CLIENT_COLUMNS,
  type NotifiableClient,
} from "@/lib/ghl/notifications";
import type { SessionContext } from "@/lib/auth/session";

type PortalLinkResult = { success: true; url: string } | { success: false; error: string };

/**
 * Resolves the client's portal link and (best-effort) pushes it into the GHL
 * `rtp__portal_link` custom field. Does NOT fire any client-facing
 * notification — that's each channel action's own job, so the three portal-
 * link delivery options stay genuinely independent.
 *
 * REUSES the existing token (see generatePortalLink). It used to mint a new one
 * every call, so copying the link silently killed the link already in the
 * client's inbox. Pass rotate:true only to deliberately revoke old links.
 */
async function resolvePortalLink(
  clientId: string,
  session: SessionContext,
  opts: { rotate?: boolean } = {}
): Promise<
  | { success: true; url: string; token: string; client: NotifiableClient }
  | { success: false; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();
  if (!client) return { success: false, error: "Client not found." };

  let url: string;
  try {
    url = await generatePortalLink(clientId, session.agency.id, opts);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not generate link.",
    };
  }

  const token = new URL(url).searchParams.get("token")!;
  const { ghl_api_key, ghl_location_id } = session.agency;
  if (ghl_api_key && ghl_location_id && client.ghl_contact_id) {
    await updateGHLContactFields(
      client.ghl_contact_id,
      { [GHL_FIELD_KEYS.PORTAL_LINK]: url },
      { apiKey: ghl_api_key, locationId: ghl_location_id }
    ).catch((e) => console.error("Failed to sync portal link to GHL:", e));
  }

  await markOnboardingStep(session.agency.id, "test_portal_viewed", true);

  return { success: true, url, token, client: client as NotifiableClient };
}

async function logPortalActivity(
  session: SessionContext,
  clientId: string,
  action: string,
  description: string
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action,
    description,
  });
}

/** Returns the client's portal link for the staff member to copy. Non-destructive:
 *  does NOT invalidate a link the client already has. No notification sent. */
export async function copyPortalLink(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const link = await resolvePortalLink(clientId, session);
  if (!link.success) return link;

  // Deliberately not logged as "generated" — copying is a read, and logging it
  // as a generation is what made 7 harmless copies look like 7 rotations.
  return { success: true, url: link.url };
}

/**
 * Explicitly REVOKES every previously-shared link and issues a fresh one.
 * This is the security action (link leaked, client offboarded) — it is the only
 * path that invalidates links, and it's now opt-in rather than a side effect of
 * sharing.
 */
export async function regeneratePortalLink(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const link = await resolvePortalLink(clientId, session, { rotate: true });
  if (!link.success) return link;

  await logPortalActivity(
    session,
    clientId,
    "Portal link regenerated",
    "A new magic link was issued. All previously shared links are now invalid."
  );
  return { success: true, url: link.url };
}

/** Sends the client's portal link via the GHL `rtp-portal-sent` tag. Reuses the
 *  existing link — does not invalidate one the client already has. */
export async function sendPortalLinkViaGHL(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!session.agency.ghl_api_key || !session.agency.ghl_location_id) {
    return { success: false, error: "Connect GHL to send SMS." };
  }

  const link = await resolvePortalLink(clientId, session);
  if (!link.success) return link;

  await notifyPortalLink(session.agency, { ...link.client, portal_token: link.token });
  await logPortalActivity(
    session,
    clientId,
    "Portal link sent via GHL SMS",
    "The client's portal link was tagged for GHL SMS delivery."
  );
  return { success: true, url: link.url };
}

/** Emails the client's portal link via Resend. Reuses the existing link. */
export async function sendPortalLinkViaEmailAction(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase.from("clients").select("email").eq("id", clientId).single();
  if (!clientRow?.email) return { success: false, error: "Add client email first." };

  const link = await resolvePortalLink(clientId, session);
  if (!link.success) return link;

  const sent = await sendPortalLinkEmail({
    clientEmail: clientRow.email,
    clientFirstName: link.client.first_name,
    agencyName: session.agency.name,
    portalUrl: link.url,
    agencyPhone: session.agency.phone ?? undefined,
  });
  if (!sent) return { success: false, error: "Could not send email. Try again." };

  await logPortalActivity(
    session,
    clientId,
    "Portal link emailed to client",
    `Sent to ${clientRow.email}.`
  );
  return { success: true, url: link.url };
}
