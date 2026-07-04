import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addGHLTag } from "@/lib/ghl/api";

export const dynamic = "force-dynamic";

/**
 * POST — adds the `send-review-sms` tag to the client's GHL contact, which
 * fires the agency's GHL workflow to text the client a review-request link.
 * Best-effort: GHL/network failures resolve to `{ ok: false }` rather than
 * throwing, since this is triggered from a completion-card button.
 */
export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await req.json().catch(() => ({ clientId: "" }));
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Missing clientId" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: client } = await supabase
    .from("clients")
    .select("ghl_contact_id")
    .eq("id", clientId)
    .single();

  if (!client?.ghl_contact_id) {
    return NextResponse.json(
      { ok: false, error: "This client isn't linked to a GHL contact yet." },
      { status: 400 }
    );
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "GHL is not connected." },
      { status: 400 }
    );
  }

  try {
    await addGHLTag(client.ghl_contact_id, ["send-review-sms"], {
      apiKey: ghl_api_key,
      locationId: ghl_location_id,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach GoHighLevel." },
      { status: 200 }
    );
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Review request sent",
    description: "Tagged 'send-review-sms' in GHL to text the client a review link.",
  });

  return NextResponse.json({ ok: true, message: "Review request sent via GHL." });
}
