import { describe, expect, it } from "vitest";
import { PLAN_LEAD_CAPS, monthStart } from "@/lib/billing/metering";

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
});
