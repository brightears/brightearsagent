import { db } from "@/lib/db";
import type { PlanTier } from "@/app/generated/prisma/enums";

/**
 * Customers are metered in LEADS (they understand leads, not tokens).
 * At cap: ingestion continues (never lose a lead), drafting pauses, owner gets
 * a friendly upsell push — never a surprise bill. Lead packs raise the cap.
 */
export const PLAN_LEAD_CAPS: Record<PlanTier, number> = {
  TRIAL: 60, // full Pro experience for 14 days
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

export async function meterState(
  businessId: string,
  plan: PlanTier,
  now = new Date(),
  trialEndsAt?: Date | null,
): Promise<MeterState> {
  const used = await leadsUsedThisMonth(businessId, now);
  const cap = PLAN_LEAD_CAPS[plan];
  // Expired trial without a subscription: drafting pauses entirely (cap 0
  // semantics) — leads still ingest, nothing is lost, resubscribing resumes.
  const trialExpired = plan === "TRIAL" && !!trialEndsAt && trialEndsAt.getTime() < now.getTime();
  return { used, cap, overCap: trialExpired || used > cap };
}
