import { describe, it, expect } from "vitest";
import { computeQuote, quoteHeadline, titleCaseEvent, type QuoteInput } from "@/lib/quote/compute";

const base: QuoteInput = {
  currency: "THB",
  feeFloor: 1_500_000, // ฿15,000
  feeSweetSpot: 2_000_000, // ฿20,000
  residencyRate: 800_000, // ฿8,000/night
  packages: [
    { name: "Wedding package", description: "4 hours", priceMin: 2_500_000, priceMax: 3_000_000, eventTypes: ["wedding"] },
  ],
  eventType: "wedding",
};

describe("computeQuote — grounding & basis", () => {
  it("uses a matching package as a firm quote (with range), clamped to the floor", () => {
    const q = computeQuote(base)!;
    expect(q.basis).toBe("package");
    expect(q.label).toBe("Wedding package");
    expect(q.minAmount).toBe(2_500_000);
    expect(q.maxAmount).toBe(3_000_000);
    expect(q.isEstimate).toBe(false);
  });

  it("treats an EXPLICIT residency inquiry as a per-night residency quote", () => {
    const q = computeQuote({ ...base, eventType: "weekly residency" })!;
    expect(q.basis).toBe("residency");
    expect(q.perNight).toBe(true);
    expect(q.minAmount).toBe(800_000);
  });

  it("falls back to a from/typically ESTIMATE when no package matches", () => {
    const q = computeQuote({ ...base, eventType: "corporate gala" })!;
    expect(q.basis).toBe("estimate");
    expect(q.isEstimate).toBe(true);
    expect(q.minAmount).toBe(1_500_000);
    expect(q.typicalAmount).toBe(2_000_000);
  });

  it("estimate omits the typical figure when the sweet spot isn't above the floor", () => {
    const q = computeQuote({ ...base, eventType: "gala", feeSweetSpot: null })!;
    expect(q.typicalAmount).toBeNull();
  });

  it("returns null when there is nothing to quote from", () => {
    expect(
      computeQuote({ ...base, feeFloor: null, feeSweetSpot: null, residencyRate: null, packages: [], eventType: "gala" }),
    ).toBeNull();
  });
});

describe("computeQuote — floor guard (the whole point)", () => {
  it("NEVER quotes a package below the floor — clamps priceMin up, drops a sub-floor max", () => {
    const q = computeQuote({
      ...base,
      feeFloor: 2_800_000,
      packages: [{ name: "Budget set", description: null, priceMin: 1_000_000, priceMax: 1_200_000, eventTypes: ["wedding"] }],
    })!;
    expect(q.minAmount).toBe(2_800_000);
    expect(q.maxAmount).toBeNull();
  });
});

describe("computeQuote — residency false positives (the regressions the review caught)", () => {
  it("does NOT treat 'presidential' / 'residential' / 'monthly gala' as a residency", () => {
    for (const eventType of ["presidential inauguration gala", "residential estate party", "monthly company gala"]) {
      const q = computeQuote({ ...base, eventType, packages: [] })!;
      expect(q.basis, eventType).toBe("estimate"); // floor-guarded, not the per-night rate
      expect(q.minAmount, eventType).toBe(1_500_000);
    }
  });

  it("still detects genuine residency phrasing", () => {
    for (const eventType of ["weekly residency", "regular slot", "every Friday", "every month", "resident DJ"]) {
      expect(computeQuote({ ...base, eventType, packages: [] })!.basis, eventType).toBe("residency");
    }
  });
});

describe("computeQuote — package-first (residency must not shadow a real package)", () => {
  it("quotes a matching package, NOT the per-night rate, even with a residency rate set", () => {
    const q = computeQuote({
      ...base,
      eventType: "wedding",
      residencyRate: 800_000,
      packages: [{ name: "Wedding package", description: null, priceMin: 8_000_000, priceMax: null, eventTypes: ["wedding"] }],
    })!;
    expect(q.basis).toBe("package");
    expect(q.minAmount).toBe(8_000_000); // ฿80,000, not ฿8,000/night
  });
});

describe("computeQuote — package matching is word-based, not substring", () => {
  it("a 2-char fragment does not swallow an unrelated package", () => {
    const q = computeQuote({
      ...base,
      eventType: "al", // used to match 'gala' via substring
      feeFloor: 1_500_000,
      packages: [{ name: "Gala", description: null, priceMin: 5_000_000, priceMax: null, eventTypes: ["gala"] }],
    })!;
    expect(q.basis).toBe("estimate"); // no firm wrong-package match
  });

  it("a real shared word still matches", () => {
    const q = computeQuote({
      ...base,
      eventType: "gala dinner",
      packages: [{ name: "Gala", description: null, priceMin: 5_000_000, priceMax: null, eventTypes: ["gala"] }],
    })!;
    expect(q.basis).toBe("package");
  });
});

describe("computeQuote — positivity", () => {
  it("never produces a firm zero/negative quote (priceMin 0 + no floor → null)", () => {
    expect(
      computeQuote({
        ...base,
        feeFloor: null,
        feeSweetSpot: null,
        residencyRate: null,
        eventType: "wedding",
        packages: [{ name: "Free", description: null, priceMin: 0, priceMax: null, eventTypes: ["wedding"] }],
      }),
    ).toBeNull();
  });

  it("ignores a zero residency rate (falls through to the floor estimate)", () => {
    const q = computeQuote({ ...base, eventType: "weekly residency", residencyRate: 0, packages: [] })!;
    expect(q.basis).toBe("estimate");
  });
});

describe("titleCaseEvent", () => {
  it("capitalizes words without mangling apostrophes", () => {
    expect(titleCaseEvent("new year's eve")).toBe("New Year's Eve");
    expect(titleCaseEvent("CORPORATE gala")).toBe("Corporate Gala");
  });
});

describe("quoteHeadline", () => {
  it("renders firm, per-night and estimate forms in the artist's currency (amounts are cents)", () => {
    expect(quoteHeadline(computeQuote(base)!)).toBe("฿25,000–฿30,000");
    expect(quoteHeadline(computeQuote({ ...base, eventType: "weekly residency", packages: [] })!)).toBe("฿8,000 per night");
    expect(quoteHeadline(computeQuote({ ...base, eventType: "gala" })!)).toBe("From ฿15,000, typically around ฿20,000");
  });
});

describe("rate units (founder preview, July 2026)", () => {
  it("an hourly residency rate quotes per hour, never ambiguous", () => {
    const q = computeQuote({
      currency: "THB",
      feeFloor: 500000,
      feeSweetSpot: null,
      residencyRate: 150000,
      residencyRateUnit: "hour",
      packages: [],
      eventType: "weekly residency slot",
    });
    expect(q?.perHour).toBe(true);
    expect(q?.perNight).toBe(false);
    expect(q?.label).toBe("Residency (per hour)");
    expect(quoteHeadline(q!)).toContain("per hour");
  });

  it("one-off quotes carry the covered hours when set", () => {
    const q = computeQuote({
      currency: "THB",
      feeFloor: 500000,
      feeSweetSpot: null,
      residencyRate: null,
      oneOffHours: 4,
      packages: [],
      eventType: "wedding",
    });
    expect(q?.coversHours).toBe(4);
  });

  it("defaults stay per-night with no covered hours", () => {
    const q = computeQuote({
      currency: "THB",
      feeFloor: null,
      feeSweetSpot: null,
      residencyRate: 80000,
      packages: [],
      eventType: "residency",
    });
    expect(q?.perNight).toBe(true);
    expect(q?.perHour).toBe(false);
  });
});
