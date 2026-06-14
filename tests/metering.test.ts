import { describe, expect, it } from "vitest";
import { PLAN_LEAD_CAPS, isUnsubscribed, monthStart } from "@/lib/billing/metering";

describe("metering", () => {
  it("plan caps match the founder-confirmed pricing", () => {
    expect(PLAN_LEAD_CAPS.STARTER).toBe(15);
    expect(PLAN_LEAD_CAPS.PRO).toBe(60);
    expect(PLAN_LEAD_CAPS.STUDIO).toBe(150);
    expect(PLAN_LEAD_CAPS.TRIAL).toBe(60); // unsubscribed state — agent paused via trialEndsAt-in-past, not this cap
  });

  it("monthStart is UTC month boundary", () => {
    const d = new Date("2026-06-15T22:00:00Z");
    expect(monthStart(d).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  describe("isUnsubscribed (no-free-trial gate)", () => {
    const now = new Date("2026-06-14T12:00:00Z");

    it("new tenant (TRIAL + trialEndsAt in the past) is unsubscribed → agent paused", () => {
      expect(isUnsubscribed("TRIAL", new Date(0), now)).toBe(true);
      expect(isUnsubscribed("TRIAL", new Date("2026-06-14T11:59:59Z"), now)).toBe(true);
    });

    it("a paid plan is never unsubscribed, regardless of trialEndsAt", () => {
      expect(isUnsubscribed("STARTER", new Date(0), now)).toBe(false);
      expect(isUnsubscribed("PRO", null, now)).toBe(false);
      expect(isUnsubscribed("STUDIO", new Date(0), now)).toBe(false);
    });

    it("TRIAL with no/future trialEndsAt is not treated as unsubscribed", () => {
      expect(isUnsubscribed("TRIAL", null, now)).toBe(false);
      expect(isUnsubscribed("TRIAL", new Date("2026-06-20T00:00:00Z"), now)).toBe(false);
    });
  });
});
