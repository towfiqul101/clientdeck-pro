import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFromPriceId, maxClientsForPlan } from "@/lib/billing/plans";
import type { Plan, PlanStatus } from "@/types";
import { notifyPaymentFailed, NOTIFIABLE_CLIENT_COLUMNS, type NotifiableClient } from "@/lib/ghl/notifications";
import type { Agency } from "@/types";

// Stripe requires the raw, unparsed body for signature verification.
export const dynamic = "force-dynamic";

function mapSubscriptionStatus(s: Stripe.Subscription["status"]): PlanStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "cancelled";
    default:
      return "paused";
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripe) {
    // Preview/dev with no Stripe keys — acknowledge so senders don't retry.
    return NextResponse.json({ received: false, reason: "Stripe not configured" });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "no signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    console.error("Stripe signature verification failed:", e);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  async function findAgencyId(customerId: string | null | undefined) {
    if (!customerId) return null;
    const { data } = await admin
      .from("agencies")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.id ?? null;
  }

  async function applyPlan(
    agencyId: string,
    plan: Plan,
    status: PlanStatus,
    subscriptionId?: string
  ) {
    const update: Record<string, unknown> = {
      plan,
      plan_status: status,
      max_clients: maxClientsForPlan(plan),
    };
    if (subscriptionId) update.stripe_subscription_id = subscriptionId;
    const { error } = await admin.from("agencies").update(update).eq("id", agencyId);
    if (error) console.error("applyPlan update failed:", error);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const agencyId =
          (s.metadata?.agency_id as string | undefined) ??
          (await findAgencyId(s.customer as string));
        const plan = (s.metadata?.plan as Plan | undefined) ?? null;
        if (agencyId && plan) {
          let status: PlanStatus = "active";
          if (s.subscription) {
            const sub = await stripe.subscriptions.retrieve(
              s.subscription as string
            );
            status = mapSubscriptionStatus(sub.status);
          }
          await applyPlan(
            agencyId,
            plan,
            status,
            (s.subscription as string) ?? undefined
          );
          await admin
            .from("agencies")
            .update({ stripe_customer_id: s.customer as string })
            .eq("id", agencyId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyId = await findAgencyId(sub.customer as string);
        const priceId = sub.items.data[0]?.price?.id ?? null;
        const plan = priceId ? planFromPriceId(priceId) : null;
        if (agencyId && plan) {
          const status = mapSubscriptionStatus(sub.status);
          await applyPlan(agencyId, plan, status, sub.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyId = await findAgencyId(sub.customer as string);
        if (agencyId) {
          await admin
            .from("agencies")
            .update({ plan_status: "cancelled" })
            .eq("id", agencyId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string | null;
        const agencyId = await findAgencyId(customerId);

        if (agencyId) {
          // The agency's own SaaS subscription to ClientDeck Pro failed.
          await admin
            .from("agencies")
            .update({ plan_status: "past_due" })
            .eq("id", agencyId);
          await admin.from("activity_log").insert({
            agency_id: agencyId,
            actor_type: "system",
            action: "Payment failed",
            description: "A subscription invoice payment failed (past_due).",
          });
          break;
        }

        // Not the agency's own subscription — check whether it's a client's
        // own Stripe customer (clients manage their monthly fee separately).
        if (customerId) {
          const { data: client } = await admin
            .from("clients")
            .select(`${NOTIFIABLE_CLIENT_COLUMNS}, agency_id`)
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (client) {
            await admin
              .from("clients")
              .update({ payment_status: "failed" })
              .eq("id", client.id);

            const { data: clientAgency } = await admin
              .from("agencies")
              .select("*")
              .eq("id", client.agency_id)
              .single();

            if (clientAgency) {
              await notifyPaymentFailed(clientAgency as Agency, client as NotifiableClient);
            }

            await admin.from("activity_log").insert({
              agency_id: client.agency_id,
              client_id: client.id,
              actor_type: "system",
              action: "Payment failed",
              description: "A client's monthly service payment failed.",
            });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = inv.customer as string | null;
        if (customerId) {
          const { data: client } = await admin
            .from("clients")
            .select("id, agency_id, payment_status")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (client && client.payment_status === "failed") {
            await admin
              .from("clients")
              .update({ payment_status: "active" })
              .eq("id", client.id);

            await admin.from("activity_log").insert({
              agency_id: client.agency_id,
              client_id: client.id,
              actor_type: "system",
              action: "Payment recovered",
              description: "A client's monthly service payment succeeded after a prior failure — payment status reset to active.",
            });
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error(`Error handling ${event.type}:`, e);
    return NextResponse.json({ error: "handler failure" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
