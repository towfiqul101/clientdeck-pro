"use server";

import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { stripePriceIdForPlan } from "@/lib/billing/plans";
import type { Plan } from "@/types";

export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string };

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.clientdeckpro.com";
  return `${base}${path}`;
}

export async function createCheckoutSession(plan: Plan): Promise<CheckoutResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, error: "Billing is not configured yet." };
  }

  const priceId = stripePriceIdForPlan(plan);
  if (!priceId) {
    return { success: false, error: "That plan is not purchasable online." };
  }

  const { agency } = session;

  // Reuse or create the Stripe customer, and persist it immediately.
  let customerId = agency.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: agency.owner_email,
      name: agency.name,
      metadata: { agency_id: agency.id },
    });
    customerId = customer.id;
    const admin = createAdminClient();
    await admin
      .from("agencies")
      .update({ stripe_customer_id: customerId })
      .eq("id", agency.id);
  }

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { agency_id: agency.id, plan },
      },
      metadata: { agency_id: agency.id, plan },
      success_url: appUrl("/settings/billing?checkout=success"),
      cancel_url: appUrl("/settings/billing?checkout=cancelled"),
      allow_promotion_codes: true,
    });
    if (!checkout.url) {
      return { success: false, error: "Stripe did not return a checkout URL." };
    }
    return { success: true, url: checkout.url };
  } catch (e) {
    console.error("createCheckoutSession failed:", e);
    return { success: false, error: "Could not start checkout. Try again." };
  }
}
