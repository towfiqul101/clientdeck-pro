import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGHLPipelines } from "@/lib/ghl/api";
import type { AgencySettings } from "@/types";
import type { PipelineStageKey } from "@/lib/ghl/pipeline";

export const dynamic = "force-dynamic";

const STAGE_NAME_MAP: Record<PipelineStageKey, string> = {
  round_1_sent: "round 1 sent",
  round_2_plus: "round 2+",
  goal_achieved: "goal achieved",
};

/** Auto-detects the agency's "Active Client" GHL pipeline and maps its 3 stage ids by name. */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "Connect GHL (Location ID + API key) first." },
      { status: 400 }
    );
  }

  const pipelines = await getGHLPipelines({ apiKey: ghl_api_key, locationId: ghl_location_id });
  const match = pipelines.find((p) => p.name.toLowerCase().includes("active client"));
  if (!match) {
    return NextResponse.json({
      ok: false,
      error:
        'No pipeline named "Active Client" found. Install the CDP snapshot or create it manually in GHL, then run this again.',
    });
  }

  const stages: Partial<Record<PipelineStageKey, string>> = {};
  for (const [key, wantedName] of Object.entries(STAGE_NAME_MAP) as [PipelineStageKey, string][]) {
    const stage = match.stages?.find((s) => s.name.toLowerCase() === wantedName);
    if (stage) stages[key] = stage.id;
  }

  const supabase = await createServerSupabaseClient();
  const nextSettings: AgencySettings = {
    ...session.agency.settings,
    ghl_pipeline_id: match.id,
    ghl_pipeline_stages: { ...session.agency.settings.ghl_pipeline_stages, ...stages },
  };
  const { error } = await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", session.agency.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const mappedCount = Object.keys(stages).length;
  return NextResponse.json({
    ok: true,
    message: `Connected pipeline "${match.name}" — mapped ${mappedCount} of 3 stages by name.`,
  });
}
