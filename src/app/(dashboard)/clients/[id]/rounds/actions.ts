"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { calculateDeadline } from "@/lib/utils/helpers";
import {
  syncRoundSent,
  syncDeletionAchieved,
  syncScoreUpdate,
  syncClientCompleted,
} from "@/lib/ghl/api";
import { runGhlSync } from "@/lib/ghl/sync";
import {
  moveClientPipelineStage,
  stageForRoundSent,
  stageForRoundResults,
} from "@/lib/ghl/pipeline";
import { syncRoundLettersToDrive } from "@/lib/google-drive/letter-sync";
import {
  notifyRoundSent,
  notifyDeletionWin,
  notifyRoundResults,
  notifyGoalAchieved,
  NOTIFIABLE_CLIENT_COLUMNS,
  type NotifiableClient,
} from "@/lib/ghl/notifications";
import type {
  Bureau,
  DisputeResult,
  DisputeStatus,
  LetterType,
} from "@/types";

export interface RoundItemSelection {
  negativeItemId: string;
  bureau: Bureau;
  letterType: LetterType;
}

export type CreateRoundResult =
  | { success: true; roundId: string }
  | { success: false; error: string };

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns an error message on failure, or null on success — same duplicate
 *  helper exists in items/actions.ts (not in scope for this fix). */
async function recomputeClientItemTotals(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientId: string
): Promise<string | null> {
  const [{ count: total }, { count: deleted }] = await Promise.all([
    supabase
      .from("negative_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("negative_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("dispute_status", "deleted"),
  ]);
  const totalCount = total ?? 0;
  const { data: client } = await supabase
    .from("clients")
    .select("total_items_start")
    .eq("id", clientId)
    .single();
  const { error } = await supabase
    .from("clients")
    .update({
      total_items_current: totalCount,
      total_items_deleted: deleted ?? 0,
      total_items_start: Math.max(client?.total_items_start ?? 0, totalCount),
    })
    .eq("id", clientId);
  return error?.message ?? null;
}

export async function createRound(
  clientId: string,
  selections: RoundItemSelection[]
): Promise<CreateRoundResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (selections.length === 0)
    return { success: false, error: "Select at least one item to dispute." };

  const supabase = await createServerSupabaseClient();

  const { data: gateClient } = await supabase
    .from("clients")
    .select("payment_status")
    .eq("id", clientId)
    .single();
  if (gateClient?.payment_status === "failed" || gateClient?.payment_status === "paused") {
    return {
      success: false,
      error: "Cannot create a new round — client payment is not active. Update payment status in client settings.",
    };
  }

  // Next round number = current max + 1.
  const { data: last } = await supabase
    .from("dispute_rounds")
    .select("round_number")
    .eq("client_id", clientId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const roundNumber = (last?.round_number ?? 0) + 1;

  const { data: round, error: roundError } = await supabase
    .from("dispute_rounds")
    .insert({
      client_id: clientId,
      agency_id: session.agency.id,
      round_number: roundNumber,
      status: "preparing",
      total_items_disputed: selections.length,
    })
    .select("id")
    .single();

  if (roundError || !round)
    return {
      success: false,
      error: roundError?.message ?? "Could not create round.",
    };

  const disputeRows = selections.map((s) => ({
    round_id: round.id,
    client_id: clientId,
    agency_id: session.agency.id,
    negative_item_id: s.negativeItemId,
    bureau: s.bureau,
    letter_type: s.letterType,
    result: "pending" as DisputeResult,
  }));

  const { error: disputeError } = await supabase
    .from("disputes")
    .insert(disputeRows);
  if (disputeError) {
    // Roll back the round so we don't leave an empty shell.
    await supabase.from("dispute_rounds").delete().eq("id", round.id);
    return { success: false, error: disputeError.message };
  }

  const itemIds = selections.map((s) => s.negativeItemId);
  const { error: itemsError } = await supabase
    .from("negative_items")
    .update({ dispute_status: "in_dispute", round_disputed: roundNumber })
    .in("id", itemIds);
  if (itemsError) {
    // Cheap to roll back at this point — same reasoning as the disputeError
    // rollback above: don't leave a round/disputes shell whose items were
    // never actually marked in_dispute.
    await supabase.from("disputes").delete().eq("round_id", round.id);
    await supabase.from("dispute_rounds").delete().eq("id", round.id);
    return { success: false, error: itemsError.message };
  }

  const { error: currentRoundError } = await supabase
    .from("clients")
    .update({ current_round: roundNumber })
    .eq("id", clientId);
  if (currentRoundError) {
    // Round/disputes/items already persisted correctly at this point — a
    // rollback here would discard real work over a secondary field. Report
    // the partial state honestly instead of claiming full success.
    return {
      success: false,
      error: `Round ${roundNumber} was created, but the client's current-round marker failed to update: ${currentRoundError.message}. The round exists — reload the page rather than retrying creation.`,
    };
  }

  // Auto-progress a client out of the intake phases once real work begins.
  // Best-effort/cosmetic (a status nudge, not round data) — logged on
  // failure but doesn't block the round's success.
  const { error: statusTransitionError } = await supabase
    .from("clients")
    .update({ status: "active" })
    .eq("id", clientId)
    .in("status", ["onboarding", "analysis"]);
  if (statusTransitionError) {
    console.error(
      `[createRound] Client status auto-progress failed for ${clientId}:`,
      statusTransitionError
    );
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: `Round ${roundNumber} created`,
    description: `Round ${roundNumber} started with ${selections.length} item${
      selections.length === 1 ? "" : "s"
    }.`,
  });

  revalidatePath(`/clients/${clientId}`);
  return { success: true, roundId: round.id };
}

