import { describe, expect, it } from "vitest";
import {
  BETA_DURATION_DAYS,
  betaInviteEmails,
  betaWindowForInvite,
  effectivePlan,
  isActiveBeta,
  isBetaInviteEmail,
  isExpiredBeta,
} from "@/lib/billing/beta";

const START = new Date("2026-08-21T06:00:00.000Z");

describe("invited beta entitlement", () => {
  it("normalizes and de-duplicates an exact email allowlist", () => {
    const raw = " Artist@example.com,second@example.com, artist@example.com, ";
    expect(betaInviteEmails(raw)).toEqual(["artist@example.com", "second@example.com"]);
    expect(isBetaInviteEmail("ARTIST@example.com", raw)).toBe(true);
    expect(isBetaInviteEmail("artist+alias@example.com", raw)).toBe(false);
  });

  it("creates exactly one 30-day window only for an approved email", () => {
    const window = betaWindowForInvite("artist@example.com", "artist@example.com", START);
    expect(window?.betaStartedAt).toEqual(START);
    expect(window?.trialEndsAt.getTime()).toBe(
      START.getTime() + BETA_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );
    expect(betaWindowForInvite("stranger@example.com", "artist@example.com", START)).toBeNull();
  });

  it("maps an active window to Starter and expires at the exact end timestamp", () => {
    const window = betaWindowForInvite("artist@example.com", "artist@example.com", START)!;
    const entitlement = { plan: "TRIAL" as const, ...window };
    const justBeforeEnd = new Date(window.trialEndsAt.getTime() - 1);

    expect(isActiveBeta(entitlement, START)).toBe(true);
    expect(effectivePlan(entitlement, justBeforeEnd)).toBe("STARTER");
    expect(isActiveBeta(entitlement, window.trialEndsAt)).toBe(false);
    expect(isExpiredBeta(entitlement, window.trialEndsAt)).toBe(true);
    expect(effectivePlan(entitlement, window.trialEndsAt)).toBe("TRIAL");
  });

  it("fails closed when either server-authored timestamp is missing", () => {
    const end = new Date(START.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(isActiveBeta({ plan: "TRIAL", trialEndsAt: end }, START)).toBe(false);
    expect(isActiveBeta({ plan: "TRIAL", betaStartedAt: START }, START)).toBe(false);
    expect(isActiveBeta({ plan: "STARTER", betaStartedAt: START, trialEndsAt: end }, START)).toBe(false);
  });
});
