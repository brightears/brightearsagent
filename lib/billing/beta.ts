import type { PlanTier } from "@/app/generated/prisma/enums";

export const BETA_DURATION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type BetaEntitlement = {
  plan: PlanTier;
  betaStartedAt?: Date | null;
  trialEndsAt?: Date | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Exact, case-insensitive email allowlist. Empty entries are ignored. */
export function betaInviteEmails(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(",").map(normalizeEmail).filter(Boolean))];
}

/**
 * The invite boundary is server-authored configuration, never a URL or form
 * value. Clerk supplies a verified primary email before this is called.
 */
export function isBetaInviteEmail(email: string, raw: string | undefined): boolean {
  return betaInviteEmails(raw).includes(normalizeEmail(email));
}

export function betaWindowForInvite(
  email: string,
  raw: string | undefined,
  now = new Date(),
): { betaStartedAt: Date; trialEndsAt: Date } | null {
  if (!isBetaInviteEmail(email, raw)) return null;
  return {
    betaStartedAt: now,
    trialEndsAt: new Date(now.getTime() + BETA_DURATION_DAYS * DAY_MS),
  };
}

/**
 * Only the deliberate combination written by beta provisioning is entitled:
 * TRIAL + both beta timestamps + a window containing `now`. Requiring
 * betaStartedAt prevents an old/vestigial trialEndsAt value from granting work.
 */
export function isActiveBeta(entitlement: BetaEntitlement, now = new Date()): boolean {
  const { plan, betaStartedAt, trialEndsAt } = entitlement;
  return Boolean(
    plan === "TRIAL" &&
      betaStartedAt &&
      trialEndsAt &&
      betaStartedAt.getTime() <= now.getTime() &&
      trialEndsAt.getTime() > now.getTime(),
  );
}

export function isExpiredBeta(entitlement: BetaEntitlement, now = new Date()): boolean {
  const { plan, betaStartedAt, trialEndsAt } = entitlement;
  return Boolean(
    plan === "TRIAL" &&
      betaStartedAt &&
      trialEndsAt &&
      trialEndsAt.getTime() <= now.getTime(),
  );
}

/** Active invited betas receive the exact Starter capability/cap profile. */
export function effectivePlan(entitlement: BetaEntitlement, now = new Date()): PlanTier {
  return isActiveBeta(entitlement, now) ? "STARTER" : entitlement.plan;
}
