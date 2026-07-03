import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  syncRoundSent,
  syncDeletionAchieved,
  syncScoreUpdate,
  syncClientCompleted,
} from "@/lib/ghl/api";
import { runGhlSync } from "@/lib/ghl/sync";

type SyncAction =
  | "sync_round_sent"
  | "sync_deletion"
  | "sync_score_update"
  | "sync_completed";

interface SyncBody {
  action: SyncAction;
  clientId: string;
  data?: Record<string, number>;
}

/**
 * Manual outbound sync: pushes an app event to the client's GHL contact using
 * the agency's stored GHL credentials. Authenticated via the caller's session;
 * RLS ensures the client belongs to the caller's agency.
 */
export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SyncBody;
  try {
    body = (await req.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, clientId, data = {} } = body;
  if (!action || !clientId) {
    return NextResponse.json(
      { error: "action and clientId are required" },
      { status: 400 }
    );
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { error: "GHL is not configured for this agency" },
      { status: 400 }
    );
  }

  // RLS scopes this to the caller's agency.
  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select("ghl_contact_id")
    .eq("id", clientId)
    .single();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (!client.ghl_contact_id) {
    return NextResponse.json(
      { error: "Client has no linked GHL contact" },
      { status: 400 }
    );
  }

  const opts = { apiKey: ghl_api_key, locationId: ghl_location_id };
  const contactId = client.ghl_contact_id;

  // Build the sync call + retry payload for the requested action.
  let run: () => Promise<unknown>;
  let payload: Record<string, unknown>;
  switch (action) {
    case "sync_round_sent":
      payload = {
        contactId,
        roundNumber: data.roundNumber ?? 0,
        itemsDisputed: data.itemsDisputed ?? 0,
      };
      run = () =>
        syncRoundSent(
          contactId,
          data.roundNumber ?? 0,
          data.itemsDisputed ?? 0,
          opts
        );
      break;
    case "sync_deletion":
      payload = {
        contactId,
        deletionsThisRound: data.deletionsThisRound ?? 0,
        totalDeletions: data.totalDeletions ?? 0,
      };
      run = () =>
        syncDeletionAchieved(
          contactId,
          data.deletionsThisRound ?? 0,
          data.totalDeletions ?? 0,
          opts
        );
      break;
    case "sync_score_update":
      payload = {
        contactId,
        scores: { eq: data.eq, exp: data.exp, tu: data.tu },
      };
      run = () =>
        syncScoreUpdate(contactId, { eq: data.eq, exp: data.exp, tu: data.tu }, opts);
      break;
    case "sync_completed":
      payload = { contactId };
      run = () => syncClientCompleted(contactId, opts);
      break;
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }

  const result = await runGhlSync({
    agencyId: session.agency.id,
    clientId,
    action,
    payload,
    run,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Sync failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
