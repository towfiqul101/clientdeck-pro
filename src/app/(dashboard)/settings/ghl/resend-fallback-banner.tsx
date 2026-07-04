import { AlertTriangle } from "lucide-react";
import type { GHLNotificationType } from "@/lib/ghl/notifications";

// Only these types have a Resend email template (see sendResendFallback in
// src/lib/ghl/notifications.ts) — the rest have no email fallback and
// silently no-op when GHL isn't configured, so they're excluded from this
// banner's count to avoid overstating what Resend actually covers.
const RESEND_TEMPLATED_TYPES: readonly GHLNotificationType[] = [
  "round_sent",
  "deletion_win",
  "goal_achieved",
  "payment_failed",
];

export function ResendFallbackBanner({
  triggers,
}: {
  triggers: Partial<Record<GHLNotificationType, string>>;
}) {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  if (!hasResend) return null;

  const unconfiguredCount = RESEND_TEMPLATED_TYPES.filter((t) => !triggers[t]).length;
  if (unconfiguredCount === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Using Email Fallback — {unconfiguredCount} of {RESEND_TEMPLATED_TYPES.length} notifications
        that support email fallback are using Resend because GHL webhook URLs aren&apos;t fully
        configured. Set up your GHL workflows below to use your own branded SMS and email instead.
      </span>
    </div>
  );
}
