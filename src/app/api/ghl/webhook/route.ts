import { NextResponse } from "next/server";
import { handleGHLWebhook } from "@/lib/ghl/webhook";

/**
 * Inbound GHL webhook receiver.
 *
 * Always returns 200 — GHL retries aggressively on any non-2xx, so we swallow
 * processing errors here and rely on server logs instead.
 */
export async function POST(req: Request) {
  // Shared-secret check. If GHL_WEBHOOK_SECRET is configured, callers MUST
  // present it (via header or ?secret=) — absent counts as invalid, not a
  // pass-through. Rejections still return 200 so GHL doesn't spin on retries.
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const provided =
      req.headers.get("x-clientdeck-secret") ||
      req.headers.get("x-wh-secret") ||
      url.searchParams.get("secret");
    if (!provided || provided !== secret) {
      console.warn("GHL webhook rejected: missing or invalid secret");
      return NextResponse.json({ received: true, processed: false });
    }
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
