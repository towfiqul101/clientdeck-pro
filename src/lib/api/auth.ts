import { randomBytes, createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const KEY_PREFIX = "rtp_live_";

/** Generates a new agency API key. Returns the raw (shown once), its display
 *  prefix, and its sha256 hash (the only form persisted to the DB) — mirrors
 *  the admin session hashing pattern in src/lib/admin/session.ts. */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  const prefix = raw.slice(0, KEY_PREFIX.length + 8);
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface ApiKeyAuthResult {
  agencyId: string;
}

/**
 * Validates the `Authorization: Bearer <key>` header against agency_api_keys.
 * Uses the admin client — there is no Supabase Auth session on these requests,
 * so RLS's get_user_agency_id() has nothing to resolve against. Updates
 * last_used_at on success. Returns null on any missing/invalid/revoked key.
 */
export async function validateApiKey(req: Request): Promise<ApiKeyAuthResult | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const raw = auth.slice("Bearer ".length).trim();
  if (!raw) return null;

  const hash = hashApiKey(raw);
  const admin = createAdminClient();

  const { data: key } = await admin
    .from("agency_api_keys")
    .select("id, agency_id")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!key) return null;

  await admin
    .from("agency_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return { agencyId: key.agency_id };
}
