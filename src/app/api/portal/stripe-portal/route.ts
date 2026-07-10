import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getPortalSession } from "@/lib/portal/session";

/**
 * Creates a Stripe Customer Portal session for the logged-in portal client and
 * redirects them to it. Session is validated via the portal_session cookie.
 */
export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.redirect(portalUrl("/portal?expired=true"));
  }

  const customerId = session.client.stripe_customer_id;
  if (!customerId) {
    return NextResponse.redirect(portalUrl("/portal/billing?error=no_customer"));
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(portalUrl("/portal/billing?error=unconfigured"));
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: portalUrl("/portal/billing"),
    });
    return NextResponse.redirect(portal.url);
  } catch (e) {
    console.error("Stripe portal session failed:", e);
    return NextResponse.redirect(portalUrl("/portal/billing?error=stripe"));
  }
}

function portalUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.roundtrackpro.com";
  return `${base}${path}`;
}
