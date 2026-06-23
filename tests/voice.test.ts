import { describe, expect, it } from "vitest";
import { buildVoicePrompt, priceRange } from "@/lib/agent/voice";
import type { BusinessProfile, PackageInfo } from "@/lib/agent/types";

// A Thai DJ — the case that exposed the old hardcoded-USD bug in the drafter.
const base: BusinessProfile = {
  id: null,
  name: "Sapphire Sounds",
  ownerName: "Maya",
  performerKind: "DJ",
  country: "TH",
  currency: "THB",
};

const pkg: PackageInfo = {
  name: "Wedding set",
  description: "Four hours, open format",
  priceMin: 1_500_000, // ฿15,000
  priceMax: 2_000_000, // ฿20,000
  eventTypes: ["wedding"],
};

describe("priceRange", () => {
  it("formats in the artist's own currency, never USD", () => {
    const r = priceRange(pkg, "THB");
    expect(r).toMatch(/฿|THB/);
    expect(r).not.toContain("$");
  });

  it("falls back to the ISO code for an unknown currency instead of throwing", () => {
    expect(priceRange({ ...pkg, priceMax: null }, "ZZZ")).toContain("ZZZ");
  });
});

describe("buildVoicePrompt", () => {
  it("quotes packages in the business currency, not the old hardcoded USD", () => {
    const prompt = buildVoicePrompt(base, [pkg]);
    expect(prompt).toMatch(/฿|THB/);
    expect(prompt).not.toContain("$15,000"); // the old en-US USD bug
  });

  it("adds a SETUP & REQUIREMENTS block only when riderNotes is present", () => {
    expect(buildVoicePrompt(base, [])).not.toContain("SETUP & REQUIREMENTS");
    const withRider = buildVoicePrompt(
      { ...base, riderNotes: "I bring my own rig; just need two power outlets near the booth." },
      [],
    );
    expect(withRider).toContain("SETUP & REQUIREMENTS");
    expect(withRider).toContain("two power outlets");
  });

  it("keeps the white-label rule (never mention AI)", () => {
    expect(buildVoicePrompt(base, [pkg]).toLowerCase()).toContain("never mention ai");
  });
});
