import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { moveClientPipelineStage, stageForClientState } from "@/lib/ghl/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Backfills GHL pipeline opportunities for the signed-in agency's clients.
 * For each client that already has a GHL contact, finds-or-creates the
 * opportunity and places it in the stage that matches the client's current
 * progress (Analysis → Round N → Goal Achieved). Best-effort + RLS-scoped.
 */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { agency } = session;
  if (!agency.ghl_api_key || !agency.ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "Connect GHL (Location ID + API key) first." },
      { status: 400 }
    );
  }
  if (!agency.settings?.ghl_pipeline_id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'No pipeline connected. Run "Find & Connect Pipeline" (or set a Pipeline ID below) first.',
      },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, ghl_contact_id, ghl_opportunity_id, status");
  const clients = clientRows ?? [];
  if (clients.length === 0) {
    return NextResponse.json({ ok: true, message: "No clients to process." });
  }

  // One query for round numbers; build clientId → highest round number.
  const { data: roundRows } = await supabase
    .from("dispute_rounds")
    .select("client_id, round_number");
  const maxRoundByClient = new Map<string, number>();
  for (const r of roundRows ?? []) {
    const prev = maxRoundByClient.get(r.client_id) ?? 0;
    if (r.round_number > prev) maxRoundByClient.set(r.client_id, r.round_number);
  }

  const withContact = clients.filter((c) => c.ghl_contact_id);
  const skippedNoContact = clients.length - withContact.length;
  const missingBefore = withContact.filter((c) => !c.ghl_opportunity_id).length;

  const BATCH = 3;
  for (let i = 0; i < withContact.length; i += BATCH) {
    const batch = withContact.slice(i, i + BATCH);
    await Promise.all(
      batch.map((c) =>
        moveClientPipelineStage(
          agency,
          {
            id: c.id,
            ghl_contact_id: c.ghl_contact_id,
            ghl_opportunity_id: c.ghl_opportunity_id,
          },
          stageForClientState({
            status: c.status,
            maxRoundNumber: maxRoundByClient.get(c.id) ?? 0,
          })
        )
      )
    );
  }

  // Re-count how many clients now carry an opportunity id.
  const { data: afterRows } = await supabase
    .from("clients")
    .select("ghl_opportunity_id, ghl_contact_id");
  const withOpp = (afterRows ?? []).filter((c) => c.ghl_opportunity_id).length;
  const totalWithContact = withContact.length;

  let message = `${withOpp} of ${clients.length} clients now have a pipeline opportunity`;
  if (missingBefore > 0) message += ` (created/placed ${missingBefore})`;
  if (skippedNoContact > 0) {
    message += `. ${skippedNoContact} client${skippedNoContact === 1 ? "" : "s"} skipped — no GHL contact yet; run "Sync All Clients to GHL" first`;
  }
  message += ".";

  return NextResponse.json({ ok: totalWithContact > 0 || clients.length === 0, message });
}
