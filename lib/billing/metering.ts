import { db } from "@/lib/db";
import type { PlanTier } from "@/app/generated/prisma/enums";

/**
 * Customers are metered in LEADS (they understand leads, not tokens).
 * At cap: ingestion continues (never lose a lead), drafting pauses, owner gets
 * a friendly upsell push — never a surprise bill. Lead packs raise the cap.
 */
export const PLAN_LEAD_CAPS: Record<PlanTier, number> = {
  // TRIAL is the "unsubscribed" state (NO free trial — founder decision
  // 2026-06-14): `trialEndsAt` is provisioned in the past, so meterState()
  // forces overCap regardless of this number and the agent stays paused until
  // they subscribe. Kept non-zero only so the cap math/UI has a sane divisor.
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
 * Pure "agent paused / unsubscribed" check (no DB) — the no-free-trial gate.
 * A new/unsubscribed tenant is plan=TRIAL with `trialEndsAt` in the past
 * (see lib/tenant.ts); a subscribed tenant has a paid plan and trialEndsAt
 * cleared. Used by meterState (drafting gate) and the venue-pitch actions
 * (generate/send gate) so the live agent only works on an active paid plan.
 */
export function isUnsubscribed(plan: PlanTier, trialEndsAt?: Date | null, now = new Date()): boolean {
  return plan === "TRIAL" && !!trialEndsAt && trialEndsAt.getTime() < now.getTime();
}

export async function meterState(
  businessId: string,
  plan: PlanTier,
  now = new Date(),
  trialEndsAt?: Date | null,
): Promise<MeterState> {
  const used = await leadsUsedThisMonth(businessId, now);
  const cap = PLAN_LEAD_CAPS[plan];
  // Unsubscribed (TRIAL + trialEndsAt in the past — the no-free-trial default):
  // the agent is paused entirely (no free lead allowance) — leads still ingest,
  // nothing is lost, and subscribing resumes drafting immediately.
  return { used, cap, overCap: isUnsubscribed(plan, trialEndsAt, now) || used > cap };
}
