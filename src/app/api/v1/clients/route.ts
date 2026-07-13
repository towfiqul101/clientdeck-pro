import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logApiRequest } from "@/lib/api/log";
import { CLIENT_API_FIELDS, type ApiClient } from "@/lib/api/clients";

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
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
