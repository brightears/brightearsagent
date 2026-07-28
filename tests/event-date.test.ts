import { describe, expect, it } from "vitest";
import { extractEventDate } from "@/lib/inbound/parsers/event-date";

// The model returns a date most of the time but not reliably — measured from
// 92% down to 44% on identical cases in one day. Below 50%, more than half of
// real inquiries arrive with no date, and a lead with no date cannot be checked
// against the calendar, so the reply cannot say "I'm free that night". This is
// the floor under that. `today` is injected so the tests do not rot.

const TODAY = new Date("2026-07-28T00:00:00Z");
const on = (s: string) => extractEventDate(s, TODAY);

describe("extractEventDate", () => {
  it("reads the ways people actually write a date", () => {
    expect(on("we're getting married on 6 November 2027")).toBe("2027-11-06");
    expect(on("the wedding is 6th Nov 2027")).toBe("2027-11-06");
    expect(on("November 6, 2027 at a rooftop venue")).toBe("2027-11-06");
    expect(on("Nov 6th 2027")).toBe("2027-11-06");
    expect(on("event date: 2027-11-06")).toBe("2027-11-06");
  });

  it("reads slashed dates as US month-first, matching the extractor's own rule", () => {
    expect(on("our wedding on 03/14/2027")).toBe("2027-03-14");
  });

  it("falls back to day-first when the first number cannot be a month", () => {
    // 14 is not a month, so this can only be 14 March — discarding it would
    // throw away a date the client plainly wrote.
    expect(on("our wedding on 14/03/2027")).toBe("2027-03-14");
  });

  it("refuses dates that are not real days", () => {
    // Matches the shape; new Date() would roll it to 1 October and the owner
    // would confirm a date nobody asked for.
    expect(on("the party is on 2027-09-31")).toBeUndefined();
    expect(on("30 February 2027")).toBeUndefined();
  });

  it("ignores the past, which is how it ignores dates mentioned in passing", () => {
    expect(on("we saw you play on 12 September 2024 and loved it")).toBeUndefined();
    expect(
      on("we saw you on 12 September 2024 — our wedding is 6 November 2027"),
    ).toBe("2027-11-06");
  });

  it("takes the first future date when several appear", () => {
    expect(on("either 6 November 2027 or 13 November 2027")).toBe("2027-11-06");
  });

  it("returns undefined rather than guessing", () => {
    expect(on("are you free in the spring?")).toBeUndefined();
    expect(on("call me on 081-234-5678")).toBeUndefined();
    expect(on("")).toBeUndefined();
  });

  it("does not mistake a phone number or an amount for a date", () => {
    expect(on("budget is 25000, call 02/12 ext 5")).toBeUndefined();
  });
});
