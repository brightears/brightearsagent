import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { triageHeuristics } from "@/lib/inbound/triage";
import { extractSlug } from "@/lib/inbound/pipeline";
import type { InboundEmail } from "@/lib/inbound/types";

function fixture(name: string): InboundEmail {
  return JSON.parse(
    readFileSync(join(__dirname, "..", "fixtures", "inbound", "generic", name), "utf8"),
  );
}

describe("triage heuristics", () => {
  it("flags the overpayment/wire-back scam", () => {
    const result = triageHeuristics(fixture("scam-overpayment.json"));
    expect(result.spamScore).toBeGreaterThanOrEqual(0.8);
    expect(result.reason).toMatch(/overpayment/i);
  });

  it("does not flag a genuine contact-form lead", () => {
    const result = triageHeuristics(fixture("contact-form-wedding.json"));
    expect(result.spamScore).toBeLessThan(0.5);
  });

  it("does not flag a terse price shopper — terse is not spam", () => {
    const result = triageHeuristics(fixture("terse-price-shopper.json"));
    expect(result.spamScore).toBeLessThan(0.5);
  });
});

describe("tenant slug extraction", () => {
  it("extracts the slug from a parse address", () => {
    expect(extractSlug("leads@demo-dj-co.in.brightears.io")).toBe("demo-dj-co");
  });
  it("extracts from display-name and list forms", () => {
    expect(extractSlug("Demo DJ Co <leads@demo-dj-co.in.brightears.io>")).toBe("demo-dj-co");
    expect(extractSlug("a@b.test, leads@demo-dj-co.in.brightears.io")).toBe("demo-dj-co");
  });
  it("returns null for unrelated addresses", () => {
    expect(extractSlug("owner@demodjco.test")).toBeNull();
  });
  it("rejects local parts that merely END in 'leads' (anchoring)", () => {
    expect(extractSlug("djleads@demo-dj-co.in.brightears.io")).toBeNull();
    expect(extractSlug("myleads@demo-dj-co.in.brightears.io")).toBeNull();
  });
});
