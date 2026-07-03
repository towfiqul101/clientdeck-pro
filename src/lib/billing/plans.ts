import type { Plan } from "@/types";

export interface PlanConfig {
  id: Plan;
  name: string;
  priceMonthly: number;
  priceLabel: string; // "$79"
  maxClients: number;
  clientsLabel: string;
  features: string[];
  /** Name of the env var holding this plan's Stripe price id. */
  priceEnv: "STRIPE_PRICE_SOLO" | "STRIPE_PRICE_PRO" | "STRIPE_PRICE_AGENCY";
  highlight?: boolean;
}

/** Purchasable plans, in display order. `enterprise` is provisioned manually. */
export const PLANS: PlanConfig[] = [
  {
    id: "solo",
    name: "Solo",
    priceMonthly: 79,
    priceLabel: "$79",
    maxClients: 15,
    clientsLabel: "Up to 15 active clients",
    features: [
      "Up to 15 active clients",
      "AI dispute-letter generation",
      "Branded client portal",
      "GoHighLevel sync",
    ],
    priceEnv: "STRIPE_PRICE_SOLO",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 149,
    priceLabel: "$149",
    maxClients: 75,
    clientsLabel: "Up to 75 clients + white-label portal",
    features: [
      "Up to 75 active clients",
      "White-label client portal",
      "Team members",
      "Priority letter generation",
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
    clientsLabel: "Unlimited clients + custom domain + API",
    features: [
      "Unlimited active clients",
      "Custom portal domain",
      "API access",
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
  solo: 15,
  pro: 75,
  agency: 9999,
  enterprise: 9999,
};

export function maxClientsForPlan(plan: Plan): number {
  return PLAN_MAX_CLIENTS[plan] ?? 15;
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
