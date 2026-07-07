import { describe, expect, it } from "vitest";
import { getSetupStatus } from "@/lib/onboarding-status";

// Setup-complete must mirror what the redesigned wizard actually collects
// (profile essentials + voice) — never packages, which the wizard no longer
// creates and the Hunt never reads (audit 2026-07: the packages requirement
// left every new user with a permanent "Resume setup" banner).

const complete = {
  genres: ["house", "disco"],
  headline: "Open-format DJ for rooftops and weddings",
  feeFloor: 40000,
  voiceSamples: "Hey! Thanks so much for reaching out about your wedding...",
  voiceGreeting: null,
  voiceSignoff: null,
};

describe("getSetupStatus", () => {
  it("is complete with profile essentials + pasted samples", () => {
    const s = getSetupStatus(complete);
    expect(s).toEqual({ needsProfile: false, needsVoice: false, incomplete: false });
  });

  it("accepts the skip-for-now default voice (greeting/sign-off, no samples)", () => {
    const s = getSetupStatus({
      ...complete,
      voiceSamples: null,
      voiceGreeting: "Hi [name],",
      voiceSignoff: "Best, Sam",
    });
    expect(s.needsVoice).toBe(false);
    expect(s.incomplete).toBe(false);
  });

  it("needs profile while any essential is missing", () => {
    expect(getSetupStatus({ ...complete, genres: [] }).needsProfile).toBe(true);
    expect(getSetupStatus({ ...complete, headline: "  " }).needsProfile).toBe(true);
    expect(getSetupStatus({ ...complete, feeFloor: null }).needsProfile).toBe(true);
  });

  it("needs voice when neither samples nor structured signals exist", () => {
    const s = getSetupStatus({
      ...complete,
      voiceSamples: "   ",
      voiceGreeting: null,
      voiceSignoff: null,
    });
    expect(s.needsVoice).toBe(true);
    expect(s.incomplete).toBe(true);
  });

  it("never requires packages (the Hunt doesn't read them)", () => {
    // No package-related input exists in the signature at all — this test
    // documents the contract so a future refactor can't quietly re-add it.
    const s = getSetupStatus(complete);
    expect(Object.keys(s)).toEqual(["needsProfile", "needsVoice", "incomplete"]);
  });
});
