import { db } from "@/lib/db";
import type { PlanTier } from "@/app/generated/prisma/enums";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import { startOfTenantDay } from "@/lib/outreach/caps";
import {
  effectivePlan,
  isActiveBeta,
  type BetaEntitlement,
} from "@/lib/billing/beta";

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
 * TRIAL normally means unsubscribed and paused. A founder-approved email may
 * carry a server-authored 30-day beta window; only that exact combination gets
 * Starter allowance, without becoming a paid plan or Stripe subscription.
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
 * Pure "is the agent paused?" check (no DB). Paid tiers are active; TRIAL is
 * paused unless it carries a currently active, founder-approved beta window.
 * Expiry is checked at every work boundary, so a beta stops exactly at its
 * timestamp without relying on a cron mutation.
 * Used by meterState (drafting), the venue-pitch actions, and the discovery
 * scan so reactive drafting, proactive pitches, and scanning gate identically.
 */
export function isAgentPaused(entitlement: BetaEntitlement, now = new Date()): boolean {
  return entitlement.plan === "TRIAL" && !isActiveBeta(entitlement, now);
}

export async function meterState(
  businessId: string,
  entitlement: BetaEntitlement,
  now = new Date(),
  timezone?: string,
): Promise<MeterState> {
  const used = await leadsUsedThisMonth(businessId, now, timezone);
  const cap = PLAN_LEAD_CAPS[effectivePlan(entitlement, now)];
  // Leads always ingest. Work pauses for an inactive entitlement or after the
  // active plan/beta cap is crossed; there is never usage-based billing.
  return { used, cap, overCap: isAgentPaused(entitlement, now) || used > cap };
}
