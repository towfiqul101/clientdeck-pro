import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { isAllowedPushEndpoint } from "@/lib/push/endpoint";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`portal-push-sub:${ip}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session expired." }, { status: 401 });
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

  const { client, agency } = session;
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      client_id: client.id,
      agency_id: agency.id,
      subscription,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[portal/push/subscribe] upsert failed:", error);
    return NextResponse.json({ ok: false, error: "Could not save subscription." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session expired." }, { status: 401 });
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
    .eq("client_id", session.client.id)
    .eq("endpoint", body.endpoint);

  return NextResponse.json({ ok: true });
}
