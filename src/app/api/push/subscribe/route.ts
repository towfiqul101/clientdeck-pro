import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/utils/rate-limit";
import { isAllowedPushEndpoint } from "@/lib/push/endpoint";

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  if (!rateLimit(`staff-push-sub:${session.teamMember.id}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const subscription = body.subscription;
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ ok: false, error: "Invalid push subscription." }, { status: 400 });
  }

  // web-push will POST to whatever host the endpoint names, so an
  // unvalidated endpoint here is an SSRF primitive. Only real push services.
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return NextResponse.json(
      { ok: false, error: "Unrecognized push service endpoint." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      team_member_id: session.teamMember.id,
      client_id: null,
      agency_id: session.agency.id,
      subscription,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push/subscribe] upsert failed:", error);
    return NextResponse.json({ ok: false, error: "Could not save subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ ok: false, error: "Missing endpoint." }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("team_member_id", session.teamMember.id)
    .eq("endpoint", body.endpoint);

  return NextResponse.json({ ok: true });
}
