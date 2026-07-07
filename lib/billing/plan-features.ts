// THE single source of truth for what each plan tier actually gets.
//
// Why this exists: the pricing copy used to advertise tier differences ("Pro
// adds auto-send", "Studio adds team seats") that NOTHING in the code enforced.
// To make that impossible again, both the gating LOGIC and the pricing COPY
// read from THIS map — a feature can't be sold unless it's a field here AND
// actually consumed by the code. Add a field only when you wire it; the pricing
// page only renders bullets backed by a field here.
//
// TRIAL = "free / not subscribed" (agent paused until subscribe — no auto
// trial) and it FAILS CLOSED: zero inbound allowance, no autonomy, one city.
// The old "mirror PRO for comped months" rationale was stale — a comped first
// month is a real $0 Stripe subscription whose webhook flips plan to the paid
// tier, so TRIAL never needs paid caps (audit 2026-07). isAgentPaused is the
// primary gate; these caps are the belt-and-suspenders for any code path that
// consults capability without checking the pause.
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
  /** Coverage: how many HOME cities the Hunt scans (serviceCities). Enforced at
   *  save (app/actions/travel.ts: updateHomeBase trims to this) AND at scan
   *  (lib/discovery/scan.ts slices home targets). Travel windows are separate
   *  and all-tier. 25 ≈ unlimited for a real roster. */
  homeCityCap: number;
  /** P13: how many ACTIVE performers the roster may hold. Studio is the
   *  multi-performer tier (its recut claim); enforced at performer save
   *  (app/actions/performers.ts). 10 ≈ unlimited for a real studio. */
  rosterCap: number;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  TRIAL: { leadCap: 0, autoSend: false, homeCityCap: 1, rosterCap: 1 }, // unsubscribed = fail closed (agent paused anyway)
  STARTER: { leadCap: 15, autoSend: false, homeCityCap: 1, rosterCap: 1 },
  PRO: { leadCap: 60, autoSend: true, homeCityCap: 3, rosterCap: 1 },
  STUDIO: { leadCap: 150, autoSend: true, homeCityCap: 25, rosterCap: 10 },
};

export function planFeatures(plan: PlanTier): PlanFeatures {
  return PLAN_FEATURES[plan];
}
