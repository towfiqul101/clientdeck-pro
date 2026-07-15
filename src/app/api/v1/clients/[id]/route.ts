import { NextResponse } from "next/server";
import { validateApiKey, apiAuthErrorResponse } from "@/lib/api/auth";
import { logApiRequest } from "@/lib/api/log";
import { findAgencyClient } from "@/lib/api/clients";

/** Single client detail, scoped to the API key's agency. 404s (never leaks
 *  existence) for both a nonexistent id and one that belongs to another agency. */
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
      description: `API client detail query failed: ${id}`,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (!client) {
    await logApiRequest(auth.agencyId, req, {
      status: 404,
      description: `API client detail 404: ${id}`,
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await logApiRequest(auth.agencyId, req, {
    status: 200,
    description: `API client detail: ${id}`,
    clientId: id,
  });

  return NextResponse.json({ data: client });
}
