import { describe, expect, it } from "vitest";
import {
  MIN_PITCH_PHOTOS,
  profileStrength,
  type ProfileCounts,
  type ProfileFields,
} from "@/lib/profile/strength";

const empty: ProfileFields = {
  genres: [],
  eventTypes: [],
  serviceCities: [],
  travelPolicy: null,
  feeFloor: null,
  feeSweetSpot: null,
  insured: false,
  headline: null,
  bio: null,
  videoLinks: [],
  photoUrls: [],
  reviewQuotes: [],
  notableVenues: [],
};

const full: ProfileFields = {
  genres: ["house", "disco", "open format"],
  eventTypes: ["wedding", "corporate"],
  serviceCities: ["Austin", "San Antonio"],
  travelPolicy: "Within 100 miles included",
  feeFloor: 120000,
  feeSweetSpot: 180000,
  insured: true,
  headline: "Open-format DJ for rooms that want a full dance floor",
  bio: "Twelve years behind the decks across Texas. We read the room, not a playlist — from cocktail-hour soul to a peak-time floor.",
  videoLinks: ["https://www.youtube.com/watch?v=abc123"],
  photoUrls: ["https://x.test/1.jpg", "https://x.test/2.jpg", "https://x.test/3.jpg"],
  reviewQuotes: ["Best decision of our wedding."],
  notableVenues: ["The Driskill", "Hotel Van Zandt"],
};

const noCounts: ProfileCounts = { activePackages: 0, gigs: 0 };
const fullCounts: ProfileCounts = { activePackages: 2, gigs: 5 };

describe("profileStrength", () => {
  it("empty profile: 0%, no license, every gap listed", () => {
    const r = profileStrength(empty, noCounts);
    expect(r.percent).toBe(0);
    expect(r.canPitch).toBe(false);
    expect(r.missing.length).toBe(15);
    // Highest-priority ammunition first.
    expect(r.missing[0]).toMatch(/video/i);
  });

  it("full profile: 100%, license active, nothing missing", () => {
    const r = profileStrength(full, fullCounts);
    expect(r.percent).toBe(100);
    expect(r.canPitch).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("partial profile: percent between, license withheld, gaps in priority order", () => {
    const partial: ProfileFields = {
      ...empty,
      headline: "DJ for weddings",
      bio: "A bio.",
      genres: ["house"],
      photoUrls: ["https://x.test/1.jpg"],
    };
    const r = profileStrength(partial, { activePackages: 1, gigs: 0 });
    expect(r.percent).toBeGreaterThan(0);
    expect(r.percent).toBeLessThan(100);
    expect(r.canPitch).toBe(false);
    // Missing list keeps priority order: video before photos before cities.
    const video = r.missing.findIndex((m) => /video/i.test(m));
    const cities = r.missing.findIndex((m) => /cities/i.test(m));
    expect(video).toBeGreaterThanOrEqual(0);
    expect(cities).toBeGreaterThan(video);
  });

  it("photo partial credit moves the meter but not the license", () => {
    const two = profileStrength({ ...empty, photoUrls: ["a", "b"] }, noCounts);
    const three = profileStrength({ ...empty, photoUrls: ["a", "b", "c"] }, noCounts);
    expect(two.percent).toBeGreaterThan(0);
    expect(three.percent).toBeGreaterThan(two.percent);
    expect(two.canPitch).toBe(false);
    expect(two.missing.some((m) => m.includes(String(MIN_PITCH_PHOTOS)))).toBe(true);
    expect(three.missing.some((m) => /photo/i.test(m))).toBe(false);
  });

  it("license threshold edges: exactly the requirements flips canPitch true", () => {
    const justEnough: ProfileFields = {
      ...empty,
      videoLinks: ["https://vimeo.com/123"],
      photoUrls: ["a", "b", "c"], // exactly MIN_PITCH_PHOTOS
      bio: "Short but present.",
      headline: "Headline",
      genres: ["funk"],
      serviceCities: ["Austin"],
      feeFloor: 50000,
    };
    const r = profileStrength(justEnough, { activePackages: 1, gigs: 1 });
    expect(r.canPitch).toBe(true);
    expect(r.percent).toBeLessThan(100); // nice-to-haves still missing

    // Remove any single license requirement → license withheld.
    expect(profileStrength({ ...justEnough, videoLinks: [] }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, photoUrls: ["a", "b"] }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, bio: "  " }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, headline: null }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, genres: [] }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, serviceCities: [] }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, feeFloor: null }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength(justEnough, { activePackages: 0, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength(justEnough, { activePackages: 1, gigs: 0 }).canPitch).toBe(false);
  });

  it("feeFloor of 0 cents counts as set (explicit, if odd)", () => {
    const r = profileStrength({ ...empty, feeFloor: 0 }, noCounts);
    expect(r.missing.some((m) => /fee floor/i.test(m))).toBe(false);
  });
});
