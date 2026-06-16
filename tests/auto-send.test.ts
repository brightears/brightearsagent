import { describe, expect, it } from "vitest";
import {
  canAutoSend,
  autoSendEligibleSources,
  AUTO_SEND_INELIGIBLE_SOURCES,
} from "@/lib/inbound/auto-send";
import { PLAN_FEATURES, planFeatures } from "@/lib/billing/plan-features";
import type { LeadSource, PlanTier } from "@/app/generated/prisma/enums";

const ALL_SOURCES: LeadSource[] = [
  "WEBSITE_FORM",
  "PLAIN_EMAIL",
  "THE_KNOT",
  "WEDDINGWIRE",
  "BARK",
  "GIGSALAD",
  "THUMBTACK",
  "OTHER",
];

describe("plan-features (single source of truth)", () => {
  it("Starter cannot auto-send; Pro/Studio/Trial can", () => {
    expect(planFeatures("STARTER").autoSend).toBe(false);
    expect(planFeatures("PRO").autoSend).toBe(true);
    expect(planFeatures("STUDIO").autoSend).toBe(true);
    expect(planFeatures("TRIAL").autoSend).toBe(true); // trial = full Pro
  });
  it("lead caps match the metering contract", () => {
    expect(PLAN_FEATURES.STARTER.leadCap).toBe(15);
    expect(PLAN_FEATURES.PRO.leadCap).toBe(60);
    expect(PLAN_FEATURES.STUDIO.leadCap).toBe(150);
    expect(PLAN_FEATURES.TRIAL.leadCap).toBe(60);
  });
  it("coverage (home city cap) climbs with the tier", () => {
    expect(PLAN_FEATURES.STARTER.homeCityCap).toBe(1);
    expect(PLAN_FEATURES.PRO.homeCityCap).toBeGreaterThan(PLAN_FEATURES.STARTER.homeCityCap);
    expect(PLAN_FEATURES.STUDIO.homeCityCap).toBeGreaterThan(PLAN_FEATURES.PRO.homeCityCap);
  });
});

describe("autoSendEligibleSources", () => {
  it("offers every source except the ToS-ineligible ones (GigSalad)", () => {
    const eligible = autoSendEligibleSources(ALL_SOURCES);
    expect(eligible).not.toContain("GIGSALAD");
    expect(eligible).toContain("THE_KNOT");
    expect(eligible).toContain("WEBSITE_FORM");
    expect(AUTO_SEND_INELIGIBLE_SOURCES).toContain("GIGSALAD");
  });
});

describe("canAutoSend", () => {
  it("Starter never auto-sends, even from a 'trusted' source", () => {
    expect(canAutoSend("STARTER", ["THE_KNOT"], "THE_KNOT")).toBe(false);
  });

  it("Pro auto-sends only from a source the owner trusts", () => {
    expect(canAutoSend("PRO", ["THE_KNOT"], "THE_KNOT")).toBe(true);
    expect(canAutoSend("PRO", ["THE_KNOT"], "BARK")).toBe(false); // not trusted
    expect(canAutoSend("PRO", [], "THE_KNOT")).toBe(false); // nothing trusted yet
  });

  it("never auto-sends GigSalad, even on Studio with it 'trusted' (ToS backstop)", () => {
    expect(canAutoSend("STUDIO", ["GIGSALAD"], "GIGSALAD")).toBe(false);
    expect(canAutoSend("PRO", ["GIGSALAD"], "GIGSALAD")).toBe(false);
  });

  it("Studio and Trial behave like Pro for auto-send", () => {
    expect(canAutoSend("STUDIO", ["WEBSITE_FORM"], "WEBSITE_FORM")).toBe(true);
    expect(canAutoSend("TRIAL", ["WEBSITE_FORM"], "WEBSITE_FORM")).toBe(true);
  });

  it("default (no trusted sources) means everything waits for approval on every plan", () => {
    const plans: PlanTier[] = ["STARTER", "PRO", "STUDIO", "TRIAL"];
    for (const plan of plans) {
      for (const source of ALL_SOURCES) {
        expect(canAutoSend(plan, [], source)).toBe(false);
      }
    }
  });
});
