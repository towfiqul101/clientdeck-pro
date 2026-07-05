import type { Plan } from "@/types";

export interface PlanConfig {
  id: Plan;
  name: string;
  priceMonthly: number;
  priceLabel: string; // "$49"
  maxClients: number;
  maxTeamMembers: number;
  clientsLabel: string;
  features: string[];
  /** Name of the env var holding this plan's Stripe price id. */
  priceEnv: "STRIPE_PRICE_SOLO" | "STRIPE_PRICE_PRO" | "STRIPE_PRICE_AGENCY";
  highlight?: boolean;
}

/**
 * Purchasable plans, in display order. `enterprise` is provisioned manually.
 *
 * NOTE: the internal `id` for the entry-level tier stays `"solo"` (matching the
 * DB CHECK constraint and existing rows) even though it is presented to
 * customers as "Starter". Renaming the id would require a DB enum migration.
 */
export const PLANS: PlanConfig[] = [
  {
    id: "solo",
    name: "Starter",
    priceMonthly: 49,
    priceLabel: "$49",
    maxClients: 100,
    maxTeamMembers: 2,
    clientsLabel: "Up to 100 active clients",
    features: [
      "Up to 100 active clients",
      "2 team members",
      "AI letter generation",
      "Client portal",
      "GoHighLevel sync",
    ],
    priceEnv: "STRIPE_PRICE_SOLO",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 129,
    priceLabel: "$129",
    maxClients: 700,
    maxTeamMembers: 5,
    clientsLabel: "Up to 700 clients + white-label portal",
    features: [
      "Up to 700 active clients",
      "5 team members",
      "White-label portal",
      "Priority letter generation",
      "Advanced reporting",
    ],
    priceEnv: "STRIPE_PRICE_PRO",
    highlight: true,
  },
  {
    id: "agency",
    name: "Agency",
    priceMonthly: 249,
    priceLabel: "$249",
    maxClients: 9999,
    maxTeamMembers: 9999,
    clientsLabel: "Unlimited clients + custom domain + API",
    features: [
      "Unlimited clients",
      "Unlimited team members",
      "API access",
      "Custom portal domain",
      "Credit monitoring API keys",
      'Removes "Powered by ClientDeck Pro"',
    ],
    priceEnv: "STRIPE_PRICE_AGENCY",
  },
];

export const PLAN_BY_ID: Record<Plan, PlanConfig | undefined> = {
  solo: PLANS[0],
  pro: PLANS[1],
  agency: PLANS[2],
  enterprise: undefined,
};

const PLAN_MAX_CLIENTS: Record<Plan, number> = {
  solo: 100,
  pro: 700,
  agency: 9999,
  enterprise: 9999,
};

const PLAN_MAX_TEAM_MEMBERS: Record<Plan, number> = {
  solo: 2,
  pro: 5,
  agency: 9999,
  enterprise: 9999,
};

export function maxClientsForPlan(plan: Plan): number {
  return PLAN_MAX_CLIENTS[plan] ?? 100;
}

export function maxTeamMembersForPlan(plan: Plan): number {
  return PLAN_MAX_TEAM_MEMBERS[plan] ?? 2;
}

/** True for the plans that unlock the credit-monitoring integration (Agency and Enterprise). */
export function isAgencyPlanOrHigher(plan: Plan): boolean {
  return plan === "agency" || plan === "enterprise";
}

export function stripePriceIdForPlan(plan: Plan): string | undefined {
  const config = PLAN_BY_ID[plan];
  if (!config) return undefined;
  return process.env[config.priceEnv];
}

/** Reverse-maps a Stripe price id back to our internal plan (webhook use). */
export function planFromPriceId(priceId: string): Plan | null {
  for (const plan of PLANS) {
    if (process.env[plan.priceEnv] === priceId) return plan.id;
  }
  return null;
}
