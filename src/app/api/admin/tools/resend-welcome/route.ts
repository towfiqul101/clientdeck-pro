import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, loadAgencyGhl } from "@/lib/admin/tool-helpers";

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clientdeckpro.com";
  const subject = "Welcome to ClientDeck Pro — let's get you set up";
  const text = `Hi ${agency.owner_name || "there"},

Welcome to ClientDeck Pro! Here's how to get ${agency.name} up and running:

1. Log in at ${appUrl}/login
2. Connect your GoHighLevel account under Settings → GHL (paste your Location ID and API key)
3. Install the ClientDeck Pro snapshot to load your pipelines and custom fields
4. Add your first client and generate a dispute round

Need a hand? Just reply to this email and we'll help you get set up.

— The ClientDeck Pro Team`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[DEV] Welcome email would send to ${agency.owner_email} — Subject: ${subject}`
    );
    return NextResponse.json({
      ok: true,
      message: `Welcome email logged (no RESEND_API_KEY set) for ${agency.owner_email}.`,
    });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClientDeck Pro <onboarding@clientdeckpro.com>",
        to: [agency.owner_email],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { ok: false, error: `Resend error ${res.status}: ${detail.slice(0, 200)}` },
        { status: 502 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Send failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Welcome email sent to ${agency.owner_email}.`,
  });
}
