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

/**
 * The GHL tag an agency's form workflow adds to fire `/api/ghl/onboarding`.
 *
 * Namespaced deliberately. Credit-repair agencies commonly already run a
 * generic `onboarding-complete` tag for their own (or another product's)
 * automations — in a GHL location shared with TaxIntake Pro / Due Diligence
 * Pro, an unrelated workflow adding that tag would fire client creation in
 * RoundTrack Pro. Prefixing scopes it to us.
 *
 * NOTE: nothing in this codebase reads this tag — the onboarding route acts on
 * whatever `contactId`/`locationId` it is POSTed. It is purely the GHL-side
 * trigger name, surfaced here so the setup UI and docs can't drift apart.
 */
export const ONBOARDING_COMPLETE_TAG = "rtp-onboarding-completed";

/**
 * INBOUND tags — GHL adds these, and `handleGHLWebhook` acts on them (unlike
 * ONBOARDING_COMPLETE_TAG above, these ARE read by code).
 *
 * Namespaced for the same reason, but the stakes are higher: these mutate a
 * client's status and payment state. They were previously the bare `enrolled`,
 * `payment-failed`, and `services-paused` — names another product in a shared
 * GHL location would plausibly use for its own contacts. A TaxIntake Pro or
 * Due Diligence Pro workflow adding `payment-failed` to a contact who is also a
 * credit client would have flipped that client to payment-failed in RoundTrack
 * Pro, and `services-paused` would have put them on hold. Nothing prevented it.
 *
 * Only the `rtp-` forms are honored — matching a bare tag would keep the hole
 * open, which defeats the point.
 */
export const INBOUND_TAGS = {
  ENROLLED: "rtp-enrolled",
  PAYMENT_FAILED: "rtp-payment-failed",
  SERVICES_PAUSED: "rtp-services-paused",
} as const;
