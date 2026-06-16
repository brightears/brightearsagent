// THE single source of truth for what each plan tier actually gets.
//
// Why this exists: the pricing copy used to advertise tier differences ("Pro
// adds auto-send", "Studio adds team seats") that NOTHING in the code enforced.
// To make that impossible again, both the gating LOGIC and the pricing COPY
// read from THIS map — a feature can't be sold unless it's a field here AND
// actually consumed by the code. Add a field only when you wire it; the pricing
// page only renders bullets backed by a field here.
//
// TRIAL mirrors PRO (CLAUDE.md: the 14-day trial is full Pro).
import type { PlanTier } from "@/app/generated/prisma/enums";

export interface PlanFeatures {
  /** Inbound inquiries we draft/answer per month (enforced: lib/billing/metering.ts).
   *  This is a CEILING on the artist's OWN incoming inquiries — never a promise
   *  to deliver N leads. */
  leadCap: number;
  /** Inbound-reply autonomy. false = the owner approves every send (Starter).
   *  true = the agent may auto-send replies from sources the owner explicitly
   *  trusts (Business.autoSendSources), enforced in lib/inbound/auto-send.ts.
   *  GigSalad is never eligible regardless (CLAUDE.md rule 4). */
  autoSend: boolean;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  TRIAL: { leadCap: 60, autoSend: true }, // full Pro during the 14-day trial
  STARTER: { leadCap: 15, autoSend: false },
  PRO: { leadCap: 60, autoSend: true },
  STUDIO: { leadCap: 150, autoSend: true },
};

export function planFeatures(plan: PlanTier): PlanFeatures {
  return PLAN_FEATURES[plan];
}
