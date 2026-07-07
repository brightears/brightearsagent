// Stripe webhook event application — extracted from the route so the
// subscription-lifecycle logic is unit-testable without HTTP/signature mocking.
// The route (app/api/webhooks/stripe/route.ts) owns signature verification +
// idempotency; this owns "given a verified event, sync Business.plan."
//
// Hardening (Stripe audit 2026-06-16):
//  - Activate a paid plan ONLY for a genuinely-live subscription (never on the
//    mere presence of a subscription id — an authorize-then-fail / abandoned-3DS
//    checkout must not hand out a free agent).
//  - Resolve the tenant by subscription metadata.businessId first (set at
//    checkout), then by stored subscription id, then by customer id — so a
//    re-subscribe (new sub id) or out-of-order delivery can't silently desync.
//  - Treat non-active terminal statuses (canceled/unpaid/incomplete_expired/…)
//    as PAUSE (plan→TRIAL); past_due stays live through Stripe's dunning grace
//    (Stripe must be configured to eventually cancel → we then pause).
//  - When an event is ours (has businessId metadata) but the tenant can't be
//    resolved, signal RETRY so the route returns 5xx and Stripe re-delivers,
//    instead of silently recording it as processed.
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, planForLookupKey } from "@/lib/billing/stripe";
import { scheduleActivationScan } from "@/lib/discovery/activation";

/** applied → safe to record as processed; retry → return 5xx, do NOT record. */
export type ApplyResult = { applied: boolean; retry: boolean };

const SKIP: ApplyResult = { applied: false, retry: false };
const APPLIED: ApplyResult = { applied: true, retry: false };
const RETRY: ApplyResult = { applied: false, retry: true };

// Live = entitled to the agent. past_due is the dunning grace window; Stripe
// dunning must eventually move it to canceled/unpaid, which we pause on.
const LIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

function customerIdOf(obj: Stripe.Subscription | Stripe.Checkout.Session): string | undefined {
  return typeof obj.customer === "string" ? obj.customer : obj.customer?.id ?? undefined;
}

/** Resolve the tenant for a subscription: metadata.businessId → stored sub id → customer id. */
async function resolveBusiness(sub: Stripe.Subscription) {
  const metaId = sub.metadata?.businessId;
  if (metaId) {
    const byMeta = await db.business.findUnique({ where: { id: metaId } });
    if (byMeta) return byMeta;
  }
  const bySub = await db.business.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (bySub) return bySub;
  const custId = customerIdOf(sub);
  if (custId) return db.business.findFirst({ where: { stripeCustomerId: custId } });
  return null;
}

export async function applyStripeEvent(event: Stripe.Event): Promise<ApplyResult> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.client_reference_id;
      if (!businessId || session.mode !== "subscription") return SKIP; // not ours
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!subscriptionId) return SKIP;

      const sub = await stripe().subscriptions.retrieve(subscriptionId);
      // S2: only a genuinely-live subscription activates the agent. ($0 promo-code
      // subs are "active" with payment_status no_payment_required — handled.)
      if (!LIVE_STATUSES.has(sub.status)) return SKIP;

      const lookupKey = sub.items.data[0]?.price?.lookup_key;
      const plan = planForLookupKey(lookupKey);
      if (!plan) {
        // S6: paying customer on an off-catalog price (typo'd/missing lookup_key
        // — easy to do when minting prices/coupons by hand). Don't silently
        // strand them on TRIAL; surface it.
        console.error(
          `stripe webhook ${event.id}: unmapped lookup_key "${lookupKey}" for business ${businessId} — plan NOT set`,
        );
        return SKIP;
      }
      await db.business.update({
        where: { id: businessId },
        data: {
          plan,
          stripeCustomerId: customerIdOf(session) ?? undefined,
          stripeSubscriptionId: subscriptionId,
          trialEndsAt: null,
        },
      });
      // Subscribe-to-activate means day one IS the trial: hunt the moment the
      // plan flips instead of waiting for the daily cron. Post-response; the
      // scan itself refuses tenants with no cities yet.
      scheduleActivationScan(businessId, { force: true });
      return APPLIED;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const business = await resolveBusiness(sub);
      if (!business) return sub.metadata?.businessId ? RETRY : SKIP;

      if (LIVE_STATUSES.has(sub.status)) {
        const plan = planForLookupKey(sub.items.data[0]?.price?.lookup_key);
        if (!plan) {
          console.error(`stripe webhook ${event.id}: unmapped lookup_key on sub ${sub.id}`);
          return SKIP;
        }
        // Sync plan AND the (possibly re-subscribed) subscription id, so a new
        // sub re-attaches to the right tenant.
        await db.business.update({
          where: { id: business.id },
          data: {
            plan,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: customerIdOf(sub) ?? undefined,
            trialEndsAt: null,
          },
        });
        // Paused → live transition only (business.plan is the pre-write value):
        // a re-activation deserves an immediate hunt; routine renewals and plan
        // switches don't re-burn the scan budget.
        if (business.plan === "TRIAL") scheduleActivationScan(business.id, { force: true });
      } else {
        // canceled / unpaid / incomplete_expired / paused → pause the agent.
        await db.business.update({
          where: { id: business.id },
          data: { plan: "TRIAL", stripeSubscriptionId: null, trialEndsAt: null },
        });
      }
      return APPLIED;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const business = await resolveBusiness(sub);
      if (!business) return sub.metadata?.businessId ? RETRY : SKIP;
      // Out-of-order guard: ignore a deletion of an OLD subscription when a
      // different (newer) one is the tenant's current — don't pause a live agent.
      if (business.stripeSubscriptionId && business.stripeSubscriptionId !== sub.id) {
        return SKIP;
      }
      await db.business.update({
        where: { id: business.id },
        data: { plan: "TRIAL", stripeSubscriptionId: null, trialEndsAt: null },
      });
      return APPLIED;
    }

    default:
      return SKIP;
  }
}
