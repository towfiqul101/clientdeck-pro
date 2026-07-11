import type { TeamMember } from "@/types";

export type StaffFacingNotificationType =
  | "staff_new_client"
  | "staff_round_overdue"
  | "staff_next_round_ready"
  | "staff_monthly_progress";

/** The subset of GHLNotificationType that targets staff, not clients. */
export const STAFF_FACING_NOTIFICATION_TYPES: StaffFacingNotificationType[] = [
  "staff_new_client",
  "staff_round_overdue",
  "staff_next_round_ready",
  "staff_monthly_progress",
];

export const STAFF_NOTIFICATION_LABELS: Record<StaffFacingNotificationType, string> = {
  staff_new_client: "New client onboarded",
  staff_round_overdue: "Dispute round overdue",
  staff_next_round_ready: "Next round ready to prepare",
  staff_monthly_progress: "Monthly client progress (staff copy)",
};

type PrefsSource = Pick<TeamMember, "role" | "subscribed_notification_types">;

/**
 * NULL means the member has never saved a preference — owners implicitly
 * get everything (preserves the old single owner_ghl_contact_id behavior
 * for agencies that haven't touched the new settings), everyone else gets
 * nothing until they opt in. An empty array is a deliberate "none" from a
 * real save and must NOT fall back to the role default, or unchecking
 * every box would silently do nothing.
 */
export function resolveSubscribedTypes(member: PrefsSource): StaffFacingNotificationType[] {
  const saved = member.subscribed_notification_types;
  if (saved == null) {
    return member.role === "owner" ? STAFF_FACING_NOTIFICATION_TYPES : [];
  }
  return saved.filter((t): t is StaffFacingNotificationType =>
    (STAFF_FACING_NOTIFICATION_TYPES as string[]).includes(t)
  );
}

export function isSubscribedTo(member: PrefsSource, type: StaffFacingNotificationType): boolean {
  return resolveSubscribedTypes(member).includes(type);
}
