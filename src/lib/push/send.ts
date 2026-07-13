import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedPushEndpoint } from "./endpoint";

interface WebPushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const { VAPID_PRIVATE_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY } = process.env;
  if (!VAPID_PRIVATE_KEY || !VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

/**
 * Sends a Web Push notification to every subscription on file for a client
 * (one per browser/device they enabled push on). Never throws — matches
 * sendGHLNotification's fire-and-forget contract so callers can await or
 * fire-and-forget without try/catch. No-ops silently if VAPID env vars
 * aren't configured.
 *
 * A 404/410 from the push service means the subscription is dead (browser
 * uninstalled, permission revoked, etc.) — that row is deleted so future
 * sends don't keep failing against it.
 */
export async function sendPushToClient(clientId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("client_id", clientId);

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (row) => {
      const sub = row.subscription as WebPushSubscriptionJSON;
      // Defense in depth: the subscribe route rejects non-push-service
      // endpoints, but rows predating that check could still name an
      // arbitrary host. Never let webpush POST to one.
      if (!isAllowedPushEndpoint(sub?.endpoint ?? "")) {
        console.error("[push] skipping subscription with disallowed endpoint", { id: row.id });
        return;
      }
      try {
        await webpush.sendNotification(
          sub,
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.error("[push] sendPushToClient failed:", err);
        }
      }
    })
  );
}
