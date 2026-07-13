import { NextResponse } from "next/server";
import { handleGHLWebhook } from "@/lib/ghl/webhook";
import { verifyGhlWebhookSecret } from "@/lib/ghl/webhook-auth";

/**
 * Inbound GHL webhook receiver.
 *
 * Returns 200 even on rejection — GHL retries aggressively on any non-2xx, and
 * a rejected forgery is not something we want it hammering. `processed: false`
 * makes the outcome unambiguous, and the rejection is logged.
 */
export async function POST(req: Request) {
  // Fails closed: an unset GHL_WEBHOOK_SECRET rejects everything (see
  // lib/ghl/webhook-auth.ts) rather than waving every caller through.
  const auth = verifyGhlWebhookSecret(req);
  if (!auth.ok) {
    console.warn(`GHL webhook rejected: ${auth.reason}`);
    return NextResponse.json({ received: true, processed: false });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    console.error("GHL webhook: invalid JSON body");
    return NextResponse.json({ received: true, error: "invalid_json" });
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
