import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createGHLTask } from "@/lib/ghl/api";
import { daysRemaining } from "@/lib/utils/helpers";
import { notifyStaffRoundOverdue, type NotifiableClient } from "@/lib/ghl/notifications";
import type { Agency } from "@/types";

export const maxDuration = 120;

interface OverdueRoundRow {
  id: string;
  round_number: number;
  agency_id: string;
  client_id: string;
  response_deadline: string;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    ghl_contact_id: string | null;
  } | null;
  agency: Agency | null;
}

/**
 * Flags dispute rounds that blew past their 35-day response deadline. Logs an
 * activity entry (deduped per round per day) and, when GHL is configured,
 * creates a staff task to escalate. Runs daily via Vercel Cron (GET request).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await admin
    .from("dispute_rounds")
    .select(
      "id, round_number, agency_id, client_id, response_deadline, client:clients(id, first_name, last_name, email, phone, ghl_contact_id), agency:agencies(*)"
    )
    .eq("status", "awaiting_response")
    .lt("response_deadline", today);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const overdue = (data ?? []) as unknown as OverdueRoundRow[];

  // Dedup: skip rounds we already flagged in the last 20 hours.
  const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs } = await admin
    .from("activity_log")
    .select("metadata")
    .eq("action", "Round overdue")
    .gte("created_at", since);
  const alreadyFlagged = new Set(
    (recentLogs ?? [])
      .map((l) => (l.metadata as { round_id?: string } | null)?.round_id)
      .filter(Boolean)
  );

  const clientsAffected = new Set<string>();
  let flagged = 0;

  for (const round of overdue) {
    clientsAffected.add(round.client_id);
    if (alreadyFlagged.has(round.id)) continue;

    const name = round.client
      ? `${round.client.first_name} ${round.client.last_name}`
      : "client";
    const daysOver = Math.abs(daysRemaining(round.response_deadline));

    await admin.from("activity_log").insert({
      agency_id: round.agency_id,
      client_id: round.client_id,
      actor_type: "system",
      action: "Round overdue",
      description: `Round ${round.round_number} for ${name} is overdue — bureau did not respond within 35 days (${daysOver} days past deadline).`,
      metadata: { round_id: round.id, days_overdue: daysOver },
    });
    flagged++;

    // Best-effort GHL reminder task for staff (existing channel).
    const apiKey = round.agency?.ghl_api_key;
    const locationId = round.agency?.ghl_location_id;
    const contactId = round.client?.ghl_contact_id;
    if (apiKey && locationId && contactId) {
      try {
        await createGHLTask(
          contactId,
          `Escalate Round ${round.round_number} — bureau response overdue`,
          new Date().toISOString(),
          { apiKey, locationId }
        );
      } catch (e) {
        console.error("check-deadlines: GHL task failed", e);
      }
    }

    // Best-effort GHL webhook notification (independent channel).
    if (round.agency && round.client) {
      const notifClient: NotifiableClient = {
        id: round.client.id,
        first_name: round.client.first_name,
        last_name: round.client.last_name,
        email: round.client.email,
        phone: round.client.phone,
        ghl_contact_id: round.client.ghl_contact_id,
        portal_token: null,
        monthly_fee: 0,
        total_items_deleted: 0,
        service_start_date: today,
        score_eq_current: null,
        score_exp_current: null,
        score_tu_current: null,
        score_eq_start: null,
        score_exp_start: null,
        score_tu_start: null,
      };
      try {
        await notifyStaffRoundOverdue(round.agency, notifClient, round.round_number, daysOver);
      } catch (e) {
        console.error("check-deadlines: staff notification failed", e);
      }
    }
  }

  return NextResponse.json({
    overdueCount: overdue.length,
    newlyFlagged: flagged,
    clientsAffected: clientsAffected.size,
  });
}
