import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/auth";

/** Auth smoke-test endpoint for Agency API keys. No data endpoints exist yet. */
export async function GET(req: Request) {
  const auth = await validateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, agency_id: auth.agencyId });
}
