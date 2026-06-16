import { db } from "@/lib/db";
import type { PlanTier } from "@/app/generated/prisma/enums";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";

/**
 * Customers are metered in LEADS (they understand leads, not tokens).
 * At cap: ingestion continues (never lose a lead), drafting pauses for the rest
 * of the month, owner gets a friendly upgrade prompt — never a surprise bill.
 * DEFERRED (audit C3): a buyable lead-pack top-up that raises the cap mid-month
 * is a founder revenue option, NOT built (no Stripe price / checkout / UI). The
 * cap resets at monthStart(); the only mid-month fix today is upgrading the plan.
 *
 * The caps live in lib/billing/plan-features.ts (THE single source of truth for
 * tier capabilities); this is a derived view kept for the existing importers.
 * TRIAL = full Pro: during the window `trialEndsAt` is in the FUTURE so the
 * agent works with the Pro allowance; an expired unsubscribed trial forces
 * overCap via isAgentPaused.
 */
export const PLAN_LEAD_CAPS: Record<PlanTier, number> = Object.fromEntries(
  (Object.entries(PLAN_FEATURES) as [PlanTier, { leadCap: number }][]).map(
    ([plan, f]) => [plan, f.leadCap],
  ),
) as Record<PlanTier, number>;

export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function leadsUsedThisMonth(businessId: string, now = new Date()): Promise<number> {
  // SPAM doesn't count against the customer — filtering it is our gift.
  return db.lead.count({
    where: { businessId, createdAt: { gte: monthStart(now) }, status: { not: "SPAM" } },
  });
}

export interface MeterState {
  used: number;
  cap: number;
  overCap: boolean;
}

/**
 * Pure "is the agent paused?" check (no DB) — the subscription gate.
 * NO automatic free trial (founder decision 2026-06-16): an UNSUBSCRIBED tenant
 * (still on the free `plan=TRIAL` default, no paid Stripe subscription) is
 * paused — the agent does nothing until they subscribe. Subscribing flips
 * `plan` to a paid tier (Stripe webhook); a Stripe promotion code just makes
 * the first invoice free, so a comped artist is a normal paid subscriber to us.
 * Cancelling flips `plan` back to TRIAL → paused again. (TRIAL is now "free /
 * not subscribed", not "14-day trial"; `trialEndsAt` is vestigial.)
 * Used by meterState (drafting), the venue-pitch actions, and the discovery
 * scan so reactive drafting, proactive pitches, and scanning gate identically.
 */
export function isAgentPaused(plan: PlanTier): boolean {
  return plan === "TRIAL";
}

/** Days remaining in an active free trial (0 once it has ended or N/A). */
export function trialDaysLeft(
  plan: PlanTier,
  trialEndsAt?: Date | null,
  now = new Date(),
): number {
  if (plan !== "TRIAL" || !trialEndsAt) return 0;
  const ms = trialEndsAt.getTime() - now.getTime();
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}

export async function meterState(
  businessId: string,
  plan: PlanTier,
  now = new Date(),
  trialEndsAt?: Date | null,
): Promise<MeterState> {
  const used = await leadsUsedThisMonth(businessId, now);
  const cap = PLAN_LEAD_CAPS[plan];
  // Unsubscribed (TRIAL) → agent paused entirely (leads still ingest, nothing is
  // lost, subscribing resumes immediately). On a paid plan, only used > cap
  // pauses drafting. (trialEndsAt is kept in the signature for callers but no
  // longer affects the gate — there's no time-based trial anymore.)
  void trialEndsAt;
  return { used, cap, overCap: isAgentPaused(plan) || used > cap };
}
