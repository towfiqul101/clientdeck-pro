import { NextResponse } from "next/server";
import { validateApiKey, apiAuthErrorResponse } from "@/lib/api/auth";

/** Auth (+ rate limit) smoke-test endpoint for Agency API keys. */
export async function GET(req: Request) {
  const auth = await validateApiKey(req);
  if (!auth.ok) return apiAuthErrorResponse(auth);

  return NextResponse.json({ ok: true, agency_id: auth.agencyId });
}
