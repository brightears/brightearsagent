import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  EXCLUDED_COUNTRY_CODES,
  isAllowedCountry,
} from "@/lib/geo/countries";

// The shared country source (lib/geo/countries.ts) feeds every picker
// (onboarding, settings, travel windows) AND server-side validation. It must:
//   - be comprehensive (the whole ISO-3166-1 list, ~190+ sovereign states),
//   - already EXCLUDE the sanctioned set so no dropdown ever shows them,
//   - accept a normal country and reject sanctioned/garbage codes server-side.

const SANCTIONED = ["KP", "IR", "SY", "CU", "RU", "BY"] as const;

describe("COUNTRIES list", () => {
  it("is comprehensive (200+ entries)", () => {
    expect(COUNTRIES.length).toBeGreaterThan(200);
  });

  it("includes the common markets we operate in", () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    for (const c of ["US", "GB", "TH", "PT", "JP", "BR"]) {
      expect(codes.has(c), c).toBe(true);
    }
  });

  it("excludes the sanctioned set entirely", () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    for (const c of SANCTIONED) {
      expect(codes.has(c), c).toBe(false);
      expect(EXCLUDED_COUNTRY_CODES.has(c), c).toBe(true);
    }
  });

  it("is sorted alphabetically by name", () => {
    const names = COUNTRIES.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en"));
    expect(names).toEqual(sorted);
  });

  it("has no duplicate codes", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("isAllowedCountry", () => {
  it("accepts a normal country (case/whitespace tolerant)", () => {
    expect(isAllowedCountry("US")).toBe(true);
    expect(isAllowedCountry("th")).toBe(true);
    expect(isAllowedCountry(" PT ")).toBe(true);
  });

  it("rejects every sanctioned code", () => {
    for (const c of SANCTIONED) {
      expect(isAllowedCountry(c), c).toBe(false);
      expect(isAllowedCountry(c.toLowerCase()), c).toBe(false);
    }
  });

  it("rejects garbage / non-ISO-2 input", () => {
    for (const bad of ["XX", "ZZ", "USA", "", "1", "Portugal"]) {
      expect(isAllowedCountry(bad), bad).toBe(false);
    }
  });
});
