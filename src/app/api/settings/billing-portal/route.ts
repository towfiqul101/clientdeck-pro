import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { stripe } from "@/lib/stripe/client";

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.clientdeckpro.com";
  return `${base}${path}`;
}

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.redirect(appUrl("/login"));

  const customerId = session.agency.stripe_customer_id;
  if (!customerId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(appUrl("/settings/billing?error=no_customer"));
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: appUrl("/settings/billing"),
    });
    return NextResponse.redirect(portal.url);
  } catch (e) {
    console.error("Agency billing portal failed:", e);
    return NextResponse.redirect(appUrl("/settings/billing?error=stripe"));
  }
}
