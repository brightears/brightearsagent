"use server";

import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/tenant";
import { stripe, stripeEnabled, PLAN_LOOKUP_KEYS } from "@/lib/billing/stripe";
import type { PlanTier } from "@/app/generated/prisma/enums";

function appUrl(): string {
  // Fail-closed in production (audit B7-NF): a localhost fallback would send
  // Stripe success/cancel redirects to a dead URL if APP_URL were unset.
  const url = process.env.APP_URL;
  if (url) return url;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL must be set in production");
  return "http://localhost:3057";
}

/** Resolve the catalog price for a plan by its stable lookup key. */
async function priceForPlan(plan: Exclude<PlanTier, "TRIAL">) {
  const prices = await stripe().prices.list({
    lookup_keys: [PLAN_LOOKUP_KEYS[plan]],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) throw new Error(`Price for ${plan} not found — run scripts/stripe-setup.ts`);
  return price;
}

/** Start a subscription checkout for the chosen plan (Stripe-hosted page). */
export async function startCheckout(plan: Exclude<PlanTier, "TRIAL">): Promise<void> {
  if (!stripeEnabled) throw new Error("Billing not configured yet");
  const business = await getCurrentBusiness();

  // Already-subscribed guard (audit 2026-07): checkout would happily create a
  // SECOND subscription for an existing subscriber (double billing). A plan
  // choice from someone who already has one is an upgrade/downgrade — route
  // it through the portal's confirm flow instead.
  if (business.stripeSubscriptionId) return openPlanChange(plan);

  const price = await priceForPlan(plan);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: business.id,
    ...(business.stripeCustomerId
      ? { customer: business.stripeCustomerId }
      : { customer_email: business.ownerEmail }),
    // No automatic free trial (founder decision 2026-06-16). Instead, the
    // founder mints Stripe PROMOTION CODES (a 100%-off-first-month coupon) in
    // the Stripe Dashboard and hands them to selected artists; this flag shows
    // the promo-code field on Stripe's checkout so a valid code makes the first
    // month free. Nothing about trials/codes appears on our own site.
    allow_promotion_codes: true,
    success_url: `${appUrl()}/dashboard/settings?billing=success`,
    cancel_url: `${appUrl()}/dashboard/settings?billing=cancelled`,
    subscription_data: { metadata: { businessId: business.id } },
  });

  redirect(session.url!);
}

/** Optional pinned portal configuration (scripts/stripe-setup.ts creates one
 *  with subscription_update enabled and prints its id). Unset → Stripe's
 *  default portal configuration. */
function portalConfig() {
  const id = process.env.STRIPE_PORTAL_CONFIG;
  return id ? { configuration: id } : {};
}

/** Stripe-hosted customer portal: payment method, upgrades, cancellation. */
export async function openBillingPortal() {
  if (!stripeEnabled) throw new Error("Billing not configured yet");
  const business = await getCurrentBusiness();
  if (!business.stripeCustomerId) throw new Error("No subscription yet");

  const session = await stripe().billingPortal.sessions.create({
    customer: business.stripeCustomerId,
    return_url: `${appUrl()}/dashboard/settings#billing`,
    ...portalConfig(),
  });
  redirect(session.url);
}

/**
 * TRUE one-click plan change (audit 2026-07: the at-cap banner's "Upgrade"
 * dumped the artist into a generic portal hunt). Deep-links the portal's
 * subscription_update_confirm flow with the target price preselected —
 * Stripe shows the proration, one confirm applies it, the webhook syncs the
 * plan. Falls back to a fresh checkout when nothing is subscribed yet.
 */
export async function openPlanChange(plan: Exclude<PlanTier, "TRIAL">): Promise<void> {
  if (!stripeEnabled) throw new Error("Billing not configured yet");
  const business = await getCurrentBusiness();
  if (!business.stripeSubscriptionId) return startCheckout(plan);
  if (!business.stripeCustomerId) {
    // Sub without customer should be impossible (webhook writes both) — throw
    // rather than bounce back to startCheckout and recurse.
    throw new Error("Subscription exists but no Stripe customer — check the webhook sync");
  }

  const [price, sub] = await Promise.all([
    priceForPlan(plan),
    stripe().subscriptions.retrieve(business.stripeSubscriptionId),
  ]);
  const item = sub.items.data[0];
  if (!item) throw new Error("Subscription has no items — check the Stripe dashboard");
  if (item.price?.id === price.id) {
    // Already on this plan — nothing to confirm; show the plain portal.
    return openBillingPortal();
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: business.stripeCustomerId,
    return_url: `${appUrl()}/dashboard/settings?billing=success`,
    ...portalConfig(),
    flow_data: {
      type: "subscription_update_confirm",
      subscription_update_confirm: {
        subscription: sub.id,
        items: [{ id: item.id, price: price.id, quantity: 1 }],
      },
      after_completion: {
        type: "redirect",
        redirect: { return_url: `${appUrl()}/dashboard/settings?billing=success` },
      },
    },
  });
  redirect(session.url);
}

/** Settings page helper: current billing state in one shape.
 *  No free trial (founder decision 2026-06-16): the agent runs on an active
 *  subscription. `subscribed` is the whole story — an unsubscribed tenant
 *  (plan=TRIAL) is paused until they choose a plan. */
export async function billingState() {
  const business = await getCurrentBusiness();
  return {
    enabled: stripeEnabled,
    plan: business.plan,
    subscribed: !!business.stripeSubscriptionId,
  };
}

// (Removed `applySubscriptionState` — it was an unauthenticated, tenant-
// unscoped "use server" export: anyone could grant any tenant a paid plan. The
// Stripe webhook updates the plan directly via lib/billing/webhook.ts; nothing
// imported this. Stripe audit 2026-06-16, finding S1.)
