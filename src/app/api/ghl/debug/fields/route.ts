import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getGHLCustomFields } from "@/lib/ghl/api";
import { CDP_ALL_CUSTOM_FIELDS } from "@/lib/ghl/setup-config";

export const dynamic = "force-dynamic";

/** GHL returns keys as `contact.cdp__x`; we compare on the bare `cdp__x`. */
function bareKey(k: string | undefined): string {
  return (k ?? "").replace(/^contact\./, "");
}

/**
 * Diagnostics for the "fields exist but are empty" problem: compares the
 * `cdp__*` keys RoundTrack Pro writes to against the custom fields that actually
 * exist in the signed-in agency's GHL location. Match on field NAME (GHL derives
 * the key from the name), then flag any key mismatch or missing field.
 */
export async function GET() {
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

  let ghlFields: { id: string; name: string; fieldKey?: string }[];
  try {
    ghlFields = await getGHLCustomFields({ apiKey: ghl_api_key, locationId: ghl_location_id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Could not reach GHL." },
      { status: 502 }
    );
  }

  const byName = new Map(ghlFields.map((f) => [f.name?.toLowerCase(), f]));

  const comparison = CDP_ALL_CUSTOM_FIELDS.map((spec) => {
    const actual = byName.get(spec.name.toLowerCase());
    const actualKey = actual ? bareKey(actual.fieldKey) : null;
    let status: "ok" | "key_mismatch" | "missing";
    if (!actual) status = "missing";
    else if (actualKey === spec.fieldKey) status = "ok";
    else status = "key_mismatch";
    return {
      name: spec.name,
      expected_key: spec.fieldKey,
      actual_key: actualKey,
      ghl_field_id: actual?.id ?? null,
      status,
    };
  });

  const mismatches = comparison.filter((c) => c.status !== "ok");

  return NextResponse.json({
    ok: mismatches.length === 0,
    summary: `${comparison.length - mismatches.length}/${comparison.length} fields match. ${mismatches.length} need attention.`,
    comparison,
    ghl_field_count: ghlFields.length,
  });
}
