import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncRoundSent,
  syncDeletionAchieved,
  syncScoreUpdate,
  syncClientCompleted,
} from "@/lib/ghl/api";
import type { GhlSyncAction } from "@/types";

interface GHLCreds {
  apiKey: string;
  locationId: string;
}

/**
 * Runs a GHL sync and records the attempt in `ghl_sync_log` (success or
 * failure). Never throws — GHL sync is best-effort and must not break the app
 * write that triggered it. Logging uses the service-role client because the
 * table has no INSERT policy for regular users.
 *
 * The stored payload holds everything needed to *retry* the call later
 * (contact id + action params) — but NOT the API key, which is re-fetched from
 * the agency at retry time.
 */
export async function runGhlSync(params: {
  agencyId: string;
  clientId: string | null;
  action: GhlSyncAction;
  payload: Record<string, unknown>;
  run: () => Promise<unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  try {
    await params.run();
    await admin.from("ghl_sync_log").insert({
      agency_id: params.agencyId,
      client_id: params.clientId,
      sync_action: params.action,
      status: "success",
      payload: params.payload,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`GHL sync '${params.action}' failed:`, message);
    await admin.from("ghl_sync_log").insert({
      agency_id: params.agencyId,
      client_id: params.clientId,
      sync_action: params.action,
      status: "failed",
      error_message: message,
      payload: params.payload,
    });
    return { ok: false, error: message };
  }
}

/**
 * Re-dispatches a sync from a logged payload. Used by the retry cron. Throws on
 * failure so the caller can mark the row failed again.
 */
export async function dispatchSyncFromPayload(
  action: string,
  payload: Record<string, unknown>,
  creds: GHLCreds
): Promise<void> {
  const contactId = String(payload.contactId ?? "");
  if (!contactId) throw new Error("Missing contactId in payload");
  const n = (key: string) => Number(payload[key] ?? 0);

  switch (action) {
    case "sync_round_sent":
      await syncRoundSent(contactId, n("roundNumber"), n("itemsDisputed"), creds);
      break;
    case "sync_deletion":
      await syncDeletionAchieved(
        contactId,
        n("deletionsThisRound"),
        n("totalDeletions"),
        creds
      );
      break;
    case "sync_score_update":
      await syncScoreUpdate(
        contactId,
        (payload.scores as { eq?: number; exp?: number; tu?: number }) ?? {},
        creds
      );
      break;
    case "sync_completed":
      await syncClientCompleted(contactId, creds);
      break;
    default:
      throw new Error(`Unknown sync action: ${action}`);
  }
}
