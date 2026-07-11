/**
 * GHL notification type + tag constants, split out from `notifications.ts` so
 * client components can import them without pulling in that module's
 * `next/server` (`after`) usage, which is server-only and breaks the client
 * bundle if imported transitively.
 */
export type GHLNotificationType =
  | "round_sent"
  | "deletion_win"
  | "round_results_in"
  | "payment_failed"
  | "goal_achieved"
  | "portal_link"
  | "staff_new_client"
  | "staff_round_overdue"
  | "staff_next_round_ready"
  | "staff_monthly_progress"
  | "monthly_progress";

/** GHL contact tags that fire each event's agency-built workflow. Removed 5s after being added so they can refire next time. */
export const NOTIFICATION_TAGS: Record<GHLNotificationType, string> = {
  round_sent: "cdp-round-sent",
  deletion_win: "cdp-deletion-win",
  round_results_in: "cdp-round-complete",
  goal_achieved: "cdp-goal-achieved",
  payment_failed: "cdp-payment-failed",
  portal_link: "cdp-portal-sent",
  staff_new_client: "cdp-staff-new-client",
  staff_round_overdue: "cdp-staff-overdue",
  staff_next_round_ready: "cdp-next-round-ready",
  staff_monthly_progress: "cdp-staff-monthly-update",
  monthly_progress: "cdp-monthly-update",
};
