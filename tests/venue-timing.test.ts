import { describe, expect, it } from "vitest";
import { computeTimingScore, TIMING_BANDS, type TimingInput } from "@/lib/venues/timing";
import type { ScorableSignal } from "@/lib/venues/score";

const NOW = new Date("2026-06-12T12:00:00Z");
const DAY_MS = 24 * 3600 * 1000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY_MS);

const sig = (type: ScorableSignal["type"], days: number): ScorableSignal => ({
  type,
  observedAt: daysAgo(days),
});

const input = (over: Partial<TimingInput>): TimingInput => ({
  temperature: "HOT",
  signals: [],
  entertainmentEvidence: [],
  ...over,
});

describe("computeTimingScore — HOT band (60-90 by signal freshness)", () => {
  it("a venue that opened this week scores the top of the band", () => {
    expect(computeTimingScore(input({ signals: [sig("NEW_OPENING", 3)] }), NOW)).toBe(90);
  });

  it("future-dated opening (opening soon) also maxes the band", () => {
    expect(computeTimingScore(input({ signals: [sig("OPENING_SOON", -20)] }), NOW)).toBe(90);
  });

  it("a stale opening signal decays toward the band floor, never below 60", () => {
    const fading = computeTimingScore(input({ signals: [sig("NEW_OPENING", 80)] }), NOW);
    expect(fading).toBeGreaterThanOrEqual(60);
    expect(fading).toBeLessThan(70);
    expect(computeTimingScore(input({ signals: [sig("NEW_OPENING", 200)] }), NOW)).toBe(60);
  });

  it("non-opening signals count at half heat", () => {
    const hiringOnly = computeTimingScore(input({ signals: [sig("HIRING", 3)] }), NOW);
    expect(hiringOnly).toBe(75); // 60 + 30 * 0.5
  });

  it("stays inside the band with no signals at all", () => {
    expect(computeTimingScore(input({}), NOW)).toBe(TIMING_BANDS.HOT.min);
  });
});

describe("computeTimingScore — WARM band (20-40)", () => {
  const warm = (over: Partial<TimingInput>) => input({ temperature: "WARM", ...over });

  it("base WARM venue sits at 30 — they buy, but no slot is visibly opening", () => {
    expect(
      computeTimingScore(warm({ signals: [sig("HOSTS_ENTERTAINMENT", 10)] }), NOW),
    ).toBe(30);
  });

  it("+5 for event-calendar evidence (EVENT_PROGRAM signal)", () => {
    expect(
      computeTimingScore(
        warm({ signals: [sig("HOSTS_ENTERTAINMENT", 10), sig("EVENT_PROGRAM", 10)] }),
        NOW,
      ),
    ).toBe(35);
  });

  it("+5 for calendar phrasing in the evidence text itself", () => {
    expect(
      computeTimingScore(
        warm({
          signals: [sig("HOSTS_ENTERTAINMENT", 10)],
          entertainmentEvidence: ["Runs DJ sets every Friday per its what's on page"],
        }),
        NOW,
      ),
    ).toBe(35);
  });

  it("+5 more when also hiring — caps at the band ceiling 40", () => {
    expect(
      computeTimingScore(
        warm({
          signals: [sig("EVENT_PROGRAM", 10), sig("HIRING", 5)],
        }),
        NOW,
      ),
    ).toBe(40);
  });

  it("never leaves the 20-40 band", () => {
    const score = computeTimingScore(warm({}), NOW);
    expect(score).toBeGreaterThanOrEqual(TIMING_BANDS.WARM.min);
    expect(score).toBeLessThanOrEqual(TIMING_BANDS.WARM.max);
  });
});

describe("computeTimingScore — SEED band (5-15)", () => {
  const seed = (over: Partial<TimingInput>) => input({ temperature: "SEED", ...over });

  it("a bare cold-file entry (no signals, no evidence) is the floor: 5", () => {
    expect(computeTimingScore(seed({}), NOW)).toBe(5);
  });

  it("a seed with evidence sits at 10", () => {
    expect(
      computeTimingScore(seed({ entertainmentEvidence: ["Hotel hosts weddings year-round"] }), NOW),
    ).toBe(10);
  });

  it("a named events contact (TEAM_CONTACT) lifts it to 15 — someone to plant with", () => {
    expect(computeTimingScore(seed({ signals: [sig("TEAM_CONTACT", 10)] }), NOW)).toBe(15);
  });
});
