import type { Plan } from "@/types";

/** Monthly value per plan, used for MRR estimates in the admin dashboard. */
export const PLAN_MONTHLY: Record<Plan, number> = {
  solo: 79,
  pro: 149,
  agency: 249,
  enterprise: 399,
};

export function planMonthly(plan: Plan): number {
  return PLAN_MONTHLY[plan] ?? 0;
}
