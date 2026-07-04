import type { Plan } from "@/types";
import { PLAN_BY_ID } from "@/lib/billing/plans";

/**
 * Monthly value per plan, used for MRR estimates in the admin dashboard.
 * Derived from the single pricing source of truth in @/lib/billing/plans so
 * the two can never drift. `enterprise` is provisioned/priced manually.
 */
const ENTERPRISE_MONTHLY = 399;

export function planMonthly(plan: Plan): number {
  if (plan === "enterprise") return ENTERPRISE_MONTHLY;
  return PLAN_BY_ID[plan]?.priceMonthly ?? 0;
}
