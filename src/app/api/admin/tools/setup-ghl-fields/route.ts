import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, loadAgencyGhl, hasGhlCreds } from "@/lib/admin/tool-helpers";
import {
  getGHLCustomFields,
  createGHLCustomField,
} from "@/lib/ghl/api";
import { RTP_ALL_CUSTOM_FIELDS } from "@/lib/ghl/setup-config";

export const dynamic = "force-dynamic";

/** Creates all 25 RTP custom fields in the agency's GHL location (skips existing). */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { agencyId } = await request.json().catch(() => ({ agencyId: "" }));
  if (!agencyId) {
    return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
  }

  const agency = await loadAgencyGhl(agencyId);
  if (!hasGhlCreds(agency)) {
    return NextResponse.json(
      { ok: false, error: "Configure the GHL API key and Location ID first." },
      { status: 400 }
    );
  }

  const opts = { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id };

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
    created,
    skipped,
    errors,
  });
}
