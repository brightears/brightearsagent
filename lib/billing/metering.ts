import { db } from "@/lib/db";
import type { PlanTier } from "@/app/generated/prisma/enums";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import { startOfTenantDay } from "@/lib/outreach/caps";

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

/**
 * Start of the current billing month. With a timezone, the boundary is local
 * midnight on the 1st in the TENANT's zone (CLAUDE.md rule 9) — a Bangkok
 * tenant's Aug 1 00:00–07:00 local leads count to August, not July. The
 * timezone-less form keeps the UTC boundary for internal/reporting callers.
 */
export function monthStart(now = new Date(), timezone?: string): Date {
  if (!timezone) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  // Local midnight of "today", stepped back to ~local noon on the 1st (DST can
  // drift the naive subtraction by an hour or two, but never off the calendar
  // day), then resolved to exact local midnight by the same DST-correct helper.
  const todayMidnight = startOfTenantDay(now, timezone);
  const dayOfMonth = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "numeric" }).format(now),
  );
  const nearNoonOnFirst = new Date(
    todayMidnight.getTime() - (dayOfMonth - 1) * 24 * 3600_000 + 12 * 3600_000,
  );
  return startOfTenantDay(nearNoonOnFirst, timezone);
}

export async function leadsUsedThisMonth(
  businessId: string,
  now = new Date(),
  timezone?: string,
): Promise<number> {
  // SPAM doesn't count against the customer — filtering it is our gift.
  // VENUE_OUTREACH doesn't count either: pricing promises TWO separate
  // allowances (metered inbound leads vs. daily-capped venue pitches — see
  // CLAUDE.md pricing), so a venue answering the tenant's own Hunt pitch must
  // never eat the paid inbound cap.
  return db.lead.count({
    where: {
      businessId,
      createdAt: { gte: monthStart(now, timezone) },
      status: { not: "SPAM" },
      source: { not: "VENUE_OUTREACH" },
    },
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

export async function meterState(
  businessId: string,
  plan: PlanTier,
  now = new Date(),
  trialEndsAt?: Date | null,
  timezone?: string,
): Promise<MeterState> {
  const used = await leadsUsedThisMonth(businessId, now, timezone);
  const cap = PLAN_LEAD_CAPS[plan];
  // Unsubscribed (TRIAL) → agent paused entirely (leads still ingest, nothing is
  // lost, subscribing resumes immediately). On a paid plan, only used > cap
  // pauses drafting. (trialEndsAt is kept in the signature for callers but no
  // longer affects the gate — there's no time-based trial anymore.)
  void trialEndsAt;
  return { used, cap, overCap: isAgentPaused(plan) || used > cap };
}
