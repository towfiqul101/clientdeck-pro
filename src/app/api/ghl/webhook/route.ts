import { NextResponse } from "next/server";
import { after } from "next/server";
import { handleGHLWebhook } from "@/lib/ghl/webhook";
import { verifyGhlWebhook, locationBelongsToAgency } from "@/lib/ghl/webhook-auth";
import { notifyAdmin } from "@/lib/admin/notify";

/**
 * Inbound GHL webhook receiver.
 *
 * Returns 200 even on rejection — GHL retries aggressively on any non-2xx, and
 * a rejected forgery is not something we want it hammering. `processed: false`
 * makes the outcome unambiguous, and the rejection is logged.
 */
export async function POST(req: Request) {
  // Fails closed: no valid per-agency token (or legacy global secret) => reject.
  const auth = await verifyGhlWebhook(req);
  if (!auth.ok) {
    console.warn(`GHL webhook rejected: ${auth.reason}`);
    // Throttled 1/day: could be an attack probe OR a misconfigured agency URL
    // (both otherwise invisible — rejections return 200 to stop GHL retries).
    after(() =>
      notifyAdmin(
        "webhook_auth_failure",
        null,
        "GHL webhook rejected: bad credential",
        `A request to /api/ghl/webhook was rejected (${auth.reason}). Either someone is probing the endpoint or an agency's webhook URL is misconfigured.`,
        { throttlePerDay: true }
      )
    );
    return NextResponse.json({ received: true, processed: false });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    console.error("GHL webhook: invalid JSON body");
    return NextResponse.json({ received: true, error: "invalid_json" });
  }

  // Tenant binding: the payload's locationId is caller-controlled, so a token
  // that identifies agency A must not be usable to write into agency B.
  const locationId = (payload as { locationId?: string })?.locationId ?? "";
  if (!(await locationBelongsToAgency(auth, locationId))) {
    console.warn("GHL webhook rejected: locationId does not belong to the token's agency");
    after(() =>
      notifyAdmin(
        "webhook_auth_failure",
        auth.agencyId,
        "GHL webhook rejected: cross-tenant locationId",
        `A request to /api/ghl/webhook presented a valid agency token but claimed a locationId that agency doesn't own. This is either a serious misconfiguration or an abuse attempt.`,
        { throttlePerDay: true }
      )
    );
    return NextResponse.json({ received: true, processed: false });
  }

  try {
    const result = await handleGHLWebhook(
      payload as Parameters<typeof handleGHLWebhook>[0]
    );
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("GHL webhook processing error:", error);
    return NextResponse.json({ received: true, error: "processing_failed" });
  }
}
