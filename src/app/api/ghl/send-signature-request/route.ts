import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addGHLTag } from "@/lib/ghl/api";

export const dynamic = "force-dynamic";

/**
 * POST — adds the `signature-requested` tag to the client's GHL contact, which
 * fires the agency's GHL workflow to send the onboarding/signature form link.
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
      { ok: false, error: "Connect GoHighLevel in Settings first." },
      { status: 400 }
    );
  }

  try {
    await addGHLTag(client.ghl_contact_id, ["signature-requested"], {
      apiKey: ghl_api_key,
      locationId: ghl_location_id,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach GoHighLevel." },
      { status: 502 }
    );
  }

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Signature requested",
    description: "Tagged 'signature-requested' in GHL to send the form link.",
  });

  return NextResponse.json({ ok: true, message: "Signature request sent via GHL." });
}
