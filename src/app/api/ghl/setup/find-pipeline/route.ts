import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGHLPipelines } from "@/lib/ghl/api";
import type { AgencySettings } from "@/types";
import {
  PIPELINE_STAGE_KEYS,
  type PipelineStageKey,
} from "@/lib/ghl/pipeline";

export const dynamic = "force-dynamic";

/**
 * Heuristically maps a GHL pipeline stage name onto one of our 8 stage keys.
 * Tolerant of separators/casing: "Round 1 - Sent", "Round 1 Sent", "R1 Results",
 * "Analysis", "Ready to Dispute", "Round 3+ Active", "Goal Achieved", etc.
 */
function mapStageNameToKey(stageName: string): PipelineStageKey | null {
  const name = stageName.toLowerCase();
  if (name.includes("analysis") || name.includes("review credit")) return "analysis";
  if (name.includes("ready") && name.includes("dispute")) return "ready_to_dispute";
  if (name.includes("goal") || name.includes("achieved") || name.includes("complete"))
    return "goal_achieved";

  const isResults =
    name.includes("result") || name.includes("response") || name.includes("back");
  // Rounds 3+ get their own sent/results pair, same as rounds 1 and 2. Before
  // this, both "Round 3+ - Sent" and "Round 3+ - Results In" collapsed onto a
  // single key and first-match-wins silently dropped the results stage.
  if (/round\s*[3-9]/.test(name) || name.includes("3+"))
    return isResults ? "round_3_plus_results" : "round_3_plus";
  if (/round\s*2/.test(name) || /\br2\b/.test(name))
    return isResults ? "round_2_results" : "round_2_sent";
  if (/round\s*1/.test(name) || /\br1\b/.test(name))
    return isResults ? "round_1_results" : "round_1_sent";
  return null;
}

/**
 * Picks the agency's active-client pipeline. A location can hold several
 * pipelines whose names contain "active client" — Acme has both
 * "CDP - Active Clients" (ours) and a stale "Active Client" from the original
 * snapshot. Relying on API return order picked the right one by luck; prefer
 * the explicit `CDP -` prefix instead, mirroring the same "prefer the specific
 * signal over the ambiguous one" fix applied to field-detect.ts.
 */
function pickActiveClientPipeline<T extends { name: string }>(pipelines: T[]): T | undefined {
  const candidates = pipelines.filter((p) => p.name.toLowerCase().includes("active client"));
  if (candidates.length === 0) return undefined;
  const ours = candidates.find((p) => /^\s*cdp\s*-/i.test(p.name));
  return ours ?? candidates[0];
}

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
  const match = pickActiveClientPipeline(pipelines);
  if (!match) {
    return NextResponse.json({
      ok: false,
      error:
        'No pipeline named "Active Client" found. Install the CDP snapshot or create it manually in GHL, then run this again.',
    });
  }

  const stages: Partial<Record<PipelineStageKey, string>> = {};
  for (const stage of match.stages ?? []) {
    const key = mapStageNameToKey(stage.name);
    // First match wins so an earlier "Round 1 - Sent" isn't clobbered by a later stage.
    if (key && !stages[key]) stages[key] = stage.id;
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

  // Without this the Settings page keeps serving its cached render, so the
  // stage inputs still look EMPTY even though the ids saved fine — which reads
  // as "the tool didn't work" when it actually did.
  revalidatePath("/settings/ghl");

  const mappedCount = Object.keys(stages).length;
  const totalStages = PIPELINE_STAGE_KEYS.length;
  return NextResponse.json({
    ok: true,
    message:
      `Connected pipeline "${match.name}" — mapped ${mappedCount} of ${totalStages} stages by name.` +
      (mappedCount < totalStages
        ? " Add any missing stage ids manually in Pipeline Configuration below."
        : ""),
  });
}
