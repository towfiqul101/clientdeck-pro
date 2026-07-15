import { NextResponse } from "next/server";
import { validateApiKey, apiAuthErrorResponse } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logApiRequest } from "@/lib/api/log";
import { findAgencyClient } from "@/lib/api/clients";

const ROUND_FIELDS =
  "round_number, status, date_sent, response_deadline, date_responses_received, " +
  "total_items_disputed, total_deletions, total_updates, total_verified, total_no_response";

/** Dispute-round status summary for a client — counts and dates only, never
 *  letter content. Scoped to the API key's agency; 404s the same way the
 *  client-detail route does when the client isn't in this agency. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  const { id } = await params;

  let client;
  try {
    client = await findAgencyClient(id, auth.agencyId);
  } catch (err) {
    await logApiRequest(auth.agencyId, req, {
      status: 500,
      description: `API client rounds query failed: ${id}`,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (!client) {
    await logApiRequest(auth.agencyId, req, {
      status: 404,
      description: `API client rounds 404: ${id}`,
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dispute_rounds")
    .select(ROUND_FIELDS)
    .eq("client_id", id)
    .order("round_number", { ascending: true });

  if (error) {
    await logApiRequest(auth.agencyId, req, {
      status: 500,
      description: `API client rounds failed: ${id}`,
      clientId: id,
      metadata: { error: error.message },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  await logApiRequest(auth.agencyId, req, {
    status: 200,
    description: `API client rounds: ${id} (${data?.length ?? 0} rounds)`,
    clientId: id,
  });

  return NextResponse.json({ data: data ?? [] });
}
