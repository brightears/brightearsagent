import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, stripeEnabled, planForLookupKey } from "@/lib/billing/stripe";

/**
 * Stripe webhook: keeps Business.plan + customer/subscription ids in sync.
 * Signature-verified with STRIPE_WEBHOOK_SECRET (fail-closed in production).
 */
export async function POST(req: NextRequest) {
  if (!stripeEnabled) return NextResponse.json({ error: "billing disabled" }, { status: 503 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "set STRIPE_WEBHOOK_SECRET (stripe listen prints it)" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.client_reference_id;
      if (!businessId || session.mode !== "subscription") break;

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!subscriptionId) break;

      const sub = await stripe().subscriptions.retrieve(subscriptionId);
      const lookupKey = sub.items.data[0]?.price?.lookup_key;
      const plan = planForLookupKey(lookupKey);
      if (!plan) break;

      await db.business.update({
        where: { id: businessId },
        data: {
          plan,
          stripeCustomerId: customerId ?? undefined,
          stripeSubscriptionId: subscriptionId,
          trialEndsAt: null, // subscribed — the in-app trial clock no longer applies
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const business = await db.business.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (!business) break;

      if (sub.status === "active" || sub.status === "past_due") {
        const plan = planForLookupKey(sub.items.data[0]?.price?.lookup_key);
        if (plan && plan !== business.plan) {
          await db.business.update({ where: { id: business.id }, data: { plan } });
        }
      } else if (sub.status === "canceled" || sub.status === "unpaid") {
        await db.business.update({
          where: { id: business.id },
          data: { plan: "TRIAL", trialEndsAt: new Date(), stripeSubscriptionId: null },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const business = await db.business.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (!business) break;
      // Subscription gone → expired-trial state: leads still ingest, drafting
      // pauses (metering), owner sees resubscribe prompts. Never delete data.
      await db.business.update({
        where: { id: business.id },
        data: { plan: "TRIAL", trialEndsAt: new Date(), stripeSubscriptionId: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
