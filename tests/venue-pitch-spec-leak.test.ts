import { describe, expect, it } from "vitest";
import { detectSpecLeak, stripEchoedSubject, normalizeVenuePitch } from "@/lib/agent/venue-pitch";

// LIVE INCIDENT 2026-07-30. The "Send test email" button calls the real
// generateVenuePitch, and the email that arrived in the founder's inbox
// contained the model's own brief instead of a pitch. Auto-send fires on
// trusted sources behind a 15-minute buffer, so copy like this can reach a
// venue with nobody having read it — from the artist's own Gmail.
//
// The root cause was one character class: the strip was
//   /^subject:[^\n]*\n+/i
// which REQUIRES a trailing newline. The model returned everything on a single
// line, so nothing was stripped at all.
const DELIVERED_BODY =
  "Subject: Your new rooftop's soundtrack (5 words, no exclamation, specific to venue: " +
  "new rooftop bar booking entertainment. Body: Heard you're opening a new rooftop bar in " +
  "Bangkok and are now booking entertainment. I'm Norbert, a DJ performing as BeNorBe, with " +
  "over 20 years of experience playing venues like Escape Bangkok, Tribe Bangkok and Nobu " +
  "Bangkok. Word count: ~100. No prices, no exclamation marks, no invented details, one " +
  "concrete value line (local venues played), link exactly once, low-friction CTA, sign-off " +
  "with first name and act name.";

// A real pitch, in the product's actual voice. Nothing here may ever trip the
// guard — a false positive burns a regeneration and can refuse the pitch.
const CLEAN_BODY = `Heard you're opening the rooftop in Thonglor next month and booking entertainment.

I'm Norbert — I play as BeNorBe, twenty years across rooms like Escape and Tribe. For a
sunset-to-late rooftop I'd keep it deep and melodic early, then lift it once the room fills,
which is what kept the Friday crowd at Tribe staying for another drink.

Here's a one-page look at what I do: https://brightears.io/epk/norbert

Shall I hold a date?

Norbert · BeNorBe`;

describe("detectSpecLeak", () => {
  it("catches the rubric that actually shipped to a venue", () => {
    const leak = detectSpecLeak({ subject: "Your new rooftop's soundtrack", body: DELIVERED_BODY });
    expect(leak).not.toBeNull();
  });

  it("does not fire on a real pitch", () => {
    expect(detectSpecLeak({ subject: "DJ for your rooftop opening?", body: CLEAN_BODY })).toBeNull();
  });

  it("catches each rubric token on its own", () => {
    const tokens = [
      "Word count: ~100 words for this one.",
      "No exclamation marks anywhere.",
      "End with one low-friction call to action.",
      "Include exactly one concrete value line.",
      "Remember to link exactly once as proof.",
      "No invented details about the room.",
      "Sign-off with first name and act name.",
      "Body: here is the actual email.",
      "Subject line should be 7 words or fewer.",
      "Keep it specific to this venue.",
    ];
    for (const t of tokens) {
      expect(detectSpecLeak({ subject: "Rooftop soundtrack", body: t }), t).not.toBeNull();
    }
  });

  it("catches a leak in the SUBJECT too, not only the body", () => {
    expect(detectSpecLeak({ subject: "Rooftop soundtrack (5 words)", body: CLEAN_BODY })).not.toBeNull();
  });

  it("tolerates a bare echoed Subject: line — that is repaired, not a failure", () => {
    // This shape has been silently repaired for months. Treating it as a hard
    // leak would start refusing pitches that were previously fine.
    const body = `Subject: Rooftop soundtrack\n\n${CLEAN_BODY}`;
    expect(detectSpecLeak({ subject: "Rooftop soundtrack", body })).toBeNull();
  });
});

describe("stripEchoedSubject", () => {
  it("strips the single-line Subject:...Body: shape the old guard missed", () => {
    const out = stripEchoedSubject(DELIVERED_BODY);
    expect(out.startsWith("Heard you're opening")).toBe(true);
    expect(out.toLowerCase()).not.toContain("subject:");
  });

  it("still strips the newline-delimited shape it was written for", () => {
    expect(stripEchoedSubject("Subject: Rooftop soundtrack\n\nHeard you're opening...")).toBe(
      "Heard you're opening...",
    );
  });

  it("leaves a clean body untouched", () => {
    expect(stripEchoedSubject(CLEAN_BODY)).toBe(CLEAN_BODY.trim());
  });

  it("NEVER returns empty, even when the body is nothing but a label", () => {
    // body.min(1) is the only schema guard, so an emptied body would send a
    // blank email — worse than the label we were trying to remove.
    expect(stripEchoedSubject("Subject: Rooftop soundtrack")).not.toBe("");
    expect(stripEchoedSubject("Subject: Rooftop\n\n")).not.toBe("");
    expect(stripEchoedSubject("Subject: a Body: ")).not.toBe("");
  });
});

describe("normalizeVenuePitch uses the shared strip", () => {
  const req = {
    business: { id: "b1", name: "BeNorBe" },
    venue: { name: "The Sample Rooftop" },
    epkUrl: "https://brightears.io/epk/norbert",
  } as unknown as Parameters<typeof normalizeVenuePitch>[0];

  it("removes the one-line label shape end to end", () => {
    const out = normalizeVenuePitch(req, {
      subject: "Your new rooftop's soundtrack",
      body: DELIVERED_BODY,
    });
    expect(out.body.toLowerCase()).not.toContain("subject:");
    expect(out.body.toLowerCase()).not.toContain("body:");
  });
});
