import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, loadAgencyGhl } from "@/lib/admin/tool-helpers";
import { sendAgencyWelcomeEmail } from "@/lib/admin/welcome-email";

export const dynamic = "force-dynamic";

/** Resends the onboarding/welcome email to the agency owner via Resend. */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { agencyId } = await request.json().catch(() => ({ agencyId: "" }));
  if (!agencyId) {
    return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
  }

  const agency = await loadAgencyGhl(agencyId);
  if (!agency) {
    return NextResponse.json({ ok: false, error: "Agency not found" }, { status: 404 });
  }

  const result = await sendAgencyWelcomeEmail(agency);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, message: result.message });
}
