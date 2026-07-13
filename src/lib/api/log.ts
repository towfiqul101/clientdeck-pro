import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Audit-log entry for an /api/v1/* request. Only callable once an agency_id
 * has been resolved (i.e. after a successful validateApiKey) — activity_log's
 * agency_id column is NOT NULL, so a request that fails auth with no
 * resolvable agency (missing/garbage key) has nothing to attach a row to and
 * is intentionally not logged here. Never throws — mirrors the rest of the
 * app's notification/audit helpers.
 */
export async function logApiRequest(
  agencyId: string,
  req: Request,
  info: {
    status: number;
    description: string;
    clientId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { pathname } = new URL(req.url);
    await admin.from("activity_log").insert({
      agency_id: agencyId,
      client_id: info.clientId ?? null,
      actor_type: "api",
      action: "api_request",
      description: info.description,
      metadata: { method: req.method, path: pathname, status: info.status, ...info.metadata },
    });
  } catch (e) {
    console.error("logApiRequest failed", e);
  }
}
