import { describe, expect, it } from "vitest";
import {
  scoreVenue,
  signalFreshness,
  type MatchProfile,
  type ScorableSignal,
  type ScorableVenue,
} from "@/lib/venues/score";

const NOW = new Date("2026-06-12T12:00:00Z");
const DAY = 24 * 3600 * 1000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);

const profile: MatchProfile = {
  genres: ["house", "disco", "open format"],
  eventTypes: ["weddings", "corporate", "club nights"],
  serviceCities: ["Manchester", "Leeds"],
};

const rooftop: ScorableVenue = {
  name: "The Nest",
  city: "Manchester",
  country: "GB",
  kind: "ROOFTOP",
  bookingEmail: "events@thenest.example",
};

const freshOpening: ScorableSignal = { type: "NEW_OPENING", observedAt: daysAgo(10) };

describe("scoreVenue", () => {
  it("scores a fresh in-city rooftop with a booking email near the top", () => {
    const s = scoreVenue(rooftop, [freshOpening], profile, NOW);
    // geo 30 + kind 25 + heat 25 + volume 0 + pitchable 10 = 90
    expect(s.fitScore).toBe(90);
    expect(s.reasons).toHaveLength(3);
    expect(s.reasons[0]).toContain("Manchester");
    expect(s.reasons.some((r) => r.includes("Rooftop"))).toBe(true);
    expect(s.reasons.some((r) => r.includes("booking entertainment now"))).toBe(true);
    expect(s.caution).toBeUndefined();
  });

  it("is deterministic", () => {
    const a = scoreVenue(rooftop, [freshOpening], profile, NOW);
    const b = scoreVenue(rooftop, [freshOpening], profile, NOW);
    expect(a).toEqual(b);
  });

  it("zeroes geo and adds a caution outside the service cities", () => {
    const away = { ...rooftop, city: "Bristol" };
    const s = scoreVenue(away, [freshOpening], profile, NOW);
    expect(s.fitScore).toBe(60); // 90 - 30 geo
    expect(s.caution).toBe("Bristol is outside your service cities");
    expect(s.reasons.some((r) => r.includes("Bristol"))).toBe(false);
  });

  it("never returns more than 3 reasons or more than 1 caution", () => {
    const s = scoreVenue(
      rooftop,
      [freshOpening, { type: "PRESS", observedAt: daysAgo(5) }, { type: "HIRING", observedAt: daysAgo(3) }],
      profile,
      NOW,
    );
    expect(s.reasons.length).toBeLessThanOrEqual(3);
    expect(typeof (s.caution ?? "")).toBe("string");
  });

  it("gives half kind-credit for event-type-only fit", () => {
    const jazzProfile: MatchProfile = {
      genres: ["jazz quartet"], // no rooftop genre overlap
      eventTypes: ["corporate"], // rooftops book corporate
      serviceCities: ["Manchester"],
    };
    const s = scoreVenue(rooftop, [freshOpening], jazzProfile, NOW);
    expect(s.fitScore).toBe(78); // 90 - 12.5, rounded
    expect(s.reasons.some((r) => r.includes("event types"))).toBe(true);
  });

  it("cautions when neither genres nor event types fit the kind", () => {
    const club: ScorableVenue = { ...rooftop, kind: "CLUB" };
    const folk: MatchProfile = {
      genres: ["folk trio"],
      eventTypes: ["weddings"],
      serviceCities: ["Manchester"],
    };
    const s = scoreVenue(club, [freshOpening], folk, NOW);
    expect(s.caution).toContain("not an obvious match");
  });

  it("decays signal heat with age", () => {
    const fresh = scoreVenue(rooftop, [{ type: "NEW_OPENING", observedAt: daysAgo(5) }], profile, NOW);
    const mid = scoreVenue(rooftop, [{ type: "NEW_OPENING", observedAt: daysAgo(50) }], profile, NOW);
    const stale = scoreVenue(rooftop, [{ type: "NEW_OPENING", observedAt: daysAgo(120) }], profile, NOW);
    expect(fresh.fitScore).toBeGreaterThan(mid.fitScore);
    expect(mid.fitScore).toBeGreaterThan(stale.fitScore);
    expect(stale.fitScore).toBe(65); // 90 minus all 25 heat
  });

  it("weights opening signals hotter than press", () => {
    const opening = scoreVenue(rooftop, [{ type: "NEW_OPENING", observedAt: daysAgo(5) }], profile, NOW);
    const press = scoreVenue(rooftop, [{ type: "PRESS", observedAt: daysAgo(5) }], profile, NOW);
    expect(opening.fitScore).toBeGreaterThan(press.fitScore);
  });

  it("treats future-dated signals (opening soon) as max heat", () => {
    expect(signalFreshness(new Date(NOW.getTime() + 7 * DAY), NOW)).toBe(1);
  });

  it("adds volume credit for corroborating signals", () => {
    const one = scoreVenue(rooftop, [freshOpening], profile, NOW);
    const three = scoreVenue(
      rooftop,
      [freshOpening, { type: "NEW_SOCIAL", observedAt: daysAgo(9) }, { type: "PRESS", observedAt: daysAgo(7) }],
      profile,
      NOW,
    );
    expect(three.fitScore).toBeGreaterThan(one.fitScore);
  });

  it("cautions on a venue with no signals at all", () => {
    const s = scoreVenue(rooftop, [], profile, NOW);
    expect(s.caution).toBe("No recent activity found — may not host live acts");
  });

  it("rewards a published booking email and cautions when missing", () => {
    const withEmail = scoreVenue(rooftop, [freshOpening], profile, NOW);
    const without = scoreVenue({ ...rooftop, bookingEmail: null }, [freshOpening], profile, NOW);
    expect(withEmail.fitScore - without.fitScore).toBe(10);
    expect(without.caution).toBe("No booking email found yet");
  });

  it("stays inside 0-100", () => {
    const maxed = scoreVenue(
      rooftop,
      [
        { type: "NEW_OPENING", observedAt: daysAgo(1) },
        { type: "OPENING_SOON", observedAt: daysAgo(2) },
        { type: "HIRING", observedAt: daysAgo(3) },
        { type: "NEW_SOCIAL", observedAt: daysAgo(4) },
        { type: "PRESS", observedAt: daysAgo(5) },
      ],
      profile,
      NOW,
    );
    expect(maxed.fitScore).toBeLessThanOrEqual(100);
    const floor = scoreVenue(
      { name: "X", city: "Nowhere", country: "US", kind: "OTHER", bookingEmail: null },
      [],
      profile,
      NOW,
    );
    expect(floor.fitScore).toBeGreaterThanOrEqual(0);
  });
});
