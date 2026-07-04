import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { addGHLTag, createGHLTask } from "@/lib/ghl/api";
import { sendGHLNotification } from "@/lib/ghl/notifications";
import { suggestLetterType } from "@/lib/utils/helpers";
import type { Agency, DisputeStatus, LetterType } from "@/types";

export const maxDuration = 60;

// Items that were disputed but not removed still need another round.
const RE_DISPUTE_STATUSES: DisputeStatus[] = ["verified", "updated", "in_dispute"];

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: agencies } = await admin.from("agencies").select("*");

  let created = 0;
  const nowMs = Date.now();

  for (const agency of agencies ?? []) {
    const settings = (agency.settings ?? {}) as {
      auto_create_rounds?: boolean; auto_round_delay_days?: number;
    };
    if (!settings.auto_create_rounds) continue;
    const delayDays = settings.auto_round_delay_days ?? 5;

    const { data: clients } = await admin
      .from("clients")
      .select("id, current_round, ghl_contact_id, first_name, last_name, payment_status, status")
      .eq("agency_id", agency.id)
      .eq("status", "active");

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

      const daysSince = (nowMs - new Date(lastRound.date_responses_received).getTime()) / 86400000;
      if (daysSince < delayDays) continue;

      const { data: items } = await admin
        .from("negative_items")
        .select("id, bureau")
        .eq("client_id", client.id)
        .in("dispute_status", RE_DISPUTE_STATUSES);
      if (!items || items.length === 0) continue;

      const roundNumber = (lastRound.round_number ?? 0) + 1;
      const { data: round } = await admin
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
      if (!round) continue;

      const letterType = suggestLetterType(roundNumber, "verified") as LetterType;
      await admin.from("disputes").insert(
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
      await admin.from("negative_items")
        .update({ dispute_status: "in_dispute", round_disputed: roundNumber })
        .in("id", items.map((it) => it.id));
      await admin.from("clients").update({ current_round: roundNumber }).eq("id", client.id);

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
      if (opts && client.ghl_contact_id) {
        try {
          await addGHLTag(client.ghl_contact_id, ["next-round-ready"], opts);
          await createGHLTask(
            client.ghl_contact_id,
            `Round ${roundNumber} is ready for ${client.first_name} ${client.last_name} — review and generate letters`,
            new Date().toISOString(),
            opts
          );
        } catch (e) { console.error("auto-create-rounds: GHL sync failed", e); }
      }

      const ownerContactId = (agency as Agency).settings?.owner_ghl_contact_id;
      if (ownerContactId) {
        try {
          const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.clientdeckpro.com";
          await sendGHLNotification(
            agency as Agency,
            "staff_next_round_ready",
            {
              contactId: ownerContactId,
              firstName: "Team",
              lastName: (agency as Agency).name,
              data: {
                client_name: `${client.first_name} ${client.last_name}`,
                round_number: roundNumber,
                dashboard_link: `${base}/clients/${client.id}`,
              },
            },
            { agencyId: agency.id, clientId: client.id }
          );
        } catch (e) {
          console.error("auto-create-rounds: staff notification failed", e);
        }
      }
      created++;
    }
  }

  return NextResponse.json({ roundsCreated: created });
}
