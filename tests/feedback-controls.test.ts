import { describe, expect, it } from "vitest";
import {
  appendVoiceExample,
  isDraftRejectionReason,
  isVenuePitchDiscardReason,
} from "@/lib/feedback/owner-controls";

describe("owner feedback controls", () => {
  it("accepts only the finite rejection and discard reason codes", () => {
    expect(isDraftRejectionReason("WRONG_TONE")).toBe(true);
    expect(isDraftRejectionReason("other words")).toBe(false);
    expect(isDraftRejectionReason("toString")).toBe(false);
    expect(isVenuePitchDiscardReason("WRONG_APPROACH")).toBe(true);
    expect(isVenuePitchDiscardReason("WRONG_VIBE")).toBe(false);
    expect(isVenuePitchDiscardReason("constructor")).toBe(false);
  });

  it("appends an explicitly saved edit while preserving the tone marker", () => {
    const result = appendVoiceExample("Hey there\n\n[Tone: Direct & warm]", {
      kind: "reply",
      subject: "Re: Your party",
      body: "Hi Kim — yes, that date works for me.",
    });

    expect(result).toContain("Hey there\n\n---\nSaved reply example");
    expect(result).toContain("Subject: Re: Your party");
    expect(result).toMatch(/\[Tone: Direct & warm\]$/);
  });

  it("bounds individual examples and the total voice prompt", () => {
    const result = appendVoiceExample(`${"A".repeat(15_000)}\n\n[Tone: Direct]`, {
      kind: "venue pitch",
      subject: "A useful introduction",
      body: "B".repeat(20_000),
    });

    expect(result?.length).toBeLessThanOrEqual(16_000);
    expect(result).toContain("Saved venue pitch example");
  });

  it("does not destroy existing samples when no useful room remains", () => {
    const current = "A".repeat(15_950);
    expect(
      appendVoiceExample(current, {
        kind: "reply",
        subject: "Hello",
        body: "A real edit",
      }),
    ).toBe(current);
  });
});
