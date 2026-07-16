import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";

/**
 * Super-admin notification service (migrations 036/037).
 *
 * Writes an admin_notifications row (surfaced by the /admin header bell) and
 * best-effort emails every address in admin_notification_recipients (max 3,
 * managed at /admin/settings). ADMIN_EMAIL keeps its original "audit label
 * only" meaning and is never used here; the interim ADMIN_NOTIFY_EMAIL env
 * var was replaced by the recipients table before ever shipping.
 *
 * Contract matches notifyStaffChannels() in src/lib/ghl/notifications.ts:
 * NEVER throws past the caller, every channel is best-effort, and a failure
 * in one channel (or one recipient's send) doesn't stop the others. Callers
 * on hot paths (webhooks, API auth) should still wrap it in after() so the
 * work runs post-response.
 */

export type AdminNotificationType =
  | "new_agency_signup"
  | "client_limit_exceeded"
  | "trial_ending"
  | "webhook_auth_failure"
  | "api_key_rejected";

export async function notifyAdmin(
  type: AdminNotificationType,
  agencyId: string | null,
  title: string,
  body: string,
  opts?: {
    /**
     * At most one notification per (type, agency_id) per 24h — REQUIRED for
     * the attacker-influenceable security types (webhook_auth_failure,
     * api_key_rejected), where a noisy bot would otherwise bury the bell.
     * Best-effort check-then-insert: a concurrent race can slip a duplicate
     * through, which is acceptable for a throttle (this is noise control,
     * not a security boundary).
     */
    throttlePerDay?: boolean;
  }
): Promise<void> {
  try {
    const admin = createAdminClient();

    if (opts?.throttlePerDay) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let query = admin
        .from("admin_notifications")
        .select("id")
        .eq("type", type)
        .gte("created_at", since)
        .limit(1);
      query = agencyId === null ? query.is("agency_id", null) : query.eq("agency_id", agencyId);
      const { data: recent, error: throttleError } = await query;
      if (throttleError) {
        // Can't tell whether we already notified — err on the side of
        // notifying rather than silently dropping a security signal.
        console.error(`[Admin Notification] ${type} throttle check failed:`, throttleError);
      } else if (recent && recent.length > 0) {
        return; // Already notified within the window.
      }
    }

    const { error: insertError } = await admin.from("admin_notifications").insert({
      type,
      agency_id: agencyId,
      title,
      body,
    });
    if (insertError) {
      console.error(`[Admin Notification] ${type} insert failed:`, insertError);
    }

    const { data: recipients, error: recipientsError } = await admin
      .from("admin_notification_recipients")
      .select("email");
    if (recipientsError) {
      console.error(`[Admin Notification] ${type} recipients lookup failed:`, recipientsError);
      return; // Bell row (above) is already written; email is best-effort.
    }

    // Fan out per recipient — sendEmail already never throws, but allSettled
    // guarantees one address's failure can't short-circuit the rest.
    await Promise.allSettled(
      (recipients ?? []).map(({ email }) =>
        sendEmail({
          to: email,
          subject: `[RoundTrack Admin] ${title}`,
          html: `
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(body)}</p>
            <p><a href="${escapeHtml(adminUrl())}">Open the admin panel →</a></p>
          `,
          text: `${title}\n\n${body}\n\nAdmin panel: ${adminUrl()}`,
        })
      )
    );
  } catch (err) {
    console.error(`[Admin Notification] ${type} failed:`, err);
  }
}

function adminUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://app.roundtrackpro.com").replace(/\/$/, "");
  return `${base}/admin`;
}
