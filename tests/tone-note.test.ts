import { describe, expect, it } from "vitest";
import { stripToneNote, toneNoteOf, withToneNote } from "@/lib/voice/tone-note";

// The onboarding wizard appends "\n\n[Tone: X]" to voiceSamples; the Control
// Room voice card strips it for display and re-attaches it on save so a manual
// edit never leaks the marker or drops the tone (review finding: voice-card.tsx).

const SAMPLES = "Hey! Thanks so much for reaching out.";
const WITH_NOTE = `${SAMPLES}\n\n[Tone: Fun & casual]`;

describe("stripToneNote", () => {
  it("removes the trailing tone marker", () => {
    expect(stripToneNote(WITH_NOTE)).toBe(SAMPLES);
  });
  it("leaves marker-free text untouched", () => {
    expect(stripToneNote(SAMPLES)).toBe(SAMPLES);
  });
  it("handles null/undefined", () => {
    expect(stripToneNote(null)).toBe("");
    expect(stripToneNote(undefined)).toBe("");
  });
  it("only strips a marker at the very end", () => {
    const mid = `before [Tone: x] after`;
    expect(stripToneNote(mid)).toBe(mid);
  });
});

describe("toneNoteOf", () => {
  it("extracts the tone string", () => {
    expect(toneNoteOf(WITH_NOTE)).toBe("Fun & casual");
  });
  it("returns null when there's no marker", () => {
    expect(toneNoteOf(SAMPLES)).toBeNull();
    expect(toneNoteOf(null)).toBeNull();
  });
});

describe("withToneNote", () => {
  it("re-attaches a tone to freshly-edited text", () => {
    expect(withToneNote(SAMPLES, "Fun & casual")).toBe(WITH_NOTE);
  });
  it("is a no-op when there is no tone", () => {
    expect(withToneNote(SAMPLES, null)).toBe(SAMPLES);
  });
  it("does not double-append when the text already carries a marker", () => {
    expect(withToneNote(WITH_NOTE, "Fun & casual")).toBe(WITH_NOTE);
  });
  it("the stored tone wins over a user-typed marker line (no override, no dup)", () => {
    // User types prose that happens to end like a marker; the real onboarding
    // tone must be preserved, not the fake one, and never duplicated.
    expect(withToneNote(`${SAMPLES}\n\n[Tone: Fake]`, "Fun & casual")).toBe(WITH_NOTE);
  });
  it("does not attach a tone to blank text", () => {
    expect(withToneNote("   ", "Fun & casual")).toBe("   ");
  });
  it("round-trips: strip then re-attach reproduces the original", () => {
    expect(withToneNote(stripToneNote(WITH_NOTE), toneNoteOf(WITH_NOTE))).toBe(WITH_NOTE);
  });
});
