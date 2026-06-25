import { describe, it, expect } from "vitest";
import { renderPressKitPdf, type PressKitData } from "@/lib/pdf/press-kit";

const full: PressKitData = {
  name: "DJ Midnight",
  ownerName: "Sam",
  performerKind: "DJ",
  headline: "Open-format DJ that keeps the floor full",
  bio: "Fifteen years behind the decks across the city — weddings, brand nights, residencies.",
  genres: ["open format", "house", "disco"],
  eventTypes: ["weddings", "corporate", "club nights"],
  serviceCities: ["Bangkok", "Phuket"],
  travelPolicy: "Within 100km included; beyond at cost.",
  notableVenues: ["Sing Sing Theater", "Tichuca"],
  reviewQuotes: ["Best decision of our wedding.", "The floor never emptied."],
  riderNotes: "I bring my own controller; venue provides 2 CDJs + a mixer and a booth monitor.",
  websiteUrl: "https://djmidnight.example",
  bookingLinkUrl: "https://book.djmidnight.example",
  socialLinks: ["https://instagram.com/djmidnight", "https://soundcloud.com/djmidnight"],
  videoLinks: ["https://youtube.com/watch?v=abc"],
  contactEmail: "hello@djmidnight.example",
  photoDataUris: [], // no photos in the test — must still render cleanly
};

describe("press kit PDF", () => {
  it("renders a full profile to a valid PDF buffer", async () => {
    const buf = await renderPressKitPdf(full);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders a near-empty profile without throwing (minimal data is valid)", async () => {
    const minimal: PressKitData = {
      ...full,
      headline: null, bio: null, genres: [], eventTypes: [], serviceCities: [],
      travelPolicy: null, notableVenues: [], reviewQuotes: [], riderNotes: null,
      websiteUrl: null, bookingLinkUrl: null, socialLinks: [], videoLinks: [],
      contactEmail: null,
    };
    const buf = await renderPressKitPdf(minimal);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
