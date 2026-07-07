import { describe, expect, it } from "vitest";
import { PLAN_LEAD_CAPS, isAgentPaused, monthStart } from "@/lib/billing/metering";

describe("metering", () => {
  it("plan caps match the founder-confirmed pricing", () => {
    expect(PLAN_LEAD_CAPS.STARTER).toBe(15);
    expect(PLAN_LEAD_CAPS.PRO).toBe(60);
    expect(PLAN_LEAD_CAPS.STUDIO).toBe(150);
    expect(PLAN_LEAD_CAPS.TRIAL).toBe(0); // TRIAL = free/unsubscribed — fails closed (agent paused is the primary gate)
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

});
