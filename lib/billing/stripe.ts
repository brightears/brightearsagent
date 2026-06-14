import Stripe from "stripe";
import type { PlanTier } from "@/app/generated/prisma/enums";

export const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

// Pin the API version (audit B7) so a future `stripe` SDK bump can't silently
// change the request/response contract under us. Matches the version this SDK
// (v19, "dahlia") is built against; bump deliberately alongside SDK upgrades.
const STRIPE_API_VERSION = "2026-05-27.dahlia";

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  }
  return _stripe;
}

/**
 * Plans are identified by Stripe price lookup_keys (stable across test/live
 * mode re-creation via scripts/stripe-setup.ts) — never by hardcoded price ids.
 */
export const PLAN_LOOKUP_KEYS: Record<Exclude<PlanTier, "TRIAL">, string> = {
  STARTER: "brightears_starter_monthly",
  PRO: "brightears_pro_monthly",
  STUDIO: "brightears_studio_monthly",
};

export function planForLookupKey(lookupKey: string | null | undefined): PlanTier | null {
  if (!lookupKey) return null;
  const entry = Object.entries(PLAN_LOOKUP_KEYS).find(([, k]) => k === lookupKey);
  return (entry?.[0] as PlanTier) ?? null;
}
