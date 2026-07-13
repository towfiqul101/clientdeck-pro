import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Auth for the inbound GHL webhooks (/api/ghl/webhook, /api/ghl/onboarding).
 *
 * FAILS CLOSED. The original guard was `if (secret) { ...check... }`, so an
 * unset secret skipped the check entirely and accepted every caller — which is
 * exactly what happened in production. A missing server-side secret is a
 * misconfiguration, and a misconfiguration must never mean "accept everyone".
 *
 * TWO credentials are accepted, in priority order:
 *
 *  1. `agencies.webhook_token` — per-agency, unguessable. This is the real
 *     credential. It IDENTIFIES the agency, so the caller doesn't get to pick
 *     which tenant they're writing to via the payload's locationId.
 *
 *  2. `GHL_WEBHOOK_SECRET` — the legacy GLOBAL secret. Accepted only so live
 *     agencies configured against the old URL keep working during migration.
 *     It authenticates but does NOT identify an agency, so a caller presenting
 *     it can still target any locationId — i.e. it carries the cross-tenant
 *     weakness the per-agency token exists to remove. Retire it (delete the env
 *     var) once every agency's GHL webhook URL uses its own token.
 */
export type GhlWebhookAuth =
  | { ok: true; agencyId: string; legacy: false }
  | { ok: true; agencyId: null; legacy: true }
  | { ok: false; reason: "no_credential" | "invalid_credential" };

function extractToken(req: Request): string | null {
  return (
    req.headers.get("x-rtp-secret") ||
    req.headers.get("x-wh-secret") ||
    new URL(req.url).searchParams.get("secret")
  );
}

export async function verifyGhlWebhook(req: Request): Promise<GhlWebhookAuth> {
  const provided = extractToken(req);
  if (!provided) return { ok: false, reason: "no_credential" };

  // 1. Per-agency token. Unique index makes this an exact, single-row lookup.
  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("id")
    .eq("webhook_token", provided)
    .maybeSingle();

  if (agency) return { ok: true, agencyId: agency.id, legacy: false };

  // 2. Legacy global secret — authenticates, but identifies no agency.
  const globalSecret = process.env.GHL_WEBHOOK_SECRET;
  if (globalSecret && timingSafeEqual(provided, globalSecret)) {
    return { ok: true, agencyId: null, legacy: true };
  }

  return { ok: false, reason: "invalid_credential" };
}

/**
 * Constant-time comparison so response timing doesn't leak how many leading
 * characters of the secret were correct.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Binds the request to a tenant.
 *
 * Both webhook routes pick the agency from the payload's `locationId`, which
 * the CALLER controls. A per-agency token is therefore only worth something if
 * we also check that the locationId being claimed actually belongs to the
 * agency that token identifies — otherwise agency A's valid token could still
 * write into agency B.
 *
 * Legacy global-secret callers have no agency identity, so there is nothing to
 * bind them to and they're allowed through (the old, weaker behavior). That is
 * precisely why the global secret should be retired.
 */
export async function locationBelongsToAgency(
  auth: GhlWebhookAuth,
  locationId: string
): Promise<boolean> {
  if (!auth.ok) return false;
  if (auth.legacy) return true; // no agency identity to bind against

  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("id")
    .eq("id", auth.agencyId)
    .eq("ghl_location_id", locationId)
    .maybeSingle();

  return Boolean(data);
}
