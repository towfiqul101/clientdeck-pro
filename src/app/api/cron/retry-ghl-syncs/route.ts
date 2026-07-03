import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { dispatchSyncFromPayload } from "@/lib/ghl/sync";

export const maxDuration = 300;

/**
 * Retries GHL syncs that failed in the last 24 hours, once each. Wired to
 * Vercel Cron (every 6h). Requires a valid CRON_SECRET.
 * Vercel Cron issues GET requests.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: failed, error } = await admin
    .from("ghl_sync_log")
    .select("id, agency_id, sync_action, payload")
    .eq("status", "failed")
    .gte("attempted_at", since)
    .order("attempted_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = failed ?? [];
  // Cache agency GHL creds so we don't re-fetch per row.
  const credsCache = new Map<
    string,
    { apiKey: string; locationId: string } | null
  >();

  async function credsFor(agencyId: string) {
    if (credsCache.has(agencyId)) return credsCache.get(agencyId)!;
    const { data } = await admin
      .from("agencies")
      .select("ghl_api_key, ghl_location_id")
      .eq("id", agencyId)
      .single();
    const creds =
      data?.ghl_api_key && data?.ghl_location_id
        ? { apiKey: data.ghl_api_key, locationId: data.ghl_location_id }
        : null;
    credsCache.set(agencyId, creds);
    return creds;
  }

  let retried = 0;
  let succeeded = 0;
  let stillFailing = 0;

  for (const row of rows) {
    const creds = await credsFor(row.agency_id);
    if (!creds) continue; // agency disconnected GHL — nothing to retry against
    retried++;

    try {
      await dispatchSyncFromPayload(
        row.sync_action,
        (row.payload as Record<string, unknown>) ?? {},
        creds
      );
      await admin
        .from("ghl_sync_log")
        .update({ status: "success", error_message: null, attempted_at: new Date().toISOString() })
        .eq("id", row.id);
      succeeded++;
    } catch (e) {
      stillFailing++;
      await admin
        .from("ghl_sync_log")
        .update({
          error_message: e instanceof Error ? e.message : String(e),
          attempted_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({
    found: rows.length,
    retried,
    succeeded,
    stillFailing,
  });
}
