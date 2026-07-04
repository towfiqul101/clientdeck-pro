import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import type { GHLNotificationType } from "@/lib/ghl/notifications";

const TEST_PAYLOADS: Record<GHLNotificationType, Record<string, unknown>> = {
  round_sent: {
    round_number: 1,
    items_disputed: 5,
    response_deadline: "2026-08-15",
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
  },
  deletion_win: {
    deletions_this_round: 2,
    total_deletions: 4,
    deleted_items_list: "Capital One Collections, Medical Bill",
    score_eq: 620,
    score_exp: 615,
    score_tu: 618,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
  },
  round_results_in: {
    round_number: 1,
    total_deletions: 2,
    total_verified: 1,
    total_no_response: 0,
    total_items_disputed: 3,
    has_wins: true,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
  },
  goal_achieved: {
    total_deletions: 6,
    score_improvement: 85,
    final_score_eq: 700,
    final_score_exp: 695,
    final_score_tu: 698,
    months_in_program: 8,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
    review_link: "https://g.page/r/test/review",
  },
  payment_failed: {
    monthly_fee: 99,
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
    agency_phone: "(555) 123-4567",
  },
  portal_link: {
    portal_link: "https://app.clientdeckpro.com/portal?token=test",
    agency_name: "Test Agency",
  },
  staff_new_client: {
    client_name: "Test Client",
    client_email: "test@example.com",
    client_phone: "(555) 987-6543",
    dashboard_link: "https://app.clientdeckpro.com/clients/test",
  },
  staff_round_overdue: {
    client_name: "Test Client",
    round_number: 2,
    days_overdue: 5,
    dashboard_link: "https://app.clientdeckpro.com/clients/test",
  },
  staff_next_round_ready: {
    client_name: "Test Client",
    round_number: 3,
    dashboard_link: "https://app.clientdeckpro.com/clients/test",
  },
};

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ success: false, error: "Not authenticated." }, { status: 401 });

  const { webhookUrl, notificationType } = (await req.json()) as {
    webhookUrl?: string;
    notificationType?: GHLNotificationType;
  };

  if (!webhookUrl || !notificationType || !(notificationType in TEST_PAYLOADS)) {
    return NextResponse.json({ success: false, error: "Missing or invalid webhookUrl/notificationType." });
  }

  const payload = {
    contact_id: "test",
    first_name: "Test",
    last_name: "Client",
    ...TEST_PAYLOADS[notificationType],
    triggered_at: new Date().toISOString(),
    source: "clientdeck_pro",
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ success: res.ok, status: res.status });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
}
