import { describe, expect, it } from "vitest";
import { checkAvailability, formatWindow } from "@/lib/agent/availability";

const noon = (d: string) => new Date(`${d}T12:00:00Z`);
const performers = [
  { id: "p1", name: "Jamie", active: true },
  { id: "p2", name: "Sam", active: true },
];
const solo = [performers[0]];

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

  it("TIMED (not conflict) for a solo op whose only booking that day is a window", () => {
    const gigs = [
      { date: noon("2026-10-17"), title: "Sing Sing", performerId: "p1", startTime: "19:00", endTime: "21:00" },
    ];
    expect(checkAvailability("2026-10-17", gigs, solo)).toEqual({
      state: "timed",
      busyWindows: ["7:00 PM–9:00 PM"],
    });
  });

  it("still a hard conflict when a same-day booking is all-day (no time)", () => {
    const gigs = [
      { date: noon("2026-10-17"), title: "Residency", performerId: "p1", startTime: "19:00", endTime: "21:00" },
      { date: noon("2026-10-17"), title: "Wedding", performerId: "p1" }, // all-day → conflict wins
    ];
    expect(checkAvailability("2026-10-17", gigs, solo).state).toBe("conflict");
  });

  it("TIMED when every performer is booked but all bookings are windows", () => {
    const gigs = [
      { date: noon("2026-10-17"), title: "A", performerId: "p1", startTime: "18:00", endTime: "20:00" },
      { date: noon("2026-10-17"), title: "B", performerId: "p2", startTime: "20:00", endTime: "22:00" },
    ];
    expect(checkAvailability("2026-10-17", gigs, performers).state).toBe("timed");
  });

  it("a free performer still wins (partial) even if the booked one is timed", () => {
    const gigs = [
      { date: noon("2026-10-17"), title: "A", performerId: "p1", startTime: "19:00", endTime: "21:00" },
    ];
    expect(checkAvailability("2026-10-17", gigs, performers)).toEqual({
      state: "partial",
      freePerformers: ["Sam"],
    });
  });
});

describe("formatWindow", () => {
  it("formats 24h times as a 12h window", () => {
    expect(formatWindow({ date: noon("2026-10-17"), title: "x", performerId: null, startTime: "19:00", endTime: "21:00" })).toBe("7:00 PM–9:00 PM");
    expect(formatWindow({ date: noon("2026-10-17"), title: "x", performerId: null, startTime: "09:30" })).toBe("from 9:30 AM");
    expect(formatWindow({ date: noon("2026-10-17"), title: "Gala", performerId: null })).toBe("Gala"); // all-day → title
  });
});
