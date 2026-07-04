import { AlertTriangle } from "lucide-react";
import type { GHLNotificationType } from "@/lib/ghl/notifications";

const WIRED_TYPES: readonly GHLNotificationType[] = [
  "round_sent",
  "deletion_win",
  "round_results_in",
  "goal_achieved",
  "payment_failed",
  "portal_link",
  "staff_new_client",
  "staff_round_overdue",
  "staff_next_round_ready",
];

export function ResendFallbackBanner({
  triggers,
}: {
  triggers: Partial<Record<GHLNotificationType, string>>;
}) {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  if (!hasResend) return null;

  const unconfiguredCount = WIRED_TYPES.filter((t) => !triggers[t]).length;
  if (unconfiguredCount === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Using Email Fallback — {unconfiguredCount} of {WIRED_TYPES.length} notifications are using
        Resend email because GHL webhook URLs aren&apos;t fully configured. Set up your GHL workflows
        below to use your own branded SMS and email instead.
      </span>
    </div>
  );
}
