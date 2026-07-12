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

/**
 * Rotates a client's portal token, extends its expiry, and returns the full
 * magic-link URL. Uses the service-role client (portal is not Supabase Auth).
 */
export async function generatePortalLink(
  clientId: string,
  agencyId: string
): Promise<string> {
  const supabase = createAdminClient();
  const token = randomUUID().replace(/-/g, "");
  const expires = new Date(
    Date.now() + PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: agency } = await supabase
    .from("agencies")
    .select("custom_domain, custom_domain_verified")
    .eq("id", agencyId)
    .maybeSingle();

  const { error } = await supabase
    .from("clients")
    .update({ portal_token: token, portal_token_expires_at: expires })
    .eq("id", clientId)
    .eq("agency_id", agencyId);

  if (error) throw new Error(`Could not generate portal link: ${error.message}`);

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
