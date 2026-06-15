import { db } from "@/lib/db";
import type { PlanTier } from "@/app/generated/prisma/enums";

/**
 * Customers are metered in LEADS (they understand leads, not tokens).
 * At cap: ingestion continues (never lose a lead), drafting pauses, owner gets
 * a friendly upsell push — never a surprise bill. Lead packs raise the cap.
 */
export const PLAN_LEAD_CAPS: Record<PlanTier, number> = {
  // TRIAL is a REAL 14-day full-Pro free trial (FINAL founder decision
  // 2026-06-14): during the window `trialEndsAt` is in the FUTURE, so the agent
  // works with the full Pro allowance below. When the trial expires without a
  // paid plan, meterState() forces overCap (isAgentPaused) and the agent pauses
  // until they subscribe — this cap is the trial's live allowance, not a stub.
  TRIAL: 60,
  STARTER: 15,
  PRO: 60,
  STUDIO: 150,
};

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
 * Pure "is the agent paused?" check (no DB) — the trial-expiry gate.
 * The agent is paused only when an UNSUBSCRIBED tenant's free trial has ended:
 * plan=TRIAL AND `trialEndsAt` is in the past (see lib/tenant.ts). During an
 * active trial (trialEndsAt in the future) or on any paid plan, the agent runs.
 * Used by meterState (drafting gate) and the venue-pitch actions (generate/send
 * gate) so reactive drafting and proactive pitches gate identically.
 */
export function isAgentPaused(plan: PlanTier, trialEndsAt?: Date | null, now = new Date()): boolean {
  return plan === "TRIAL" && !!trialEndsAt && trialEndsAt.getTime() < now.getTime();
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
  // Agent paused (TRIAL whose trialEndsAt is in the past — an expired trial with
  // no subscription): the agent is paused entirely — leads still ingest, nothing
  // is lost, and subscribing resumes drafting immediately. During an active
  // trial or on a paid plan, only used > cap pauses drafting.
  return { used, cap, overCap: isAgentPaused(plan, trialEndsAt, now) || used > cap };
}
