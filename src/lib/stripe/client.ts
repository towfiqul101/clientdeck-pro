import Stripe from "stripe";

/**
 * Shared Stripe instance. We intentionally do NOT pin `apiVersion` — the
 * installed stripe@22 SDK types reject the older literal from the spec, and
 * omitting it uses the account's default version (matches the portal route).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