export async function saveLetterContent(
  clientId: string,
  roundId: string,
  disputeId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  // Editing content always requires re-review, so clear the finalized flag.
  // Compliance was checked against the pre-edit text, so it no longer
  // reflects what's on the page — clear it rather than show a stale badge;
  // Regenerate re-runs the check against the fresh content.
  const { error } = await supabase
    .from("disputes")
    .update({
      letter_content: content,
      is_finalized: false,
      finalized_at: null,
      compliance_status: null,
      compliance_checks: null,
      compliance_checked_at: null,
    })
    .eq("id", disputeId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/clients/${clientId}/rounds/${roundId}`);
  return { success: true };
}

/** Persists a letter's finalized state so it survives reloads and is shared across staff. */
export async function setLetterFinalized(
  clientId: string,
  roundId: string,
  disputeId: string,
  finalized: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("disputes")
    .update({
      is_finalized: finalized,
      finalized_at: finalized ? new Date().toISOString() : null,
    })
    .eq("id", disputeId);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/clients/${clientId}/rounds/${roundId}`);
  return { success: true };
}

export async function markRoundSent(
  clientId: string,
  roundId: string,
  trackingNumbers: Record<string, string>,
  acknowledgedFlags = false
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  const { data: round } = await supabase
    .from("dispute_rounds")
    .select("round_number, total_items_disputed")
    .eq("id", roundId)
    .single();
  if (!round) return { success: false, error: "Round not found." };

  // Client-side already shows every flagged letter and requires the
  // acknowledgment checkbox before this is even called — re-verified here
  // since a client-only gate is trivially bypassable.
  const { count: flaggedCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId)
    .eq("compliance_status", "flagged");
  if ((flaggedCount ?? 0) > 0 && !acknowledgedFlags) {
    return {
      success: false,
      error: "Review the flagged letters and confirm before sending.",
    };
  }
  if ((flaggedCount ?? 0) > 0) {
    await supabase.from("activity_log").insert({
      agency_id: session.agency.id,
      client_id: clientId,
      actor_type: "staff",
      actor_id: session.userId,
      action: "Compliance flags acknowledged",
      description: `Staff acknowledged ${flaggedCount} flagged letter(s) before marking Round ${round.round_number} as sent.`,
      metadata: { round_id: roundId, flagged_count: flaggedCount },
    });
  }

  const sentDate = today();
  const deadline = calculateDeadline(sentDate, 35)
    .toISOString()
    .split("T")[0];

  const { error } = await supabase
    .from("dispute_rounds")
    .update({
      status: "awaiting_response",
      date_sent: sentDate,
      response_deadline: deadline,
    })
    .eq("id", roundId);
  if (error) return { success: false, error: error.message };

  // Persist any certified-mail tracking numbers.
  for (const [disputeId, num] of Object.entries(trackingNumbers)) {
    if (num.trim()) {
      await supabase
        .from("disputes")
        .update({ certified_mail_number: num.trim() })
        .eq("id", disputeId);
    }
  }

  await supabase
    .from("clients")
    .update({ current_round: round.round_number, status: "active" })
    .eq("id", clientId);

  const { data: notifClient } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();

  // Best-effort GHL field/tag sync + webhook notification — run concurrently,
  // neither blocks the other (both are independently best-effort).
  const { ghl_api_key, ghl_location_id } = session.agency;
  await Promise.allSettled([
    (async () => {
      if (ghl_api_key && ghl_location_id && notifClient?.ghl_contact_id) {
        const contactId = notifClient.ghl_contact_id;
        await runGhlSync({
          agencyId: session.agency.id,
          clientId,
          action: "sync_round_sent",
          payload: {
            contactId,
            roundNumber: round.round_number,
            itemsDisputed: round.total_items_disputed,
          },
          run: () =>
            syncRoundSent(
              contactId,
              round.round_number,
              round.total_items_disputed,
              { apiKey: ghl_api_key, locationId: ghl_location_id }
            ),
        });
      }
    })(),
    (async () => {
      if (notifClient) {
        await notifyRoundSent(session.agency, notifClient as NotifiableClient, {
          round_number: round.round_number,
          total_items_disputed: round.total_items_disputed,
          response_deadline: deadline,
        });
      }
    })(),
    (async () => {
      if (notifClient) {
        await moveClientPipelineStage(
          session.agency,
          notifClient,
          stageForRoundSent(round.round_number)
        );
      }
    })(),
  ]);

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: `Round ${round.round_number} sent`,
    description: `Round ${round.round_number} sent — ${round.total_items_disputed} item${
      round.total_items_disputed === 1 ? "" : "s"
    } disputed.`,
  });

  // Non-blocking: back up the finalized letter PDFs to the agency's Drive.
  const agency = session.agency;
  after(async () => {
    try {
      await syncRoundLettersToDrive(agency, roundId, round.round_number);
    } catch (err) {
      console.error("[Drive] Round letter sync failed:", err);
    }
  });

  revalidatePath(`/clients/${clientId}/rounds/${roundId}`);
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export interface ResultEntry {
  disputeId: string;
  negativeItemId: string;
  result: DisputeResult;
  notes: string;
}

