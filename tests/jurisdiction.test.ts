import { describe, expect, it } from "vitest";
import { jurisdictionFor, pitchFooter } from "@/lib/outreach/jurisdiction";

describe("jurisdictionFor", () => {
  it("standard-mode countries (identity + opt-out)", () => {
    for (const c of ["US", "GB", "TH", "NZ", "IE", "SG"]) {
      expect(jurisdictionFor(c).mode, c).toBe("STANDARD");
      expect(jurisdictionFor(c).note, c).toBe("");
    }
  });

  it("Australia is STANDARD but carries the inferred-consent note", () => {
    const au = jurisdictionFor("AU");
    expect(au.mode).toBe("STANDARD");
    expect(au.note).toMatch(/Australia/);
  });

  it("Canada is CONSENT (CASL) — handoff, never auto-send", () => {
    const ca = jurisdictionFor("CA");
    expect(ca.mode).toBe("CONSENT");
    expect(ca.note).toMatch(/can't auto-send/);
  });

  it("Germany and Austria are STRICT (UWG/TKG consent-first)", () => {
    expect(jurisdictionFor("DE").mode).toBe("STRICT");
    expect(jurisdictionFor("AT").mode).toBe("STRICT");
    expect(jurisdictionFor("DE").note).toMatch(/yourself/);
  });

  it("unknown countries fail CLOSED to CONSENT", () => {
    expect(jurisdictionFor("XX").mode).toBe("CONSENT");
    expect(jurisdictionFor("").mode).toBe("CONSENT");
  });

  it("input is case/whitespace tolerant", () => {
    expect(jurisdictionFor(" us ").mode).toBe("STANDARD");
    expect(jurisdictionFor("ca").mode).toBe("CONSENT");
  });
});

describe("pitchFooter", () => {
  const base = { businessName: "Sapphire Sounds", city: "Manchester", venueName: "The Vault" };

  it("STANDARD: identity line + personal opt-out sentence, no unsubscribe link", () => {
    const f = pitchFooter({ mode: "STANDARD", ...base });
    expect(f).toContain("Sapphire Sounds · Manchester");
    expect(f).toContain("If this isn't relevant for The Vault");
    expect(f).toContain("I won't write again");
    expect(f.toLowerCase()).not.toContain("unsubscribe");
    expect(f.toLowerCase()).not.toContain("http");
  });

  it("CONSENT/STRICT: still identity + a human no-follow-up promise", () => {
    for (const mode of ["CONSENT", "STRICT"] as const) {
      const f = pitchFooter({ mode, ...base });
      expect(f).toContain("Sapphire Sounds · Manchester");
      expect(f).toContain("The Vault");
      expect(f).toMatch(/last you'll hear/);
    }
  });

  it("omits the city separator when no city is known", () => {
    const f = pitchFooter({ mode: "STANDARD", ...base, city: "" });
    expect(f).toContain("Sapphire Sounds");
    expect(f).not.toContain("·");
  });
});
