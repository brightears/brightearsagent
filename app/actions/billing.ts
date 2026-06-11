"use server";

import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/tenant";
import { db } from "@/lib/db";
import { stripe, stripeEnabled, PLAN_LOOKUP_KEYS } from "@/lib/billing/stripe";
import type { PlanTier } from "@/app/generated/prisma/enums";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3057";
}

/** Start a subscription checkout for the chosen plan (Stripe-hosted page). */
export async function startCheckout(plan: Exclude<PlanTier, "TRIAL">) {
  if (!stripeEnabled) throw new Error("Billing not configured yet");
  const business = await getCurrentBusiness();

  const prices = await stripe().prices.list({
    lookup_keys: [PLAN_LOOKUP_KEYS[plan]],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) throw new Error(`Price for ${plan} not found — run scripts/stripe-setup.ts`);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: business.id,
    ...(business.stripeCustomerId
      ? { customer: business.stripeCustomerId }
      : { customer_email: business.ownerEmail }),
    success_url: `${appUrl()}/dashboard/settings?billing=success`,
    cancel_url: `${appUrl()}/dashboard/settings?billing=cancelled`,
    subscription_data: { metadata: { businessId: business.id } },
  });

  redirect(session.url!);
}

/** Stripe-hosted customer portal: payment method, upgrades, cancellation. */
export async function openBillingPortal() {
  if (!stripeEnabled) throw new Error("Billing not configured yet");
  const business = await getCurrentBusiness();
  if (!business.stripeCustomerId) throw new Error("No subscription yet");

  const session = await stripe().billingPortal.sessions.create({
    customer: business.stripeCustomerId,
    return_url: `${appUrl()}/dashboard/settings`,
  });
  redirect(session.url);
}

/** Settings page helper: current billing state in one shape. */
export async function billingState() {
  const business = await getCurrentBusiness();
  const trialDaysLeft = business.trialEndsAt
    ? Math.max(0, Math.ceil((business.trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;
  return {
    enabled: stripeEnabled,
    plan: business.plan,
    subscribed: !!business.stripeSubscriptionId,
    trialDaysLeft,
  };
}

/** Used by the webhook (not a form action): apply a plan change. */
export async function applySubscriptionState(
  businessId: string,
  data: {
    plan: PlanTier;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
) {
  await db.business.update({
    where: { id: businessId },
    data: {
      plan: data.plan,
      ...(data.stripeCustomerId !== undefined ? { stripeCustomerId: data.stripeCustomerId } : {}),
      ...(data.stripeSubscriptionId !== undefined
        ? { stripeSubscriptionId: data.stripeSubscriptionId }
        : {}),
    },
  });
}
