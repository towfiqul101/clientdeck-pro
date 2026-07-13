import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getGHLCustomFields, createGHLCustomField } from "@/lib/ghl/api";
import { RTP_ALL_CUSTOM_FIELDS } from "@/lib/ghl/setup-config";

export const dynamic = "force-dynamic";

/** Creates all 25 RTP custom fields in the signed-in agency's own GHL location. */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "Connect GHL (Location ID + API key) first." },
      { status: 400 }
    );
  }
  const opts = { apiKey: ghl_api_key, locationId: ghl_location_id };

  let existingNames: Set<string>;
  try {
    const existing = await getGHLCustomFields(opts);
    existingNames = new Set(existing.map((f) => f.name?.toLowerCase()));
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not reach GHL. Check the API key." },
      { status: 502 }
    );
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const field of RTP_ALL_CUSTOM_FIELDS) {
    if (existingNames.has(field.name.toLowerCase())) {
      skipped++;
      continue;
    }
    const res = await createGHLCustomField(field, opts);
    if (res.created) created++;
    else errors.push(`${field.name}: ${res.error ?? "failed"}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    message: `Created ${created} field(s), skipped ${skipped} already present.`,
    errors,
  });
}
