import Stripe from "stripe";

/**
 * Shared Stripe instance, or `null` when STRIPE_SECRET_KEY is unset (local
 * preview / unconfigured deploys). It MUST be null rather than
 * `new Stripe("")` — the stripe@22 SDK throws "Neither apiKey nor
 * config.authenticator provided" at construction on an empty key, which would
 * crash the build when route modules are evaluated. Call sites guard with
 * `if (!stripe)`; that also narrows the type for the rest of the scope.
 *
 * We intentionally do NOT pin `apiVersion` — the SDK types reject the older
 * literal from the spec, and omitting it uses the account's default version.
 */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
