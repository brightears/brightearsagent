import { describe, expect, it, vi } from "vitest";
import {
  buildVenuePitchPrompt,
  buildVenuePitchSystem,
  formatTravelDateRange,
  type VenuePitchRequest,
} from "@/lib/agent/venue-pitch";
import { jurisdictionFor } from "@/lib/outreach/jurisdiction";

// Mock the LLM gateway so importing venue-pitch (which pulls lib/llm) is inert.
vi.mock("@/lib/llm", () => ({
  llmObject: vi.fn(),
  modelFor: vi.fn(() => "test/model"),
}));

const EPK = "https://brightears-app.onrender.com/epk/sapphire-sounds";

// A travel-window venue: artist is in Lisbon (PT) Aug 4-11 only.
const travelReq: VenuePitchRequest = {
  business: {
    id: null,
    name: "Sapphire Sounds",
    ownerName: "Maya Reyes",
    performerKind: "DJ",
    voiceSamples: null,
    headline: "Open-format DJ",
    bio: "Fifteen years behind the decks.",
    genres: ["house"],
    eventTypes: ["club nights"],
    serviceCities: ["Manchester"], // HOME base is Manchester, not Lisbon
    feeFloor: null,
    feeSweetSpot: null,
    reviewQuotes: [],
    notableVenues: [],
  },
  venue: {
    name: "Park Bar",
    city: "Lisbon",
    country: "PT", // the DESTINATION — drives jurisdiction
    kind: "BAR",
    temperature: "HOT",
    signals: ["Rooftop bar in Lisbon now booking summer DJs"],
    fitReasons: ["Open-format room"],
    travelWindow: { city: "Lisbon", dateRange: "August 4-11" },
  },
  epkUrl: EPK,
  language: "en",
};

describe("formatTravelDateRange (UTC date-only)", () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

  it("formats a same-month range as 'Month start-end'", () => {
    expect(formatTravelDateRange(day("2026-08-04"), day("2026-08-11"))).toBe("August 4-11");
  });

  it("spans months within a year", () => {
    expect(formatTravelDateRange(day("2026-08-28"), day("2026-09-02"))).toBe("August 28-September 2");
  });

  it("includes years when the range straddles a year boundary", () => {
    expect(formatTravelDateRange(day("2026-12-30"), day("2027-01-02"))).toBe(
      "December 30, 2026-January 2, 2027",
    );
  });

  it("collapses a single-day window", () => {
    expect(formatTravelDateRange(day("2026-08-04"), day("2026-08-04"))).toBe("August 4");
  });
});

describe("date-bounded travel pitch prompt", () => {
  it("states the artist is in town for the SPECIFIC window dates", () => {
    const system = buildVenuePitchSystem(travelReq);
    expect(system).toContain("August 4-11");
    expect(system).toContain("Lisbon");
    // The model is told to say "I'm in Lisbon August 4-11"-style.
    expect(system).toMatch(/I'm in Lisbon August 4-11/);
    const prompt = buildVenuePitchPrompt(travelReq);
    expect(prompt).toContain("TRAVEL WINDOW");
    expect(prompt).toContain("August 4-11");
  });

  it("forbids any open-ended / ongoing availability claim for the travel city", () => {
    const system = buildVenuePitchSystem(travelReq);
    expect(system).toMatch(/NEVER claim open-ended or ongoing availability/i);
    expect(system).toMatch(/do NOT live in Lisbon/i);
    // The grounding rule 2b still stands alongside the travel rule.
    expect(system).toMatch(/2b\. ONLY state facts/);
    expect(system).toMatch(/2c\. TRAVEL/);
  });

  it("a HOME-base venue gets NO travel framing (no window line, no travel rule)", () => {
    const homeReq: VenuePitchRequest = {
      ...travelReq,
      venue: { ...travelReq.venue, travelWindow: undefined },
    };
    const system = buildVenuePitchSystem(homeReq);
    const prompt = buildVenuePitchPrompt(homeReq);
    expect(system).not.toContain("2c. TRAVEL");
    expect(system).not.toMatch(/do NOT live in/i);
    expect(prompt).not.toContain("TRAVEL WINDOW");
  });

  it("jurisdiction follows the venue's (window's) country, not the artist's home", () => {
    // Home is GB-ish (Manchester) but the venue/window country is PT — and the
    // pitch jurisdiction is resolved from venue.country (the action layer).
    expect(jurisdictionFor(travelReq.venue.country).mode).toBe(
      jurisdictionFor("PT").mode,
    );
    // PT isn't in the STANDARD allow-list → fail-closed CONSENT (copy-and-send),
    // which is exactly the destination-jurisdiction behavior Travel Mode needs.
    expect(jurisdictionFor("PT").mode).toBe("CONSENT");
  });
});
