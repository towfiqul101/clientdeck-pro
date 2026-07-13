import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, loadAgencyGhl, hasGhlCreds } from "@/lib/admin/tool-helpers";
import { getGHLPipelines, createGHLPipeline } from "@/lib/ghl/api";
import { RTP_PIPELINES } from "@/lib/ghl/setup-config";

export const dynamic = "force-dynamic";

/**
 * Creates the Credit Sales + Active Client pipelines in the agency's GHL
 * location. Pipeline creation isn't available on every GHL plan via the public
 * API, so failures are reported clearly (fall back to the RoundTrack Pro snapshot).
 */
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
  const existing = await getGHLPipelines(opts);
  const existingNames = new Set(existing.map((p) => p.name?.toLowerCase()));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const pipeline of RTP_PIPELINES) {
    if (existingNames.has(pipeline.name.toLowerCase())) {
      skipped++;
      continue;
    }
    const res = await createGHLPipeline(pipeline, opts);
    if (res.created) created++;
    else errors.push(`${pipeline.name}: ${res.error ?? "failed"}`);
  }

  const ok = errors.length === 0;
  return NextResponse.json({
    ok,
    message: ok
      ? `Created ${created} pipeline(s), skipped ${skipped} already present.`
      : "GHL rejected pipeline creation — use the RoundTrack Pro snapshot to install pipelines instead.",
    created,
    skipped,
    errors,
  });
}
