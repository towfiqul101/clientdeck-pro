import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { addGHLTag, createGHLTask } from "@/lib/ghl/api";
import { notifyStaffNextRoundReady } from "@/lib/ghl/notifications";
import { suggestLetterType, daysSinceDate } from "@/lib/utils/helpers";
import type { Agency, DisputeStatus, LetterType } from "@/types";

export const maxDuration = 60;

// Items that were disputed but not removed still need another round.
const RE_DISPUTE_STATUSES: DisputeStatus[] = ["verified", "updated", "in_dispute"];

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: agencies, error: agenciesError } = await admin.from("agencies").select("*");
  if (agenciesError) {
    console.error("auto-create-rounds: failed to list agencies", agenciesError);
    return NextResponse.json(
      { error: "Could not list agencies.", detail: agenciesError.message },
      { status: 500 }
    );
  }

  let created = 0;
  const errors: string[] = [];

  for (const agency of agencies ?? []) {
    const settings = (agency.settings ?? {}) as {
      auto_create_rounds?: boolean; auto_round_delay_days?: number; timezone?: string;
    };
    if (!settings.auto_create_rounds) continue;
    const delayDays = settings.auto_round_delay_days ?? 5;

    const { data: clients, error: clientsError } = await admin
      .from("clients")
      .select(
        "id, current_round, ghl_contact_id, first_name, last_name, payment_status, status, assigned_to, notify_team_member_ids"
      )
      .eq("agency_id", agency.id)
      .eq("status", "active");
    if (clientsError) {
      console.error(`auto-create-rounds: failed to list clients for agency ${agency.id}`, clientsError);
      errors.push(`agency ${agency.id}: client list failed — ${clientsError.message}`);
      continue;
    }

    for (const client of clients ?? []) {
      if (client.payment_status === "failed" || client.payment_status === "paused") continue;

      const { data: lastRound } = await admin
        .from("dispute_rounds")
        .select("round_number, status, date_responses_received")
        .eq("client_id", client.id)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastRound || lastRound.status !== "complete" || !lastRound.date_responses_received) continue;

      // Calendar-day diff in the agency's own timezone, not a raw real-time
      // ms diff off the server's UTC clock — settings.timezone was collected
      // in Settings but previously never actually read anywhere.
      const daysSince = daysSinceDate(lastRound.date_responses_received, settings.timezone);
      if (daysSince < delayDays) continue;

      const { data: items, error: itemsQueryError } = await admin
        .from("negative_items")
        .select("id, bureau")
        .eq("client_id", client.id)
        .in("dispute_status", RE_DISPUTE_STATUSES);
      if (itemsQueryError) {
        console.error(`auto-create-rounds: failed to list items for client ${client.id}`, itemsQueryError);
        errors.push(`client ${client.id}: item list failed — ${itemsQueryError.message}`);
        continue;
      }
      if (!items || items.length === 0) continue;

      const roundNumber = (lastRound.round_number ?? 0) + 1;
      const { data: round, error: roundError } = await admin
        .from("dispute_rounds")
        .insert({
          client_id: client.id,
          agency_id: agency.id,
          round_number: roundNumber,
          status: "preparing",
          total_items_disputed: items.length,
        })
        .select("id")
        .single();
      if (roundError || !round) {
        console.error(`auto-create-rounds: round creation failed for client ${client.id}`, roundError);
        errors.push(`client ${client.id}: round creation failed — ${roundError?.message ?? "no round returned"}`);
        await admin.from("activity_log").insert({
          agency_id: agency.id,
          client_id: client.id,
          actor_type: "system",
          action: "Auto-create-round failed",
          description: `Round ${roundNumber} auto-creation failed: ${roundError?.message ?? "no round returned"}`,
        });
        continue;
      }

      const letterType = suggestLetterType(roundNumber, "verified") as LetterType;
      const { error: disputesError } = await admin.from("disputes").insert(
        items.map((it) => ({
          round_id: round.id,
          client_id: client.id,
          agency_id: agency.id,
          negative_item_id: it.id,
          bureau: it.bureau,
          letter_type: letterType,
          result: "pending",
        }))
      );
      if (disputesError) {
        // Roll back the round so we don't leave an empty shell — same
        // reasoning as the dashboard's own createRound().
        await admin.from("dispute_rounds").delete().eq("id", round.id);
        console.error(`auto-create-rounds: disputes insert failed for client ${client.id}`, disputesError);
        errors.push(`client ${client.id}: disputes insert failed — ${disputesError.message}`);
        await admin.from("activity_log").insert({
          agency_id: agency.id,
          client_id: client.id,
          actor_type: "system",
          action: "Auto-create-round failed",
          description: `Round ${roundNumber} auto-creation rolled back: ${disputesError.message}`,
        });
        continue;
      }

      const { error: itemsUpdateError } = await admin
        .from("negative_items")
        .update({ dispute_status: "in_dispute", round_disputed: roundNumber })
        .in("id", items.map((it) => it.id));
      if (itemsUpdateError) {
        // Cheap to roll back at this point, same as disputesError above.
        await admin.from("disputes").delete().eq("round_id", round.id);
        await admin.from("dispute_rounds").delete().eq("id", round.id);
        console.error(`auto-create-rounds: item status update failed for client ${client.id}`, itemsUpdateError);
        errors.push(`client ${client.id}: item status update failed — ${itemsUpdateError.message}`);
        await admin.from("activity_log").insert({
          agency_id: agency.id,
          client_id: client.id,
          actor_type: "system",
          action: "Auto-create-round failed",
          description: `Round ${roundNumber} auto-creation rolled back: ${itemsUpdateError.message}`,
        });
        continue;
      }

      const { error: currentRoundError } = await admin
        .from("clients")
        .update({ current_round: roundNumber })
        .eq("id", client.id);
      if (currentRoundError) {
        // Round/disputes/items already persisted correctly — report the
        // partial state honestly rather than silently ignoring it, same as
        // the dashboard's own createRound().
        console.error(`auto-create-rounds: current_round update failed for client ${client.id}`, currentRoundError);
        errors.push(`client ${client.id}: current_round update failed — ${currentRoundError.message}`);
        await admin.from("activity_log").insert({
          agency_id: agency.id,
          client_id: client.id,
          actor_type: "system",
          action: "Auto-create-round partially failed",
          description: `Round ${roundNumber} was created, but the client's current-round marker failed to update: ${currentRoundError.message}`,
        });
      }

      await admin.from("activity_log").insert({
        agency_id: agency.id,
        client_id: client.id,
        actor_type: "system",
        action: `Round ${roundNumber} auto-created`,
        description: `Round ${roundNumber} auto-prepared with ${items.length} remaining item(s).`,
      });

      const opts = agency.ghl_api_key && agency.ghl_location_id
        ? { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id }
        : null;
      await Promise.allSettled([
        (async () => {
          if (opts && client.ghl_contact_id) {
            await addGHLTag(client.ghl_contact_id, ["next-round-ready"], opts);
            await createGHLTask(
              client.ghl_contact_id,
              `Round ${roundNumber} is ready for ${client.first_name} ${client.last_name} — review and generate letters`,
              new Date().toISOString(),
              opts
            );
          }
        })().catch((e) => console.error("auto-create-rounds: GHL sync failed", e)),
        notifyStaffNextRoundReady(agency as Agency, client, roundNumber).catch((e) =>
          console.error("auto-create-rounds: staff notification failed", e)
        ),
      ]);
      created++;
    }
  }

  return NextResponse.json({ roundsCreated: created, errors });
}
