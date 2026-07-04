import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { notifyMonthlyProgress, NOTIFIABLE_CLIENT_COLUMNS, type NotifiableClient } from "@/lib/ghl/notifications";
import type { Agency } from "@/types";

export const maxDuration = 60;

function monthsSince(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
}

/**
 * Sends a monthly progress-summary notification to every active client with
 * a GHL contact id, across every agency. Runs on the 1st of each month.
 * Dispatches concurrently per agency (Promise.allSettled) to stay inside the
 * Hobby-plan 60s budget; if the client base grows large enough to risk that
 * ceiling, this will need pagination/chunking across invocations — not
 * built now (YAGNI).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();

  const { data: agencies } = await admin.from("agencies").select("*");
  let sent = 0;
  let attempted = 0;

  for (const agency of agencies ?? []) {
    const { data: clients } = await admin
      .from("clients")
      .select(`${NOTIFIABLE_CLIENT_COLUMNS}, current_round`)
      .eq("agency_id", agency.id)
      .eq("status", "active")
      .not("ghl_contact_id", "is", null);

    if (!clients || clients.length === 0) continue;
    attempted += clients.length;

    const results = await Promise.allSettled(
      clients.map((client) =>
        notifyMonthlyProgress(agency as Agency, client as NotifiableClient, {
          scoreEq: client.score_eq_current,
          scoreExp: client.score_exp_current,
          scoreTu: client.score_tu_current,
          totalDeletions: client.total_items_deleted,
          totalItems: client.total_items_start,
          currentRound: client.current_round,
          monthsInProgram: monthsSince(client.service_start_date),
        })
      )
    );
    sent += results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({ attempted, sent });
}
