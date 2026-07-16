import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createGHLTask } from "@/lib/ghl/api";
import { daysSinceDate, todayInTimezone } from "@/lib/utils/helpers";
import { notifyStaffRoundOverdue, type NotifiableClient } from "@/lib/ghl/notifications";
import { notifyAdmin } from "@/lib/admin/notify";
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
    assigned_to: string | null;
    notify_team_member_ids: string[];
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
  // Broadened by 1 day past the server's UTC "today": an agency in a
  // timezone ahead of UTC can have already crossed into the next local
  // calendar day — and so genuinely be overdue — before UTC's date string
  // reflects it. The precise per-agency-timezone check happens in the loop
  // below; this just avoids missing rows at the UTC boundary.
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const { data, error } = await admin
    .from("dispute_rounds")
    .select(
      "id, round_number, agency_id, client_id, response_deadline, client:clients(id, first_name, last_name, email, phone, ghl_contact_id, assigned_to, notify_team_member_ids), agency:agencies(*)"
    )
    .eq("status", "awaiting_response")
    .lte("response_deadline", tomorrow);

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
    // Precise check: was this round's deadline actually passed as of "today"
    // in the agency's OWN timezone (settings.timezone), not just the broad
    // UTC-based window the query fetched? A round whose deadline is
    // tomorrow-UTC but not yet passed locally isn't overdue yet.
    const agencySettings = round.agency?.settings as { timezone?: string } | undefined;
    const agencyToday = todayInTimezone(agencySettings?.timezone);
    if (round.response_deadline >= agencyToday) continue;

    clientsAffected.add(round.client_id);
    if (alreadyFlagged.has(round.id)) continue;

    const name = round.client
      ? `${round.client.first_name} ${round.client.last_name}`
      : "client";
    const daysOver = daysSinceDate(round.response_deadline, agencySettings?.timezone);

    await admin.from("activity_log").insert({
      agency_id: round.agency_id,
      client_id: round.client_id,
      actor_type: "system",
      action: "Round overdue",
      description: `Round ${round.round_number} for ${name} is overdue — bureau did not respond within 35 days (${daysOver} days past deadline).`,
      metadata: { round_id: round.id, days_overdue: daysOver },
    });
    flagged++;

    // Best-effort GHL reminder task + webhook notification — run concurrently.
    const apiKey = round.agency?.ghl_api_key;
    const locationId = round.agency?.ghl_location_id;
    const contactId = round.client?.ghl_contact_id;
    await Promise.allSettled([
      (async () => {
        if (apiKey && locationId && contactId) {
          await createGHLTask(
            contactId,
            `Escalate Round ${round.round_number} — bureau response overdue`,
            new Date().toISOString(),
            { apiKey, locationId }
          );
        }
      })().catch((e) => console.error("check-deadlines: GHL task failed", e)),
      (async () => {
        if (!round.agency || !round.client) return;
        const notifClient: NotifiableClient = {
          id: round.client.id,
          first_name: round.client.first_name,
          last_name: round.client.last_name,
          email: round.client.email,
          phone: round.client.phone,
          ghl_contact_id: round.client.ghl_contact_id,
          assigned_to: round.client.assigned_to,
          notify_team_member_ids: round.client.notify_team_member_ids,
          ghl_opportunity_id: null,
          portal_token: null,
          monthly_fee: 0,
          total_items_deleted: 0,
          total_items_start: 0,
          service_start_date: today,
          score_eq_current: null,
          score_exp_current: null,
          score_tu_current: null,
          score_eq_start: null,
          score_exp_start: null,
          score_tu_start: null,
        };
        await notifyStaffRoundOverdue(round.agency, notifClient, round.round_number, daysOver);
      })().catch((e) => console.error("check-deadlines: staff notification failed", e)),
    ]);
  }

  // Super-admin heads-up: trials ending within 3 days. Runs on this daily
  // cron (Hobby crons are daily-only); notifyAdmin's per-day throttle keeps
  // it to one notification per agency per day even if the cron re-runs.
  const trialsEnding = await checkTrialsEnding(admin);

  return NextResponse.json({
    overdueCount: overdue.length,
    newlyFlagged: flagged,
    clientsAffected: clientsAffected.size,
    trialsEnding,
  });
}

async function checkTrialsEnding(
  admin: ReturnType<typeof createAdminClient>
): Promise<number> {
  const now = new Date();
  const threeDaysOut = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data, error } = await admin
    .from("agencies")
    .select("id, name, owner_email, trial_ends_at")
    .eq("plan_status", "trialing")
    .gte("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", threeDaysOut.toISOString());

  if (error) {
    console.error("check-deadlines: trial-ending query failed", error);
    return 0;
  }

  for (const agency of data ?? []) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(agency.trial_ends_at!).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    );
    await notifyAdmin(
      "trial_ending",
      agency.id,
      `Trial ending in ${daysLeft} day${daysLeft === 1 ? "" : "s"}: ${agency.name}`,
      `${agency.name} (${agency.owner_email}) is on a trial that ends ${agency.trial_ends_at!.slice(0, 10)}. Reach out before it lapses.`,
      { throttlePerDay: true }
    );
  }

  return (data ?? []).length;
}
