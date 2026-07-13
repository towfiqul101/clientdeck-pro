import { NextResponse } from "next/server";
import { validateApiKey, apiAuthErrorResponse } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logApiRequest } from "@/lib/api/log";
import { CLIENT_API_FIELDS, type ApiClient } from "@/lib/api/clients";
import { checkClientLimit } from "@/lib/utils/license";
import { createGHLContact } from "@/lib/ghl/api";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePagination(url: URL): { limit: number; offset: number } {
  const rawLimit = Number(url.searchParams.get("limit"));
  const rawOffset = Number(url.searchParams.get("offset"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

/** Lists clients for the agency resolved from the API key. Core fields only. */
export async function GET(req: Request) {
  const auth = await validateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const url = new URL(req.url);
  const { limit, offset } = parsePagination(url);

  const admin = createAdminClient();
  const { data, count, error } = await admin
    .from("clients")
    .select(CLIENT_API_FIELDS, { count: "exact" })
    .eq("agency_id", auth.agencyId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    await logApiRequest(auth.agencyId, req, {
      status: 500,
      description: "GET /api/v1/clients failed",
      metadata: { error: error.message },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const clients = (data ?? []) as unknown as ApiClient[];
  const total = count ?? 0;

  await logApiRequest(auth.agencyId, req, {
    status: 200,
    description: `API list clients (${clients.length} of ${total})`,
  });

  return NextResponse.json({
    data: clients,
    pagination: { limit, offset, total },
  });
}

/**
 * Creates a client for the agency resolved from the API key. Mirrors the
 * staff-dashboard createClient path (src/app/(dashboard)/clients/actions.ts)
 * for the plan-limit check and best-effort GHL contact creation, then does a
 * minimal insert — deliberately not the onboarding webhook's full cascade
 * (no Drive sync, portal-link generation, notification, pipeline move, or
 * credit-monitoring pull). Only first_name/last_name are required, matching
 * the dashboard form's own required fields.
 */
export async function POST(req: Request) {
  const auth = await validateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await logApiRequest(auth.agencyId, req, {
      status: 400,
      description: "API create client rejected: invalid JSON body",
    });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const firstName = typeof input.first_name === "string" ? input.first_name.trim() : "";
  const lastName = typeof input.last_name === "string" ? input.last_name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const createInGhl = typeof input.create_in_ghl === "boolean" ? input.create_in_ghl : true;

  if (!firstName || !lastName) {
    const error = !firstName ? "first_name is required." : "last_name is required.";
    await logApiRequest(auth.agencyId, req, {
      status: 400,
      description: `API create client rejected: ${error}`,
    });
    return NextResponse.json({ error }, { status: 400 });
  }

  const limit = await checkClientLimit(auth.agencyId);
  if (!limit.allowed) {
    await logApiRequest(auth.agencyId, req, {
      status: 402,
      description: "API create client blocked: plan limit reached",
      metadata: { current: limit.current, max: limit.max },
    });
    return NextResponse.json(
      {
        error: `Plan limit of ${limit.max} active clients reached.`,
        current: limit.current,
        max: limit.max,
      },
      { status: 402 }
    );
  }

  const admin = createAdminClient();

  // Best-effort GHL contact creation — a failure never blocks the client
  // write, but is surfaced via ghl_warning so the caller isn't left thinking
  // it synced when it didn't. Defaults on (matching the dashboard form's own
  // default), skippable per-request via create_in_ghl: false.
  let ghlContactId: string | null = null;
  let ghlWarning: string | undefined;
  if (createInGhl) {
    const { data: agency } = await admin
      .from("agencies")
      .select("ghl_api_key, ghl_location_id")
      .eq("id", auth.agencyId)
      .single();

    if (!agency?.ghl_api_key || !agency?.ghl_location_id) {
      ghlWarning = "Client created, but GoHighLevel isn't connected for this agency.";
    } else {
      const ghlRes = await createGHLContact(
        { firstName, lastName, email: email || null, phone: phone || null },
        { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id }
      );
      if (ghlRes.ok) {
        ghlContactId = ghlRes.id;
        if (ghlRes.duplicate) {
          ghlWarning =
            "A GoHighLevel contact with this email/phone already existed — linked to it instead of creating a duplicate.";
        }
      } else {
        ghlWarning = `Client created, but the GoHighLevel contact wasn't created: ${ghlRes.error}`;
      }
    }
  }

  const { data, error } = await admin
    .from("clients")
    .insert({
      agency_id: auth.agencyId,
      ghl_contact_id: ghlContactId,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
    })
    .select(CLIENT_API_FIELDS)
    .single();

  if (error || !data) {
    await logApiRequest(auth.agencyId, req, {
      status: 500,
      description: "API create client failed",
      metadata: { error: error?.message },
    });
    return NextResponse.json({ error: "Could not create client." }, { status: 500 });
  }

  const client = data as unknown as ApiClient;

  await logApiRequest(auth.agencyId, req, {
    status: 201,
    description: `API client created: ${firstName} ${lastName}`,
    clientId: client.id,
    metadata: { ghl_contact_id: ghlContactId },
  });

  return NextResponse.json({ data: client, ghl_warning: ghlWarning }, { status: 201 });
}
