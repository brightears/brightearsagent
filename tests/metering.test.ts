import { describe, expect, it } from "vitest";
import { PLAN_LEAD_CAPS, isAgentPaused, monthStart } from "@/lib/billing/metering";

describe("metering", () => {
  it("plan caps match the founder-confirmed pricing", () => {
    expect(PLAN_LEAD_CAPS.STARTER).toBe(15);
    expect(PLAN_LEAD_CAPS.PRO).toBe(60);
    expect(PLAN_LEAD_CAPS.STUDIO).toBe(150);
    expect(PLAN_LEAD_CAPS.TRIAL).toBe(0); // TRIAL = free/unsubscribed — fails closed (agent paused is the primary gate)
  });

  it("monthStart is UTC month boundary when no timezone is given", () => {
    const d = new Date("2026-06-15T22:00:00Z");
    expect(monthStart(d).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  describe("monthStart in the tenant timezone (lead-cap month boundary)", () => {
    it("is local midnight on the 1st for Bangkok (UTC+7)", () => {
      // Aug 1, 09:00 Bangkok — August starts at Jul 31 17:00 UTC.
      const d = new Date("2026-08-01T02:00:00Z");
      expect(monthStart(d, "Asia/Bangkok").toISOString()).toBe("2026-07-31T17:00:00.000Z");
    });

    it("counts a Bangkok tenant's Aug 1 00:00-07:00 local window to August, not July", () => {
      // Jul 31 20:00 UTC = Aug 1 03:00 Bangkok — already August locally.
      const d = new Date("2026-07-31T20:00:00Z");
      expect(monthStart(d, "Asia/Bangkok").toISOString()).toBe("2026-07-31T17:00:00.000Z");
      // The UTC boundary would still call this July — the exact bug.
      expect(monthStart(d).toISOString()).toBe("2026-07-01T00:00:00.000Z");
    });

    it("handles negative offsets: LA local Jul 31 late evening is still July", () => {
      // Aug 1, 05:00 UTC = Jul 31 22:00 in Los Angeles (UTC-7, DST).
      const d = new Date("2026-08-01T05:00:00Z");
      expect(monthStart(d, "America/Los_Angeles").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    });

    it("first day of the month resolves to its own local midnight", () => {
      const d = new Date("2026-08-01T10:00:00Z"); // Aug 1 17:00 Bangkok
      expect(monthStart(d, "Asia/Bangkok").toISOString()).toBe("2026-07-31T17:00:00.000Z");
    });
  });

  describe("isAgentPaused (subscription gate — no auto trial)", () => {
    it("an unsubscribed tenant (plan=TRIAL) is paused until they subscribe", () => {
      expect(isAgentPaused({ plan: "TRIAL" })).toBe(true);
    });

    it("a paid plan is never paused — subscribing switches the agent on", () => {
      expect(isAgentPaused({ plan: "STARTER" })).toBe(false);
      expect(isAgentPaused({ plan: "PRO" })).toBe(false);
      expect(isAgentPaused({ plan: "STUDIO" })).toBe(false);
    });

    it("an invited beta is active only inside its 30-day window", () => {
      const start = new Date("2026-08-21T00:00:00Z");
      const end = new Date("2026-09-20T00:00:00Z");
      const beta = { plan: "TRIAL" as const, betaStartedAt: start, trialEndsAt: end };
      expect(isAgentPaused(beta, start)).toBe(false);
      expect(isAgentPaused(beta, end)).toBe(true);
    });
  });

});
