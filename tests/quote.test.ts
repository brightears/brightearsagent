import { describe, it, expect } from "vitest";
import { computeQuote, quoteHeadline, type QuoteInput } from "@/lib/quote/compute";

const base: QuoteInput = {
  currency: "THB",
  feeFloor: 1_500_000, // ฿15,000
  feeSweetSpot: 2_000_000, // ฿20,000
  residencyRate: 800_000, // ฿8,000/night
  gigTypes: ["one-off", "residency"],
  packages: [
    { name: "Wedding package", description: "4 hours", priceMin: 2_500_000, priceMax: 3_000_000, eventTypes: ["wedding"] },
  ],
  eventType: "wedding",
};

describe("computeQuote", () => {
  it("uses a matching package as a firm quote (with range), clamped to the floor", () => {
    const q = computeQuote(base)!;
    expect(q.basis).toBe("package");
    expect(q.label).toBe("Wedding package");
    expect(q.minAmount).toBe(2_500_000);
    expect(q.maxAmount).toBe(3_000_000);
    expect(q.isEstimate).toBe(false);
  });

  it("NEVER quotes a package below the floor — clamps priceMin up", () => {
    const q = computeQuote({
      ...base,
      feeFloor: 2_800_000, // floor above the package min
      packages: [{ name: "Budget set", description: null, priceMin: 1_000_000, priceMax: 1_200_000, eventTypes: ["wedding"] }],
    })!;
    expect(q.minAmount).toBe(2_800_000); // clamped up to the floor
    expect(q.maxAmount).toBeNull(); // max (1.2M) was below the clamped min → dropped
  });

  it("treats a residency-phrased inquiry as a per-night residency quote", () => {
    const q = computeQuote({ ...base, eventType: "weekly residency" })!;
    expect(q.basis).toBe("residency");
    expect(q.perNight).toBe(true);
    expect(q.minAmount).toBe(800_000);
  });

  it("treats every inquiry as residency for a residency-only artist", () => {
    const q = computeQuote({ ...base, gigTypes: ["residency"], eventType: "private party" })!;
    expect(q.basis).toBe("residency");
  });

  it("falls back to a from/typically ESTIMATE when no package matches", () => {
    const q = computeQuote({ ...base, eventType: "corporate gala", gigTypes: ["one-off"] })!;
    expect(q.basis).toBe("estimate");
    expect(q.isEstimate).toBe(true);
    expect(q.minAmount).toBe(1_500_000); // the floor
    expect(q.typicalAmount).toBe(2_000_000); // the sweet spot
  });

  it("estimate omits the typical figure when the sweet spot isn't above the floor", () => {
    const q = computeQuote({ ...base, eventType: "gala", gigTypes: ["one-off"], feeSweetSpot: null })!;
    expect(q.typicalAmount).toBeNull();
  });

  it("returns null when there is nothing to quote from (no floor, no packages, no residency)", () => {
    const q = computeQuote({
      ...base,
      feeFloor: null,
      feeSweetSpot: null,
      residencyRate: null,
      packages: [],
      gigTypes: ["one-off"],
      eventType: "gala",
    });
    expect(q).toBeNull();
  });
});

describe("quoteHeadline", () => {
  it("renders firm, range, per-night and estimate forms in the artist's currency", () => {
    // amounts are cents → ฿25,000 etc.
    expect(quoteHeadline(computeQuote(base)!)).toBe("฿25,000–฿30,000");
    expect(quoteHeadline(computeQuote({ ...base, eventType: "weekly residency" })!)).toBe("฿8,000 per night");
    const est = quoteHeadline(computeQuote({ ...base, eventType: "gala", gigTypes: ["one-off"] })!);
    expect(est).toBe("From ฿15,000, typically around ฿20,000");
  });
});
