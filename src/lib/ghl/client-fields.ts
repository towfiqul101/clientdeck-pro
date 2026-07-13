import { GHL_FIELD_KEYS } from "@/lib/ghl/field-keys";
import type { Client } from "@/types";

/**
 * Builds the GHL custom-field payload for a single client's current state,
 * keyed by the real `rtp__*` GHL field keys. Shared by the bulk sync-clients
 * tools and the per-client "Force Sync to GHL" action so they never drift.
 * Score/portal fields are omitted when absent so we don't overwrite a good
 * value in GHL with a blank.
 */
export function buildClientSyncFields(
  client: Pick<
    Client,
    | "id"
    | "current_round"
    | "total_items_deleted"
    | "total_items_current"
    | "score_eq_current"
    | "score_exp_current"
    | "score_tu_current"
  >,
  portalLink?: string | null
): Record<string, string | number> {
  const fields: Record<string, string | number> = {
    [GHL_FIELD_KEYS.CLIENT_ID]: client.id,
    [GHL_FIELD_KEYS.ROUND_NUMBER]: client.current_round ?? 0,
    [GHL_FIELD_KEYS.ITEMS_DELETED]: client.total_items_deleted ?? 0,
    [GHL_FIELD_KEYS.TOTAL_ITEMS]: client.total_items_current ?? 0,
  };
  if (client.score_eq_current) fields[GHL_FIELD_KEYS.EQ_SCORE] = client.score_eq_current;
  if (client.score_exp_current) fields[GHL_FIELD_KEYS.EXP_SCORE] = client.score_exp_current;
  if (client.score_tu_current) fields[GHL_FIELD_KEYS.TU_SCORE] = client.score_tu_current;
  if (portalLink) fields[GHL_FIELD_KEYS.PORTAL_LINK] = portalLink;
  return fields;
}
