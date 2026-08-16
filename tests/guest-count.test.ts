import { describe, expect, it } from "vitest";
import { extractGuestCount } from "@/lib/inbound/parsers/guest-count";

// Guest count picks the package and shapes the quote, so a miss costs a
// round-trip on nearly every inquiry. But a wrong one is worse than none — the
// owner would quote against it — so these tests are mostly about the numbers
// that must NOT be mistaken for a headcount.

describe("extractGuestCount", () => {
  it("reads the usual phrasings", () => {
    expect(extractGuestCount("around 140 guests")).toBe(140);
    expect(extractGuestCount("about 110 people")).toBe(110);
    expect(extractGuestCount("150 pax")).toBe(150);
    expect(extractGuestCount("80+ guests expected")).toBe(80);
    expect(extractGuestCount("Guests: 90")).toBe(90);
    expect(extractGuestCount("a party of 60")).toBe(60);
  });

  it("ignores the other numbers an inquiry is full of", () => {
    expect(extractGuestCount("we'd need you from 8pm until 1am")).toBeUndefined();
    expect(extractGuestCount("our budget is around 25000 baht")).toBeUndefined();
    expect(extractGuestCount("the wedding is on 6 November 2027")).toBeUndefined();
    expect(extractGuestCount("call me on 081-234-5678")).toBeUndefined();
  });

  it("still finds the headcount in a full message", () => {
    expect(
      extractGuestCount(
        "We're getting married on 6 November 2027 at a rooftop venue, around 110 guests. " +
          "We'd love a DJ from 8pm until about 1am. Budget roughly 30000.",
      ),
    ).toBe(110);
  });

  it("does not bind an ISO date's day across a newline to a Guests label", () => {
    expect(extractGuestCount("Event date: 2027-09-12\nGuests: 120")).toBe(120);
  });

  it("rejects counts outside anything this product would book", () => {
    expect(extractGuestCount("a party of 2")).toBeUndefined();
    expect(extractGuestCount("40000 people at the stadium")).toBeUndefined();
  });

  it("returns undefined rather than guessing", () => {
    expect(extractGuestCount("a small intimate gathering")).toBeUndefined();
    expect(extractGuestCount("")).toBeUndefined();
  });
});
