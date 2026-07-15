import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasApiAccess, ACTIVE_PLAN_STATUSES } from "@/lib/billing/plans";
import type { Plan, PlanStatus } from "@/types";

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

/** 100 requests/hour per key, fixed windows aligned to the clock hour. */
export const API_RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export type ApiKeyAuthResult =
  | { ok: true; agencyId: string; keyId: string }
  | { ok: false; status: 401 }
  | { ok: false; status: 402; reason: string }
  | { ok: false; status: 429; limit: number; current: number; resetAt: string };

/**
 * Validates the `Authorization: Bearer <key>` header against agency_api_keys,
 * re-checks that the agency is still *entitled* to API access, then enforces
 * the per-key rate limit — all before any endpoint logic runs. Uses the admin
 * client — there is no Supabase Auth session on these requests, so RLS's
 * get_user_agency_id() has nothing to resolve against. Updates last_used_at
 * on success.
 *
 * Entitlement is re-checked on every request, not just at key generation:
 * plans change after a key is issued. An agency that downgrades off the
 * Agency plan, or whose subscription lapses to cancelled/past_due/paused,
 * must stop being able to use keys it already holds.
 */
export async function validateApiKey(req: Request): Promise<ApiKeyAuthResult> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false, status: 401 };

  const raw = auth.slice("Bearer ".length).trim();
  if (!raw) return { ok: false, status: 401 };

  const hash = hashApiKey(raw);
  const admin = createAdminClient();

  // Join the agency in so entitlement costs no extra round-trip.
  const { data: key } = await admin
    .from("agency_api_keys")
    .select("id, agency_id, agency:agencies(plan, plan_status)")
    .eq("key_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!key) return { ok: false, status: 401 };

  const agency = key.agency as unknown as {
    plan: Plan;
    plan_status: PlanStatus;
  } | null;

  // Fail closed: a key whose agency can't be resolved gets no access.
  if (!agency) return { ok: false, status: 401 };

  if (!hasApiAccess(agency.plan)) {
    return {
      ok: false,
      status: 402,
      reason: "API access requires the Agency plan. This agency's plan no longer includes it.",
    };
  }

  if (!ACTIVE_PLAN_STATUSES.includes(agency.plan_status)) {
    return {
      ok: false,
      status: 402,
      reason: `API access is unavailable while the subscription is ${agency.plan_status}.`,
    };
  }

  await admin
    .from("agency_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  // Fixed-window counter, stored in Postgres (not the in-memory
  // src/lib/utils/rate-limit.ts helper — that's per-serverless-instance
  // memory and doesn't enforce a real cap across instances).
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);
  const resetAt = new Date(windowStart.getTime() + RATE_LIMIT_WINDOW_MS);

  const { data: count, error: rateLimitError } = await admin.rpc("increment_api_rate_limit", {
    p_api_key_id: key.id,
    p_window_start: windowStart.toISOString(),
  });

  if (rateLimitError) {
    // Fail open: an infra hiccup on the rate-limit counter shouldn't take
    // down the API for legitimate callers. The auth check above is the
    // security-critical fail-closed path; this is best-effort abuse control.
    console.error("validateApiKey: rate limit check failed", rateLimitError);
  } else if (typeof count === "number" && count > API_RATE_LIMIT) {
    return {
      ok: false,
      status: 429,
      limit: API_RATE_LIMIT,
      current: count,
      resetAt: resetAt.toISOString(),
    };
  }

  return { ok: true, agencyId: key.agency_id, keyId: key.id };
}

/** Shared 401/429 response for every /api/v1/* route — keeps the rate-limit
 *  response shape uniform across all endpoints instead of copy-pasted per-route. */
export function apiAuthErrorResponse(
  auth: Extract<ApiKeyAuthResult, { ok: false }>
): NextResponse {
  if (auth.status === 429) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded.",
        limit: auth.limit,
        current: auth.current,
        reset_at: auth.resetAt,
      },
      { status: 429 }
    );
  }
  if (auth.status === 402) {
    return NextResponse.json({ error: auth.reason }, { status: 402 });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
