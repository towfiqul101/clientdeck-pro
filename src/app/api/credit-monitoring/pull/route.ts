import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { pullCreditScores } from "@/lib/credit-monitoring";
import { updateGHLContactFields } from "@/lib/ghl/api";
import { GHL_FIELD_KEYS } from "@/lib/ghl/field-keys";
import type { Client, CreditMonitoringService } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { agency } = session;
  if (!isAgencyPlanOrHigher(agency.plan)) {
    return NextResponse.json({ ok: false, error: "Credit monitoring requires the Agency plan." }, { status: 403 });
  }
  if (agency.credit_monitoring_service === "none" || !agency.credit_monitoring_api_key || !agency.credit_monitoring_api_secret) {
    return NextResponse.json({ ok: false, error: "Connect a credit monitoring provider in Settings first." }, { status: 400 });
  }

  const { clientId } = (await req.json().catch(() => ({}))) as { clientId?: string };
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Missing clientId." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientRow } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("agency_id", agency.id)
    .single();

  if (!clientRow) {
    return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
  }
  const client = clientRow as Client;

  const missing: string[] = [];
  if (!client.first_name || !client.last_name) missing.push("name");
  if (!client.ssn_last4) missing.push("SSN last 4");
  if (!client.dob) missing.push("date of birth");
  if (!client.address_line1 || !client.city || !client.state || !client.zip) missing.push("address");
  if (missing.length) {
    return NextResponse.json({ ok: false, error: `Missing required client fields: ${missing.join(", ")}.` }, { status: 400 });
  }

  const service = agency.credit_monitoring_service as CreditMonitoringService;
  const result = await pullCreditScores(service, agency.credit_monitoring_api_key, agency.credit_monitoring_api_secret, {
    firstName: client.first_name,
    lastName: client.last_name,
    ssnLast4: client.ssn_last4!,
    dob: client.dob!,
    address: client.address_line1!,
    city: client.city!,
    state: client.state!,
    zip: client.zip!,
  });

  const succeeded = !result.error && (result.score_eq !== null || result.score_exp !== null || result.score_tu !== null);

  const { error: pullInsertError } = await admin.from("credit_monitoring_pulls").insert({
    agency_id: agency.id,
    client_id: clientId,
    service,
    score_eq: result.score_eq,
    score_exp: result.score_exp,
    score_tu: result.score_tu,
    raw_response: result.raw_response ?? null,
    status: succeeded ? "success" : "failed",
    error_message: result.error ?? null,
  });
  if (pullInsertError) {
    // This IS the dedicated audit table for pull attempts — same reasoning
    // as the onboarding webhook's auto-pull block: without this check a
    // failure here produced zero record of the attempt anywhere.
    console.error(`[Credit Monitoring] pulls audit insert failed for client ${clientId}:`, pullInsertError);
    await admin.from("activity_log").insert({
      agency_id: agency.id,
      client_id: clientId,
      actor_type: "staff",
      actor_id: session.userId,
      action: "Credit monitoring pull logging failed",
      description: `Pull ${succeeded ? "succeeded" : "failed"} but the audit row failed to save: ${pullInsertError.message}`,
      metadata: { error: pullInsertError.message },
    });
  }

  if (!succeeded) {
    return NextResponse.json({ ok: false, error: result.error ?? "No scores returned." });
  }

  const { error: scoreUpdateError } = await admin
    .from("clients")
    .update({
      score_eq_current: result.score_eq ?? client.score_eq_current,
      score_exp_current: result.score_exp ?? client.score_exp_current,
      score_tu_current: result.score_tu ?? client.score_tu_current,
    })
    .eq("id", clientId);
  if (scoreUpdateError) {
    // Unlike score_history below, this is the value the rest of the app
    // actually reads (client header, reports) — a failure here must not be
    // reported as success to the staff member who clicked Pull Scores.
    console.error(`[Credit Monitoring] client score update failed for ${clientId}:`, scoreUpdateError);
    return NextResponse.json({
      ok: false,
      error: `Scores were pulled successfully, but saving them to the client record failed: ${scoreUpdateError.message}`,
    });
  }

  const { error: scoreHistoryError } = await admin.from("score_history").insert({
    client_id: clientId,
    agency_id: agency.id,
    score_eq: result.score_eq,
    score_exp: result.score_exp,
    score_tu: result.score_tu,
    round_number: client.current_round,
    notes: `Credit monitoring pull via ${service}`,
  });
  if (scoreHistoryError) {
    // Same exception as logResults()'s score_history handling: the client's
    // current score is already correctly saved at this point — this only
    // breaks the portal's historical chart continuity for this pull, not
    // fatal to the overall response.
    console.error(`[Credit Monitoring] score_history insert failed for client ${clientId}:`, scoreHistoryError);
    await admin.from("activity_log").insert({
      agency_id: agency.id,
      client_id: clientId,
      actor_type: "staff",
      actor_id: session.userId,
      action: "Score history entry failed",
      description: `Credit monitoring scores saved, but the historical score_history entry failed: ${scoreHistoryError.message}`,
    });
  }

  if (client.ghl_contact_id && agency.ghl_api_key && agency.ghl_location_id) {
    const fields: Record<string, string> = {};
    if (result.score_eq !== null) fields[GHL_FIELD_KEYS.EQ_SCORE] = String(result.score_eq);
    if (result.score_exp !== null) fields[GHL_FIELD_KEYS.EXP_SCORE] = String(result.score_exp);
    if (result.score_tu !== null) fields[GHL_FIELD_KEYS.TU_SCORE] = String(result.score_tu);
    if (Object.keys(fields).length) {
      await updateGHLContactFields(client.ghl_contact_id, fields, {
        apiKey: agency.ghl_api_key,
        locationId: agency.ghl_location_id,
      }).catch((err) => console.error("[Credit Monitoring] GHL field sync error:", err));
    }
  }

  return NextResponse.json({ ok: true, score_eq: result.score_eq, score_exp: result.score_exp, score_tu: result.score_tu });
}
