import { describe, expect, it } from "vitest";
import { SKIP_REASONS, fitScoreTone, isSkipReason, signalAgeLabel } from "@/lib/venues/feed";

const NOW = new Date("2026-06-12T12:00:00Z");
const DAY = 24 * 3600 * 1000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);

describe("fitScoreTone", () => {
  it("maps the 3-step temperature at the documented boundaries", () => {
    expect(fitScoreTone(100)).toBe("hot");
    expect(fitScoreTone(70)).toBe("hot");
    expect(fitScoreTone(69)).toBe("warm");
    expect(fitScoreTone(40)).toBe("warm");
    expect(fitScoreTone(39)).toBe("cool");
    expect(fitScoreTone(0)).toBe("cool");
  });
});

describe("signalAgeLabel", () => {
  it("speaks human for today/yesterday, days after that", () => {
    expect(signalAgeLabel(NOW, NOW)).toBe("today");
    expect(signalAgeLabel(daysAgo(0.5), NOW)).toBe("today");
    expect(signalAgeLabel(daysAgo(1), NOW)).toBe("yesterday");
    expect(signalAgeLabel(daysAgo(8), NOW)).toBe("8 days ago");
  });
});

describe("isSkipReason", () => {
  it("accepts exactly the four one-tap reasons", () => {
    expect(Object.values(SKIP_REASONS)).toEqual([
      "Wrong vibe",
      "Too far",
      "Below my fee",
      "Not interested",
    ]);
    for (const key of Object.keys(SKIP_REASONS)) expect(isSkipReason(key)).toBe(true);
    expect(isSkipReason("wrong vibe")).toBe(false);
    expect(isSkipReason("")).toBe(false);
  });
});
