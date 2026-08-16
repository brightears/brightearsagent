"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { stripe, stripeEnabled, PLAN_LOOKUP_KEYS } from "@/lib/billing/stripe";
// Strict tier (audit B7-NF): a localhost fallback would send Stripe
// success/cancel redirects to a dead URL if APP_URL were unset — appUrl()
// fails closed in production instead.
import { appUrl } from "@/lib/app-url";
import type { PlanTier } from "@/app/generated/prisma/enums";

/**
 * Chosen beta testers get their first month comped — WITHOUT being asked to
 * type a code.
 *
 * Typing was the original design and it does not work: the configured code is
 * a valid, active 100%-off-once promotion, and Stripe's own hosted "Add
 * promotion code" box still answers "Something went wrong, please try again".
 * Attaching the exact same promotion code server-side takes the total to 0.00
 * every time (verified live, with adaptive pricing both on and off, via
 * scripts/diagnose-promo.ts). Stripe will not say why the interactive path
 * refuses it — a vague message is deliberate there, so codes cannot be
 * enumerated — so we stop depending on that path.
 *
 * It is also the better product. A tester invited personally should not have to
 * transcribe anything, and a code that fails in the redemption box fails at the
 * exact moment they are deciding whether to trust us — and they will not report
 * it, they will just leave.
 *
 * Controlled by env so the founder can change who is comped, or retire the
 * offer, without a deploy:
 *   BETA_COMP_EMAILS=a@x.com,b@y.com   owner emails to comp (exact match)
 *   BETA_PROMO_CODE=<private code>     the code whose coupon is applied
 * Unset either and nothing is comped. Deliberately an allowlist and not a URL
 * parameter: a link would get forwarded and the offer would escape.
 */
async function compDiscountFor(ownerEmail: string) {
  const allowed = (process.env.BETA_COMP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(ownerEmail.trim().toLowerCase())) return null;

  // An address on the invite allowlist was explicitly promised a $0 first
  // month. Never silently turn that promise into a full-price checkout because
  // an environment variable or Stripe promotion went missing.
  const code = process.env.BETA_PROMO_CODE?.trim();
  if (!code) {
    throw new Error(
      "Your beta invite could not be applied. You have not been charged. Please contact support and we will fix it.",
    );
  }

  const found = await stripe().promotionCodes.list({ code, active: true, limit: 1 });
  const promo = found.data[0];
  if (!promo) {
    console.error(
      JSON.stringify({
        level: "error",
        kind: "beta_comp_code_missing",
        message: "An invited beta checkout was stopped because no active promotion code matched BETA_PROMO_CODE.",
        ts: new Date().toISOString(),
      }),
    );
    throw new Error(
      "Your beta invite could not be applied. You have not been charged. Please contact support and we will fix it.",
    );
  }
  return promo.id;
}

