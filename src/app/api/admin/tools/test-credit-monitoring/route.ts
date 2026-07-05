import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/tool-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { testConnection } from "@/lib/credit-monitoring";
import type { CreditMonitoringService } from "@/types";

export const dynamic = "force-dynamic";

/** Admin-triggered credential check for an agency's configured credit monitoring provider. */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { agencyId } = await request.json().catch(() => ({ agencyId: "" }));
  if (!agencyId) {
    return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("credit_monitoring_service, credit_monitoring_api_key, credit_monitoring_api_secret")
    .eq("id", agencyId)
    .single();

  if (!agency || agency.credit_monitoring_service === "none") {
    return NextResponse.json({ ok: false, message: "Credit monitoring is not configured for this agency." });
  }

  const result = await testConnection(
    agency.credit_monitoring_service as CreditMonitoringService,
    agency.credit_monitoring_api_key ?? "",
    agency.credit_monitoring_api_secret ?? ""
  );

  return NextResponse.json({ ok: result.ok, message: result.message });
}
