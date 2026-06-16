import { describe, expect, it } from "vitest";
import { PLAN_LEAD_CAPS, isAgentPaused, trialDaysLeft, monthStart } from "@/lib/billing/metering";

describe("metering", () => {
  it("plan caps match the founder-confirmed pricing", () => {
    expect(PLAN_LEAD_CAPS.STARTER).toBe(15);
    expect(PLAN_LEAD_CAPS.PRO).toBe(60);
    expect(PLAN_LEAD_CAPS.STUDIO).toBe(150);
    expect(PLAN_LEAD_CAPS.TRIAL).toBe(60); // TRIAL = free/unsubscribed (agent paused); cap kept for reference
  });

  it("monthStart is UTC month boundary", () => {
    const d = new Date("2026-06-15T22:00:00Z");
    expect(monthStart(d).toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  describe("isAgentPaused (subscription gate — no auto trial)", () => {
    it("an unsubscribed tenant (plan=TRIAL) is paused until they subscribe", () => {
      expect(isAgentPaused("TRIAL")).toBe(true);
    });

    it("a paid plan is never paused — subscribing switches the agent on", () => {
      expect(isAgentPaused("STARTER")).toBe(false);
      expect(isAgentPaused("PRO")).toBe(false);
      expect(isAgentPaused("STUDIO")).toBe(false);
    });
  });

  describe("trialDaysLeft", () => {
    const now = new Date("2026-06-14T12:00:00Z");

    it("counts whole days remaining in an active trial (ceil)", () => {
      // ~13.5 days out → ceils to 14
      expect(trialDaysLeft("TRIAL", new Date("2026-06-28T00:00:00Z"), now)).toBe(14);
      // exactly 1 day out
      expect(trialDaysLeft("TRIAL", new Date("2026-06-15T12:00:00Z"), now)).toBe(1);
    });

    it("is 0 once the trial has ended", () => {
      expect(trialDaysLeft("TRIAL", new Date(0), now)).toBe(0);
      expect(trialDaysLeft("TRIAL", new Date("2026-06-14T11:59:59Z"), now)).toBe(0);
    });

    it("is 0 for paid plans or a missing trialEndsAt", () => {
      expect(trialDaysLeft("PRO", new Date("2026-06-28T00:00:00Z"), now)).toBe(0);
      expect(trialDaysLeft("TRIAL", null, now)).toBe(0);
    });
  });
});
