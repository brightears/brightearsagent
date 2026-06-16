// Auto-send autonomy gate (the Pro+ tier capability — CLAUDE.md pricing).
//
// Starter = the owner approves every send. Pro/Studio (and the trial) MAY
// auto-send a drafted reply WITHOUT waiting for approval — but only from
// sources the owner has explicitly marked as trusted (Business.autoSendSources),
// and never from a source we're not allowed to auto-send to.
//
// PURE module (no DB): the pipeline passes the plan, the tenant's trusted-source
// list, and the lead's source, and asks `canAutoSend`.
import type { LeadSource, PlanTier } from "@/app/generated/prisma/enums";
import { planFeatures } from "@/lib/billing/plan-features";

/**
 * Sources we will NEVER auto-send to, regardless of plan or owner setting.
 * GigSalad: their ToS is draft + deep-link only, never auto-send (CLAUDE.md
 * rule 4). Keep this list as the hard ToS backstop.
 */
export const AUTO_SEND_INELIGIBLE_SOURCES: readonly LeadSource[] = ["GIGSALAD"];

/** Sources the owner is allowed to OFFER for auto-send in settings (the rest). */
export function autoSendEligibleSources(all: readonly LeadSource[]): LeadSource[] {
  return all.filter((s) => !AUTO_SEND_INELIGIBLE_SOURCES.includes(s));
}

/**
 * Should this lead's first reply be auto-sent (no approval step)?
 * True only when: the plan grants auto-send AND the source is ToS-eligible AND
 * the owner has marked that source as trusted. Anything else → draft for approval.
 */
export function canAutoSend(
  plan: PlanTier,
  trustedSources: readonly LeadSource[],
  source: LeadSource,
): boolean {
  if (!planFeatures(plan).autoSend) return false;
  if (AUTO_SEND_INELIGIBLE_SOURCES.includes(source)) return false;
  return trustedSources.includes(source);
}