/** Resolve the catalog price for a plan by its stable lookup key. */
async function priceForPlan(plan: Exclude<PlanTier, "TRIAL">) {
  // active: true matters. prices.list returns archived prices too, and a
  // lookup_key is only unique among ACTIVE prices — archiving one frees the key
  // for reuse. Without this filter the list can hand back the archived price,
  // checkout is created against it, and Stripe rejects it at the last step: the
  // customer reaches the payment page and fails there, which is the most
  // expensive place to fail.
  const prices = await stripe().prices.list({
    lookup_keys: [PLAN_LOOKUP_KEYS[plan]],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    // Only STARTER has ever been purchased, so PRO/STUDIO are the likely
    // victims: a missing live price makes the tier's button an error page with
    // no clue what went wrong. Log the cause where we will actually see it.
    console.error(
      JSON.stringify({
        level: "error",
        kind: "stripe_price_missing",
        plan,
        lookupKey: PLAN_LOOKUP_KEYS[plan],
        message: "No ACTIVE Stripe price for this plan under the current keys — this tier cannot be bought at all.",
        ts: new Date().toISOString(),
      }),
    );
    throw new Error(
      `We could not open checkout for the ${plan} plan. This is on us, not you — please contact support and we will sort it out.`,
    );
  }
  return price;
}

/**
 * The stored Stripe customer id, but only if Stripe still recognises it under
 * the keys we are currently using.
 *
 * A customer id is not permanent the way it looks. Test-mode and live-mode
 * objects live in separate namespaces, so every id minted while the app ran on
 * test keys became unresolvable the moment live keys went in — and a customer
 * deleted in the dashboard does the same thing. The id sits in our database
 * looking perfectly valid, we hand it to Stripe, and Stripe answers
 * "No such customer: cus_…; a similar object exists in test mode". The server
 * action throws, the page renders "Something hit a snag", and the tenant can
 * never subscribe. That is not hypothetical: it is exactly what blocked the
 * founder's own account, whose customer was created under test keys in June and
 * has been silently un-billable since the live-key switch.
 *
 * So treat a missing customer as recoverable state, not a crash: forget the
 * dead id and let checkout mint a fresh one. Only "it genuinely is not there"
 * clears the link — an auth or network failure must never wipe a good customer
 * reference, so anything else is rethrown untouched.
 */
async function usableCustomerId(business: {
  id: string;
  stripeCustomerId: string | null;
}): Promise<string | null> {
  if (!business.stripeCustomerId) return null;
  try {
    const customer = await stripe().customers.retrieve(business.stripeCustomerId);
    if ((customer as { deleted?: boolean }).deleted) throw { code: "resource_missing" };
    return business.stripeCustomerId;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const gone = e.code === "resource_missing" || /No such customer/i.test(e.message ?? "");
    if (!gone) throw err;
    await db.business.update({
      where: { id: business.id },
      data: { stripeCustomerId: null },
    });
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "stripe_customer_stale",
        businessId: business.id,
        customerId: business.stripeCustomerId,
        message: "Stripe does not recognise this customer under the current keys — link cleared so checkout can mint a new one.",
        ts: new Date().toISOString(),
      }),
    );
    return null;
  }
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
  const customerId = await usableCustomerId(business);
  const compPromoId = await compDiscountFor(business.ownerEmail);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: business.id,
    ...(customerId ? { customer: customerId } : { customer_email: business.ownerEmail }),
    // The selected beta allowlist is the only supported discount path. Do not
    // expose Stripe's generic promotion-code box: old or leaked catalog codes
    // must never bypass the application-side invite boundary.
    ...(compPromoId ? { discounts: [{ promotion_code: compPromoId }] } : {}),
    success_url: `${appUrl()}/dashboard/settings?billing=success`,
    cancel_url: `${appUrl()}/dashboard/settings?billing=cancelled`,
    // Duplicate the cohort bit on Checkout and Subscription so either webhook
    // event shape can durably anchor the selected-testers-only quality cohort.
    metadata: { businessId: business.id, betaCohort: compPromoId ? "true" : "false" },
    subscription_data: {
      metadata: { businessId: business.id, betaCohort: compPromoId ? "true" : "false" },
    },
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

/**
 * Open a portal session, surviving a pinned configuration Stripe cannot resolve.
 *
 * Exactly the same trap as usableCustomerId above, one object type over: a
 * billing-portal configuration is mode-scoped, so the `bpc_` created under test
 * keys stopped existing the moment live keys went in. Passed blindly, Stripe
 * answers "No such billing portal configuration" and "Manage billing" becomes a
 * dead button — for a paying subscriber that reads as "I cannot cancel", which
 * is both the worst failure we can hand a customer and a chargeback waiting to
 * happen.
 *
 * A pinned configuration is a nicety (it pre-enables subscription_update); the
 * account's default portal works without it. So when the pin is unusable, drop
 * it and open the default rather than failing the whole action. Only
 * "it genuinely is not there" is recovered — auth and network errors rethrow
 * untouched, because silently falling back on those would hide real outages.
 */
async function createPortalSession(
  params: Stripe.BillingPortal.SessionCreateParams,
): Promise<Stripe.BillingPortal.Session> {
  const cfg = portalConfig();
  try {
    return await stripe().billingPortal.sessions.create({ ...params, ...cfg });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const gone =
      e.code === "resource_missing" || /No such billing portal configuration/i.test(e.message ?? "");
    if (!cfg.configuration || !gone) throw err;
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "stripe_portal_config_stale",
        configuration: cfg.configuration,
        message:
          "STRIPE_PORTAL_CONFIG is not resolvable under the current keys (a test-mode id under live keys does this) — opened the account default portal instead so the customer can still manage billing.",
        ts: new Date().toISOString(),
      }),
    );
    return await stripe().billingPortal.sessions.create(params);
  }
}

/** Stripe-hosted customer portal: payment method, upgrades, cancellation. */
export async function openBillingPortal() {
  if (!stripeEnabled) throw new Error("Billing not configured yet");
  const business = await getCurrentBusiness();
  // Same staleness trap as checkout: a portal session for a customer Stripe
  // cannot resolve throws, and "Manage billing" becomes a dead button — which
  // for a subscriber reads as "I cannot cancel", the worst possible failure.
  const customerId = await usableCustomerId(business);
  if (!customerId) throw new Error("No subscription yet");

  const session = await createPortalSession({
    customer: customerId,
    return_url: `${appUrl()}/dashboard/settings#billing`,
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

  const session = await createPortalSession({
    customer: business.stripeCustomerId,
    return_url: `${appUrl()}/dashboard/settings?billing=success`,
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
