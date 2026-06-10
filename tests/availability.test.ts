import { describe, expect, it } from "vitest";
import { checkAvailability } from "@/lib/agent/availability";

const noon = (d: string) => new Date(`${d}T12:00:00Z`);
const performers = [
  { id: "p1", name: "Jamie", active: true },
  { id: "p2", name: "Sam", active: true },
];

describe("checkAvailability", () => {
  it("free when no gigs that day", () => {
    expect(checkAvailability("2026-10-17", [], performers)).toEqual({ state: "free" });
  });

  it("unknown without a date", () => {
    expect(checkAvailability(null, [], performers)).toEqual({ state: "unknown" });
  });

  it("partial when one of two performers is booked", () => {
    const gigs = [{ date: noon("2026-10-17"), title: "Miller wedding", performerId: "p1" }];
    expect(checkAvailability("2026-10-17", gigs, performers)).toEqual({
      state: "partial",
      freePerformers: ["Sam"],
    });
  });

  it("conflict when all performers are booked", () => {
    const gigs = [
      { date: noon("2026-10-17"), title: "A", performerId: "p1" },
      { date: noon("2026-10-17"), title: "B", performerId: "p2" },
    ];
    expect(checkAvailability("2026-10-17", gigs, performers).state).toBe("conflict");
  });

  it("conflict for solo op with any gig", () => {
    const gigs = [{ date: noon("2026-10-17"), title: "A", performerId: "p1" }];
    expect(checkAvailability("2026-10-17", gigs, [performers[0]]).state).toBe("conflict");
  });

  it("conflict when an unassigned gig blocks the business", () => {
    const gigs = [{ date: noon("2026-10-17"), title: "A", performerId: null }];
    expect(checkAvailability("2026-10-17", gigs, performers).state).toBe("conflict");
  });

  it("ignores gigs on other days", () => {
    const gigs = [{ date: noon("2026-10-18"), title: "A", performerId: "p1" }];
    expect(checkAvailability("2026-10-17", gigs, performers)).toEqual({ state: "free" });
  });
});
