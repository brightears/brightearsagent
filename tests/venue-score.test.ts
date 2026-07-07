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

  it("gives half geo + a soft note (no caution) out of area when open to travel", () => {
    const away = { ...rooftop, city: "Bristol" };
    const s = scoreVenue(away, [freshOpening], { ...profile, acceptsTravel: true }, NOW);
    expect(s.fitScore).toBe(75); // 90 - 30 + 15 (half geo)
    expect(s.caution).toBeUndefined();
    expect(s.reasons.some((r) => r.includes("open to travel"))).toBe(true);
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

describe("KIND_AFFINITY covers every artist (P12.2)", () => {
  const at = (kind: ScorableVenue["kind"]): ScorableVenue => ({
    name: "The Room",
    city: "Manchester",
    country: "GB",
    kind,
    bookingEmail: "events@theroom.example",
  });
  // Full kind credit = the same 90 the DJ rooftop case scores (geo 30 +
  // kind 25 + heat 25 + pitchable 10).
  const fullCredit = (p: MatchProfile, kind: ScorableVenue["kind"]) =>
    scoreVenue(at(kind), [freshOpening], p, NOW).fitScore;

  it("a magician earns FULL credit at hotels, event spaces and restaurants", () => {
    const magician: MatchProfile = {
      genres: ["close-up magic", "mentalism"],
      eventTypes: ["weddings", "corporate"],
      serviceCities: ["Manchester"],
    };
    expect(fullCredit(magician, "HOTEL")).toBe(90);
    expect(fullCredit(magician, "EVENT_SPACE")).toBe(90);
    expect(fullCredit(magician, "RESTAURANT")).toBe(90);
  });

  it("a comedian earns FULL credit at bars and clubs", () => {
    const comedian: MatchProfile = {
      genres: ["stand-up comedy", "improv"],
      eventTypes: ["comedy nights", "corporate"],
      serviceCities: ["Manchester"],
    };
    expect(fullCredit(comedian, "BAR")).toBe(90);
    expect(fullCredit(comedian, "CLUB")).toBe(90);
  });

  it("a dancer and a photo booth earn FULL credit at their buyers", () => {
    const dancer: MatchProfile = {
      genres: ["cabaret", "contemporary dance"],
      eventTypes: ["dinner shows", "galas"],
      serviceCities: ["Manchester"],
    };
    expect(fullCredit(dancer, "HOTEL")).toBe(90);
    expect(fullCredit(dancer, "CLUB")).toBe(90);
    const booth: MatchProfile = {
      genres: ["photo booth"],
      eventTypes: ["weddings", "corporate"],
      serviceCities: ["Manchester"],
    };
    expect(fullCredit(booth, "EVENT_SPACE")).toBe(90);
  });

  it("the reason copy speaks every act, not just sound", () => {
    const magician: MatchProfile = {
      genres: ["close-up magic"],
      eventTypes: ["weddings"],
      serviceCities: ["Manchester"],
    };
    const s = scoreVenue(at("HOTEL"), [freshOpening], magician, NOW);
    expect(s.reasons.some((r) => r.includes("your act fits the room"))).toBe(true);
  });
});
