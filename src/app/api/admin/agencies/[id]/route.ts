import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/tool-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency } from "@/types";
import type { AgencyPanelData } from "@/lib/admin/agency-panel";
import { maskSecret } from "@/lib/utils/secrets";

export const dynamic = "force-dynamic";

/** Slide-over panel payload: agency + client count + payment history + GHL status. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: agency } = await admin
    .from("agencies")
    .select("*")
    .eq("id", id)
    .single();

  if (!agency) {
    return NextResponse.json({ ok: false, error: "Agency not found" }, { status: 404 });
  }

  const [{ count: clientCount }, { data: payments }, { data: lastSync }, { count: pullsThisMonth }] =
    await Promise.all([
      admin
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", id),
      admin
        .from("manual_payments")
        .select("id, amount, payment_method, reference_number, notes, created_at")
        .eq("agency_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("ghl_sync_log")
        .select("attempted_at")
        .eq("agency_id", id)
        .order("attempted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("credit_monitoring_pulls")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", id)
        .gte("pulled_at", new Date(new Date().setDate(1)).toISOString()),
    ]);

  const a = agency as Agency;

  // Never ship plaintext secrets to the browser: API keys are masked (last 4
  // kept as a visual reference for the admin) and Drive OAuth tokens dropped.
  // The slide-over save/test actions read the real values server-side.
  const sanitizedAgency: Agency = {
    ...a,
    ghl_api_key: a.ghl_api_key ? maskSecret(a.ghl_api_key) : null,
    credit_monitoring_api_key: a.credit_monitoring_api_key
      ? maskSecret(a.credit_monitoring_api_key)
      : null,
    credit_monitoring_api_secret: a.credit_monitoring_api_secret
      ? maskSecret(a.credit_monitoring_api_secret)
      : null,
    google_drive_access_token: null,
    google_drive_refresh_token: null,
    // The webhook token is a live inbound credential — anyone holding it can
    // post contact data into this agency. The admin panel has no use for it,
    // and `...a` would otherwise ship it to the browser.
    webhook_token: maskSecret(a.webhook_token),
  };

  const payload: AgencyPanelData = {
    agency: sanitizedAgency,
    clientCount: clientCount ?? 0,
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      reference_number: p.reference_number,
      notes: p.notes,
      created_at: p.created_at,
    })),
    ghl: {
      configured: Boolean(a.ghl_api_key && a.ghl_location_id),
      lastSyncAt: lastSync?.attempted_at ?? null,
    },
    creditMonitoring: {
      pullsThisMonth: pullsThisMonth ?? 0,
    },
  };

  return NextResponse.json({ ok: true, data: payload });
}
