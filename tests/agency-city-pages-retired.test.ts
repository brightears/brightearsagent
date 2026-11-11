import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { inquirySchema } from "@/lib/agency/inquiry-contract";
import { LANDING_PAGES } from "@/lib/agency/landing-pages";

// Owner decision, 11 Nov 2026: the roster is one catalogue and Bright Ears is
// based in Bangkok only, so the separate Bangkok and Pattaya pages are retired.
describe("retired city pages", () => {
  it("redirect permanently to /venues", async () => {
    const redirects = await nextConfig.redirects!();
    for (const city of ["bangkok", "pattaya"]) {
      expect(redirects).toContainEqual({ source: `/venues/${city}`, destination: "/venues", permanent: true });
    }
  });

  it("are no longer landing pages", () => {
    expect(Object.keys(LANDING_PAGES)).toEqual(["NEW_YEARS_EVE", "ACTS"]);
  });

  it("still accept enquiries sent with their old source values", () => {
    // Cached pages, old links and the intake worker may still carry these.
    const brief = { occasion: "A regular venue programme", venue: "Rooftop, Bangkok", date: "", time: "", guests: "", sound: "Warm & relaxed", details: "", name: "Fixture", email: "fixture@example.invalid" };
    for (const source of ["bangkok", "pattaya"]) {
      expect(inquirySchema.safeParse({ submissionKey: crypto.randomUUID(), locale: "en", source, brief }).success).toBe(true);
    }
  });
});
