import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateGHLOpportunity, moveGHLPipelineStage } from "@/lib/ghl/api";
import type { Agency } from "@/types";

export type PipelineStageKey =
  | "analysis"
  | "ready_to_dispute"
  | "round_1_sent"
  | "round_1_results"
  | "round_2_sent"
  | "round_2_results"
  | "round_3_plus"
  | "goal_achieved";

/** Human labels for the stage keys, used by the settings UI and name-matching. */
export const PIPELINE_STAGE_LABELS: Record<PipelineStageKey, string> = {
  analysis: "Analysis",
  ready_to_dispute: "Ready to Dispute",
  round_1_sent: "Round 1 - Sent",
  round_1_results: "Round 1 - Results",
  round_2_sent: "Round 2 - Sent",
  round_2_results: "Round 2 - Results",
  round_3_plus: "Round 3+ - Active",
  goal_achieved: "Goal Achieved",
};

export const PIPELINE_STAGE_KEYS = Object.keys(
  PIPELINE_STAGE_LABELS
) as PipelineStageKey[];

/** Stage a client's opportunity should sit in once round N's letters are sent. */
export function stageForRoundSent(roundNumber: number): PipelineStageKey {
  if (roundNumber <= 1) return "round_1_sent";
  if (roundNumber === 2) return "round_2_sent";
  return "round_3_plus";
}

/** Stage for when round N's bureau results come back. */
export function stageForRoundResults(roundNumber: number): PipelineStageKey {
  if (roundNumber <= 1) return "round_1_results";
  if (roundNumber === 2) return "round_2_results";
  return "round_3_plus";
}

/**
 * Resting stage derived from a client's current progress — used when
 * backfilling opportunities for existing clients so each one lands in the
 * stage that matches where it actually is, not blindly at the start.
 */
export function stageForClientState(opts: {
  status: string;
  maxRoundNumber: number;
}): PipelineStageKey {
  if (opts.status === "completed") return "goal_achieved";
  if (opts.maxRoundNumber >= 3) return "round_3_plus";
  if (opts.maxRoundNumber === 2) return "round_2_sent";
  if (opts.maxRoundNumber === 1) return "round_1_sent";
  return "analysis";
}

export interface PipelineClient {
  id: string;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
}

/**
 * Moves a client's GHL opportunity to the configured stage for `stage`.
 * Best-effort: no-ops if the agency's pipeline/stage mapping, GHL credentials,
 * or the client's GHL contact id aren't configured. Never throws. Lazily
 * finds-or-creates the opportunity on first use and persists it on the
 * client row so later calls skip the lookup.
 */
export async function moveClientPipelineStage(
  agency: Agency,
  client: PipelineClient,
  stage: PipelineStageKey
): Promise<void> {
  const pipelineId = agency.settings?.ghl_pipeline_id;
  const stageId = agency.settings?.ghl_pipeline_stages?.[stage];
  if (
    !pipelineId ||
    !stageId ||
    !agency.ghl_api_key ||
    !agency.ghl_location_id ||
    !client.ghl_contact_id
  ) {
    return;
  }

  const opts = { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id };

  try {
    let opportunityId = client.ghl_opportunity_id;
    if (!opportunityId) {
      opportunityId = await findOrCreateGHLOpportunity(client.ghl_contact_id, pipelineId, opts);
      if (opportunityId) {
        const admin = createAdminClient();
        await admin.from("clients").update({ ghl_opportunity_id: opportunityId }).eq("id", client.id);
      }
    }
    if (!opportunityId) return;
    await moveGHLPipelineStage(opportunityId, stageId, opts);
  } catch (err) {
    console.error(`[Pipeline] Failed to move client ${client.id} to stage ${stage}:`, err);
  }
}
