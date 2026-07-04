import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateGHLOpportunity, moveGHLPipelineStage } from "@/lib/ghl/api";
import type { Agency } from "@/types";

export type PipelineStageKey = "round_1_sent" | "round_2_plus" | "goal_achieved";

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
