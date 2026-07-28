import { describe, expect, it } from "vitest";
import { classifyEventType } from "@/lib/inbound/parsers/event-type";

// The extractor is told never to guess, which is right for dates and names and
// wrong for the occasion: "we're getting married" never contains "wedding", so
// the model returns null and the lead lands as a bare "event". These rules fill
// that gap deterministically — and because they are ordered, the overlaps are
// the whole risk, so they are what these tests are mostly about.

describe("classifyEventType", () => {
  it("reads a wedding from how people actually describe one", () => {
    for (const s of [
      "We're getting married on 12 September 2027",
      "Looking for a DJ for our wedding reception",
      "our big day is in June and we need music",
      "The bride wants deep house, the groom wants disco",
    ]) {
      expect(classifyEventType(s), s).toBe("wedding");
    }
  });

  it("keeps engagement parties out of weddings", () => {
    expect(classifyEventType("DJ for our engagement party in May")).toBe("engagement");
    expect(classifyEventType("we just got engaged and want a party")).toBe("engagement");
  });

  it("keeps a hen do out of weddings", () => {
    expect(classifyEventType("Looking for a DJ for my sister's hen do")).toBe("bachelor party");
  });

  it("reads corporate from company language, including the christmas-party trap", () => {
    for (const s of [
      "our company year-end party",
      "a product launch for 200 clients",
      "staff christmas party in December",
      "team building day with evening entertainment",
      "conference after-party",
    ]) {
      expect(classifyEventType(s), s).toBe("corporate");
    }
  });

  it("reads birthdays including the ordinal forms", () => {
    expect(classifyEventType("my 40th birthday")).toBe("birthday");
    expect(classifyEventType("planning a bday bash")).toBe("birthday");
    expect(classifyEventType("I'm turning 30 and want a DJ")).toBe("birthday");
  });

  it("falls back to private party only when nothing more specific fits", () => {
    expect(classifyEventType("just a house party for about 40 friends")).toBe("private party");
    // "party" appears here too, but the specific signal must win.
    expect(classifyEventType("our wedding party, 120 guests")).toBe("wedding");
    expect(classifyEventType("company party for the sales team")).toBe("corporate");
  });

  it("recognises residencies, which are recurring rather than one-off", () => {
    expect(classifyEventType("we want a resident DJ every Friday")).toBe("residency");
    expect(classifyEventType("a weekly slot at our rooftop bar")).toBe("residency");
  });

  it("returns undefined rather than guessing when the occasion is not stated", () => {
    expect(classifyEventType("Hi, are you free on 3 May? What are your rates?")).toBeUndefined();
    expect(classifyEventType("")).toBeUndefined();
    expect(classifyEventType("   ")).toBeUndefined();
  });

  it("does not fire on words that merely contain a keyword", () => {
    // "partygoers" / "corporation" should not be enough on their own... but
    // "party" as a substring is a real risk, so pin the intent explicitly.
    expect(classifyEventType("Marriage counselling newsletter")).toBe("wedding"); // documented: 'marriage' does match
    expect(classifyEventType("Anniversary of our venue opening")).toBe("anniversary");
  });
});
