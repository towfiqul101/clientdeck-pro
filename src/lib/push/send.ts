import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedPushEndpoint } from "./endpoint";
import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Sends `payload` to every subscription row in `subs`, deleting any that
 * come back 404/410 (dead — browser uninstalled, permission revoked, etc).
 * Shared by sendPushToClient and sendPushToStaff so this logic exists once.
 */
async function deliverToSubscriptions(
  admin: SupabaseClient,
  subs: { id: string; subscription: unknown }[],
  payload: PushPayload
): Promise<void> {
  await Promise.all(
    subs.map(async (row) => {
      const sub = row.subscription as WebPushSubscriptionJSON;
      // Defense in depth: the subscribe routes reject non-push-service
      // endpoints, but rows predating that check could still name an
      // arbitrary host. Never let webpush POST to one.
      if (!isAllowedPushEndpoint(sub?.endpoint ?? "")) {
        console.error("[push] skipping subscription with disallowed endpoint", { id: row.id });
        return;
      }
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        } else {
          console.error("[push] delivery failed:", err);
        }
      }
    })
  );
}

/**
 * Sends a Web Push notification to every subscription on file for a client
 * (one per browser/device they enabled push on). Never throws — matches
 * sendGHLNotification's fire-and-forget contract so callers can await or
 * fire-and-forget without try/catch. No-ops silently if VAPID env vars
 * aren't configured.
 */
export async function sendPushToClient(clientId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("client_id", clientId);

  if (!subs || subs.length === 0) return;
  await deliverToSubscriptions(admin, subs, payload);
}

/**
 * Same contract as sendPushToClient, for a staff member (team_members.id)
 * instead of a client. Both share push_subscriptions (migration 032 added
 * the nullable team_member_id column) and the delivery/cleanup logic above.
 */
export async function sendPushToStaff(teamMemberId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("team_member_id", teamMemberId);

  if (!subs || subs.length === 0) return;
  await deliverToSubscriptions(admin, subs, payload);
}
