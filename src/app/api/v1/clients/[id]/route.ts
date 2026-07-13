import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { logApiRequest } from "@/lib/api/log";
import { findAgencyClient } from "@/lib/api/clients";

/** Single client detail, scoped to the API key's agency. 404s (never leaks
 *  existence) for both a nonexistent id and one that belongs to another agency. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await findAgencyClient(id, auth.agencyId);

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
