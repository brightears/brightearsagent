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
  headline: null,
  bio: null,
  videoLinks: [],
  photoUrls: [],
  reviewQuotes: [],
  notableVenues: [],
};

const full: ProfileFields = {
  postalAddress: "123 Congress Ave, Austin, TX 78701, USA",
  genres: ["house", "disco", "open format"],
  eventTypes: ["wedding", "corporate"],
  serviceCities: ["Austin", "San Antonio"],
  travelPolicy: "Within 100 miles included",
  feeFloor: 120000,
  feeSweetSpot: 180000,
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
    expect(r.missing[0]).toMatch(/photo/i);
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
    };
    const r = profileStrength(partial, { activePackages: 1, gigs: 0 });
    expect(r.percent).toBeGreaterThan(0);
    expect(r.percent).toBeLessThan(100);
    expect(r.canPitch).toBe(false);
    // Missing list keeps priority order: photos before cities.
    const photos = r.missing.findIndex((m) => /photo/i.test(m));
    const cities = r.missing.findIndex((m) => /cities/i.test(m));
    expect(photos).toBeGreaterThanOrEqual(0);
    expect(cities).toBeGreaterThan(photos);
  });

  it("one photo clears the pitch gate while more photos improve completeness", () => {
    const none = profileStrength(empty, noCounts);
    const one = profileStrength({ ...empty, photoUrls: ["a"] }, noCounts);
    const three = profileStrength({ ...empty, photoUrls: ["a", "b", "c"] }, noCounts);
    expect(one.percent).toBeGreaterThan(none.percent);
    expect(three.percent).toBeGreaterThan(one.percent);
    expect(none.missing.some((m) => /clear performance photo/i.test(m))).toBe(true);
    expect(one.missing.some((m) => /clear performance photo/i.test(m))).toBe(false);
    expect(one.missing.some((m) => /two more photos/i.test(m))).toBe(true);
    expect(three.missing.some((m) => /photo/i.test(m))).toBe(false);
  });

  it("license threshold edges: exactly the requirements flips canPitch true", () => {
    const justEnough: ProfileFields = {
      ...empty,
      postalAddress: "123 Congress Ave, Austin, TX 78701, USA",
      photoUrls: Array.from({ length: MIN_PITCH_PHOTOS }, (_, index) => `photo-${index}`),
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
    expect(
      profileStrength({ ...justEnough, photoUrls: [] }, { activePackages: 1, gigs: 1 }).canPitch,
    ).toBe(false);
    expect(profileStrength({ ...justEnough, bio: "  " }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, headline: null }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, genres: [] }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, serviceCities: [] }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, postalAddress: null }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    expect(profileStrength({ ...justEnough, feeFloor: null }, { activePackages: 1, gigs: 1 }).canPitch).toBe(false);
    // Packages are NO LONGER license-critical (onboarding is profile-first; the
    // Hunt never reads Package) — zero packages still lets the agent pitch.
    expect(profileStrength(justEnough, { activePackages: 0, gigs: 1 }).canPitch).toBe(true);
    expect(profileStrength(justEnough, { activePackages: 1, gigs: 0 }).canPitch).toBe(false);
  });

  it("performance video is optional and does not affect strength or pitching", () => {
    const withoutVideo = profileStrength({ ...full, videoLinks: [] }, fullCounts);
    const withVideo = profileStrength(full, fullCounts);
    expect(withoutVideo).toEqual(withVideo);
    expect(withoutVideo.percent).toBe(100);
    expect(withoutVideo.canPitch).toBe(true);
    expect(withoutVideo.missing.some((m) => /video/i.test(m))).toBe(false);
  });

  it("feeFloor of 0 cents counts as set (explicit, if odd)", () => {
    const r = profileStrength({ ...empty, feeFloor: 0 }, noCounts);
    expect(r.missing.some((m) => /fee floor/i.test(m))).toBe(false);
  });
});
