import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency, Client } from "@/types";

const PORTAL_TOKEN_TTL_DAYS = 90;

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.roundtrackpro.com"
  );
}

/** Days left on a token below which we quietly refresh it while sending. */
const REFRESH_WHEN_UNDER_DAYS = 7;

/**
 * Returns a client's portal magic-link URL.
 *
 * REUSES the existing token by default. It used to mint a fresh token on every
 * call — and every "Copy Link" / "Send via Email" / "Send via SMS" / onboarding
 * sync calls it. So a staff member copying the link to check something silently
 * killed the link already sitting in the client's inbox, and the portal then
 * told the client their link had "expired" when it had really been replaced.
 * (Seen live: 7 regenerations in under a minute, each invalidating the last.)
 *
 * Pass `{ rotate: true }` to deliberately invalidate every previously-shared
 * link — that's a security action (link leaked, client offboarded), not
 * something that should happen as a side effect of sharing.
 *
 * A token that is missing, already expired, or close to expiring is replaced
 * regardless, so a send never hands out a link that's about to die.
 */
export async function generatePortalLink(
  clientId: string,
  agencyId: string,
  opts: { rotate?: boolean } = {}
): Promise<string> {
  const supabase = createAdminClient();

  const [{ data: agency }, { data: client }] = await Promise.all([
    supabase
      .from("agencies")
      .select("custom_domain, custom_domain_verified")
      .eq("id", agencyId)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("portal_token, portal_token_expires_at")
      .eq("id", clientId)
      .eq("agency_id", agencyId)
      .maybeSingle(),
  ]);

  if (!client) throw new Error("Could not generate portal link: client not found.");

  const expiresAt = client.portal_token_expires_at
    ? new Date(client.portal_token_expires_at).getTime()
    : 0;
  const daysLeft = (expiresAt - Date.now()) / 86_400_000;

  const mustReplace =
    opts.rotate === true ||
    !client.portal_token ||
    daysLeft < REFRESH_WHEN_UNDER_DAYS;

  let token = client.portal_token as string | null;

  if (mustReplace) {
    token = randomUUID().replace(/-/g, "");
    const expires = new Date(
      Date.now() + PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error } = await supabase
      .from("clients")
      .update({ portal_token: token, portal_token_expires_at: expires })
      .eq("id", clientId)
      .eq("agency_id", agencyId);

    if (error) throw new Error(`Could not generate portal link: ${error.message}`);
  }

  const base =
    agency?.custom_domain && agency.custom_domain_verified
      ? `https://${agency.custom_domain}`
      : appUrl();

  return `${base}/portal?token=${token}`;
}

/**
 * Validates a portal token. Returns the client + their agency when the token
 * exists and hasn't expired, otherwise null. Service-role query (bypasses RLS);
 * always scoped by the token itself.
 */
export async function validatePortalToken(
  token: string | undefined | null
): Promise<{ client: Client; agency: Agency } | null> {
  if (!token) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, agency:agencies(*)")
    .eq("portal_token", token)
    .gt("portal_token_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data || !data.agency) return null;

  const { agency, ...client } = data as Client & { agency: Agency };
  return { client: client as Client, agency: agency as Agency };
}
