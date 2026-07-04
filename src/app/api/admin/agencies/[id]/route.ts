import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/tool-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agency } from "@/types";
import type { AgencyPanelData } from "@/lib/admin/agency-panel";

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

  const [{ count: clientCount }, { data: payments }, { data: lastSync }] =
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
    ]);

  const a = agency as Agency;

  const payload: AgencyPanelData = {
    agency: a,
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
  };

  return NextResponse.json({ ok: true, data: payload });
}