// Maps a dispute result onto the underlying negative item's status.
const RESULT_TO_ITEM_STATUS: Record<DisputeResult, DisputeStatus | null> = {
  deleted: "deleted",
  updated: "updated",
  verified: "verified",
  no_response: "in_dispute",
  in_progress: "in_dispute",
  pending: null,
};

export interface ResultScores {
  eq: number | null;
  exp: number | null;
  tu: number | null;
}

export async function logResults(
  clientId: string,
  roundId: string,
  entries: ResultEntry[],
  scores?: ResultScores
): Promise<{
  success: boolean;
  error?: string;
  remainingActive?: number;
  totalDeleted?: number;
}> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const resultDate = today();

  const { data: round } = await supabase
    .from("dispute_rounds")
    .select("round_number, total_items_disputed")
    .eq("id", roundId)
    .single();
  if (!round) return { success: false, error: "Round not found." };

  const tally = {
    deletions: 0,
    updates: 0,
    verified: 0,
    no_response: 0,
  };

  for (const entry of entries) {
    const { error: disputeUpdateError } = await supabase
      .from("disputes")
      .update({
        result: entry.result,
        result_date: resultDate,
        result_notes: entry.notes.trim() || null,
      })
      .eq("id", entry.disputeId);
    if (disputeUpdateError) {
      // Fail fast rather than continuing: the round-level tally below is
      // computed from entries[], not from what actually persisted, so
      // proceeding past a failed entry would let the aggregate stats
      // (total_deletions etc.) overstate what's really in the DB. Earlier
      // entries in this same call already saved and don't need re-doing —
      // retrying just resumes from the failed one.
      return {
        success: false,
        error: `Failed to save result for item: ${disputeUpdateError.message}`,
      };
    }

    const itemStatus = RESULT_TO_ITEM_STATUS[entry.result];
    if (itemStatus) {
      const { error: itemUpdateError } = await supabase
        .from("negative_items")
        .update({
          dispute_status: itemStatus,
          round_resolved:
            entry.result === "deleted" ? round.round_number : null,
          resolution_notes: entry.notes.trim() || null,
        })
        .eq("id", entry.negativeItemId);
      if (itemUpdateError) {
        return {
          success: false,
          error: `Result saved, but the item's status failed to update: ${itemUpdateError.message}`,
        };
      }
    }

    if (entry.result === "deleted") tally.deletions++;
    else if (entry.result === "updated") tally.updates++;
    else if (entry.result === "verified") tally.verified++;
    else if (entry.result === "no_response") tally.no_response++;
  }

  const deletedItemIds = entries
    .filter((e) => e.result === "deleted")
    .map((e) => e.negativeItemId);
  let deletedItemNames: string[] = [];
  if (deletedItemIds.length > 0) {
    const { data: deletedRows } = await supabase
      .from("negative_items")
      .select("creditor_name")
      .in("id", deletedItemIds);
    deletedItemNames = (deletedRows ?? []).map((r) => r.creditor_name);
  }

  const { error: roundCompleteError } = await supabase
    .from("dispute_rounds")
    .update({
      status: "complete",
      date_responses_received: resultDate,
      total_deletions: tally.deletions,
      total_updates: tally.updates,
      total_verified: tally.verified,
      total_no_response: tally.no_response,
    })
    .eq("id", roundId);
  if (roundCompleteError) {
    // Every entry's result/item-status above already persisted correctly —
    // only the round's own aggregate/completion state failed. Report it
    // rather than claiming the round is complete when it isn't.
    return {
      success: false,
      error: `Item results were saved, but the round couldn't be marked complete: ${roundCompleteError.message}`,
    };
  }

  const recomputeError = await recomputeClientItemTotals(supabase, clientId);
  if (recomputeError) {
    // The round itself is genuinely complete at this point — only the
    // client's cached item-count totals failed to refresh. Non-fatal to the
    // round's own success, but logged so stale counts on the client header
    // don't go unexplained.
    console.error(
      `[logResults] recomputeClientItemTotals failed for client ${clientId}:`,
      recomputeError
    );
    await supabase.from("activity_log").insert({
      agency_id: session.agency.id,
      client_id: clientId,
      actor_type: "staff",
      actor_id: session.userId,
      action: "Item totals refresh failed",
      description: `Round ${round.round_number} completed, but the client's cached item totals failed to refresh: ${recomputeError}`,
    });
  }

  const { data: notifClient } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();

  // Optional: record updated bureau scores for this round. Updates the client's
  // current scores and snapshots them to score_history for the portal chart.
  const hasScores =
    scores &&
    (scores.eq !== null || scores.exp !== null || scores.tu !== null);
  if (hasScores) {
    const scoreUpdate: Record<string, number> = {};
    if (scores!.eq !== null) scoreUpdate.score_eq_current = scores!.eq;
    if (scores!.exp !== null) scoreUpdate.score_exp_current = scores!.exp;
    if (scores!.tu !== null) scoreUpdate.score_tu_current = scores!.tu;
    const { error: scoreUpdateError } = await supabase
      .from("clients")
      .update(scoreUpdate)
      .eq("id", clientId);
    if (scoreUpdateError) {
      // Item results and round-completion already persisted at this point —
      // only the score write failed. Skip score_history too rather than
      // inserting a history row for a score the client record doesn't
      // actually reflect.
      return {
        success: false,
        error: `Round results were saved, but the score update failed: ${scoreUpdateError.message}`,
      };
    }

    // Keep notifClient in sync so downstream notifications (deletion_win)
    // report this round's freshly-written scores, not the pre-update values.
    if (notifClient) {
      Object.assign(notifClient, scoreUpdate);
    }

    const { error: scoreHistoryError } = await supabase.from("score_history").insert({
      client_id: clientId,
      agency_id: session.agency.id,
      score_eq: scores!.eq,
      score_exp: scores!.exp,
      score_tu: scores!.tu,
      round_number: round.round_number,
      notes: `Round ${round.round_number} update`,
    });
    if (scoreHistoryError) {
      // The client's current score is already correct at this point — this
      // only breaks the portal's historical chart continuity for this round.
      // Logged (visible to staff on the client's Timeline), not fatal to the
      // overall action, since the round/scores themselves are genuinely saved.
      console.error(
        `[logResults] score_history insert failed for client ${clientId}:`,
        scoreHistoryError
      );
      await supabase.from("activity_log").insert({
        agency_id: session.agency.id,
        client_id: clientId,
        actor_type: "staff",
        actor_id: session.userId,
        action: "Score history entry failed",
        description: `Round ${round.round_number}'s current score saved, but the historical score_history entry failed: ${scoreHistoryError.message}`,
      });
    }

    // Best-effort GHL score sync (logged).
    const { ghl_api_key, ghl_location_id } = session.agency;
    if (ghl_api_key && ghl_location_id) {
      const { data: c } = await supabase
        .from("clients")
        .select("ghl_contact_id")
        .eq("id", clientId)
        .single();
      if (c?.ghl_contact_id) {
        const contactId = c.ghl_contact_id;
        const payloadScores = {
          eq: scores!.eq ?? undefined,
          exp: scores!.exp ?? undefined,
          tu: scores!.tu ?? undefined,
        };
        await runGhlSync({
          agencyId: session.agency.id,
          clientId,
          action: "sync_score_update",
          payload: { contactId, scores: payloadScores },
          run: () =>
            syncScoreUpdate(contactId, payloadScores, {
              apiKey: ghl_api_key,
              locationId: ghl_location_id,
            }),
        });
      }
    }
  }

  // Counts for the UI + GHL sync.
  const [{ count: remaining }, { count: totalDeleted }] = await Promise.all([
    supabase
      .from("negative_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("dispute_status", "deleted"),
    supabase
      .from("negative_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("dispute_status", "deleted"),
  ]);

  // Best-effort GHL deletion sync + both notifications — run concurrently.
  const { ghl_api_key: resultsGhlApiKey, ghl_location_id: resultsGhlLocationId } = session.agency;
  await Promise.allSettled([
    (async () => {
      if (tally.deletions > 0 && resultsGhlApiKey && resultsGhlLocationId && notifClient?.ghl_contact_id) {
        const contactId = notifClient.ghl_contact_id;
        const deletions = tally.deletions;
        const total = totalDeleted ?? 0;
        await runGhlSync({
          agencyId: session.agency.id,
          clientId,
          action: "sync_deletion",
          payload: {
            contactId,
            deletionsThisRound: deletions,
            totalDeletions: total,
          },
          run: () =>
            syncDeletionAchieved(contactId, deletions, total, {
              apiKey: resultsGhlApiKey,
              locationId: resultsGhlLocationId,
            }),
        });
      }
    })(),
    (async () => {
      if (notifClient && tally.deletions > 0) {
        await notifyDeletionWin(
          session.agency,
          notifClient as NotifiableClient,
          tally.deletions,
          totalDeleted ?? 0,
          deletedItemNames
        );
      }
    })(),
    (async () => {
      if (notifClient) {
        await notifyRoundResults(session.agency, notifClient as NotifiableClient, {
          round_number: round.round_number,
          total_items_disputed: round.total_items_disputed,
          total_deletions: tally.deletions,
          total_verified: tally.verified,
          total_no_response: tally.no_response,
        });
      }
    })(),
    (async () => {
      if (notifClient) {
        await moveClientPipelineStage(
          session.agency,
          notifClient,
          stageForRoundResults(round.round_number)
        );
      }
    })(),
  ]);

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: `Round ${round.round_number} results logged`,
    description: `Round ${round.round_number} results: ${tally.deletions} deleted, ${tally.verified} verified, ${tally.no_response} no response.`,
  });

  revalidatePath(`/clients/${clientId}/rounds/${roundId}`);
  revalidatePath(`/clients/${clientId}`);
  return {
    success: true,
    remainingActive: remaining ?? 0,
    totalDeleted: totalDeleted ?? 0,
  };
}

export async function markClientCompleted(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clients")
    .update({ status: "completed" })
    .eq("id", clientId);
  if (error) return { success: false, error: error.message };

  const { data: notifClient } = await supabase
    .from("clients")
    .select(NOTIFIABLE_CLIENT_COLUMNS)
    .eq("id", clientId)
    .single();

  const { ghl_api_key, ghl_location_id } = session.agency;
  await Promise.allSettled([
    (async () => {
      if (ghl_api_key && ghl_location_id && notifClient?.ghl_contact_id) {
        const contactId = notifClient.ghl_contact_id;
        await runGhlSync({
          agencyId: session.agency.id,
          clientId,
          action: "sync_completed",
          payload: { contactId },
          run: () =>
            syncClientCompleted(contactId, {
              apiKey: ghl_api_key,
              locationId: ghl_location_id,
            }),
        });
      }
    })(),
    (async () => {
      if (notifClient) {
        await notifyGoalAchieved(session.agency, notifClient as NotifiableClient);
      }
    })(),
    (async () => {
      if (notifClient) {
        await moveClientPipelineStage(session.agency, notifClient, "goal_achieved");
      }
    })(),
  ]);

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Client completed",
    description: "Client marked as completed — goal achieved.",
  });

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
