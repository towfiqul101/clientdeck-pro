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
 * Rotates the client's portal token and (best-effort) pushes it into the GHL
 * `rtp__portal_link` custom field. Does NOT fire any client-facing
 * notification — that's each channel action's own job, so the three portal-
 * link delivery options stay genuinely independent.
 */
async function rotatePortalLink(
  clientId: string,
  session: SessionContext
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
    url = await generatePortalLink(clientId, session.agency.id);
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

/** Rotates the link and returns it for the staff member to copy — no notification sent. */
export async function copyPortalLink(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const rotated = await rotatePortalLink(clientId, session);
  if (!rotated.success) return rotated;

  await logPortalActivity(
    session,
    clientId,
    "Portal link generated",
    "A new client portal magic link was generated."
  );
  return { success: true, url: rotated.url };
}

/** Rotates the link and fires the GHL `rtp-portal-sent` tag so the agency's own workflow SMS's it. */
export async function sendPortalLinkViaGHL(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!session.agency.ghl_api_key || !session.agency.ghl_location_id) {
    return { success: false, error: "Connect GHL to send SMS." };
  }

  const rotated = await rotatePortalLink(clientId, session);
  if (!rotated.success) return rotated;

  await notifyPortalLink(session.agency, { ...rotated.client, portal_token: rotated.token });
  await logPortalActivity(
    session,
    clientId,
    "Portal link sent via GHL SMS",
    "A fresh portal link was tagged for GHL SMS delivery."
  );
  return { success: true, url: rotated.url };
}

/** Rotates the link and emails it directly to the client via Resend. */
export async function sendPortalLinkViaEmailAction(clientId: string): Promise<PortalLinkResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: clientRow } = await supabase.from("clients").select("email").eq("id", clientId).single();
  if (!clientRow?.email) return { success: false, error: "Add client email first." };

  const rotated = await rotatePortalLink(clientId, session);
  if (!rotated.success) return rotated;

  const sent = await sendPortalLinkEmail({
    clientEmail: clientRow.email,
    clientFirstName: rotated.client.first_name,
    agencyName: session.agency.name,
    portalUrl: rotated.url,
    agencyPhone: session.agency.phone ?? undefined,
  });
  if (!sent) return { success: false, error: "Could not send email. Try again." };

  await logPortalActivity(
    session,
    clientId,
    "Portal link emailed to client",
    `Sent to ${clientRow.email}.`
  );
  return { success: true, url: rotated.url };
}
