// Venue fit scoring (Phase 10.2, ADR-004). PURE — no DB, no LLM, no clock:
// `now` is a parameter so tests are deterministic. The output renders directly
// on the opportunity-feed card (10.4): a 0-100 score, <=3 plain-language
// reasons, and at most one caution.

export type VenueKind =
  | "BAR"
  | "ROOFTOP"
  | "HOTEL"
  | "RESTAURANT"
  | "EVENT_SPACE"
  | "CLUB"
  | "OTHER";

export type SignalType =
  | "NEW_OPENING"
  | "OPENING_SOON"
  | "HIRING"
  | "NEW_SOCIAL"
  | "PRESS"
  | "MANUAL"
  // 10.2c WARM-battery evidence classes:
  | "HOSTS_ENTERTAINMENT"
  | "EVENT_PROGRAM"
  | "TEAM_CONTACT";

export type ScorableSignal = {
  type: SignalType;
  observedAt: Date;
};

export type ScorableVenue = {
  name: string;
  city: string;
  country: string;
  kind: VenueKind;
  bookingEmail?: string | null;
};

/** The slice of the Business profile that matching reads (10.1 fields). */
export type MatchProfile = {
  genres: string[];
  eventTypes: string[];
  serviceCities: string[];
  /**
   * Onboarding dial (June 2026). When the artist is open to travel, a venue
   * outside the service cities is still genuinely pitchable — it earns partial
   * geo credit instead of the hard "outside your area" caution. Optional so
   * existing callers/tests default it to false (home-base-only).
   */
  acceptsTravel?: boolean;
};

export type VenueScore = {
  /** 0-100. */
  fitScore: number;
  /** <=3, plain language, feed-card ready. */
  reasons: string[];
  /** <=1 plain-language caution. */
  caution?: string;
};

// ---------------------------------------------------------------------------
// The kind-affinity matrix: which artist genres/event-types each venue kind
// actually books. Static and intentionally broad — free-form profile tags are
// matched by case-insensitive substring either way ("club" matches "club
// nights"). Tuned by Skip-reasons later (10.4), not by an LLM.
// ---------------------------------------------------------------------------
const KIND_AFFINITY: Record<
  VenueKind,
  { genres: string[]; eventTypes: string[]; blurb: string }
> = {
  BAR: {
    genres: ["open format", "top 40", "house", "disco", "funk", "soul", "indie", "rock", "acoustic", "dj"],
    eventTypes: ["bar", "club night", "residency", "live music", "happy hour"],
    blurb: "Bars book weekly DJs and live acts",
  },
  ROOFTOP: {
    genres: ["house", "deep house", "lounge", "disco", "open format", "chill", "nu disco", "acoustic", "dj"],
    eventTypes: ["sunset session", "residency", "club night", "corporate", "private event"],
    blurb: "Rooftops run sunset DJ sessions and lounge sets",
  },
  HOTEL: {
    genres: ["lounge", "jazz", "acoustic", "house", "soul", "chill", "piano", "dj"],
    eventTypes: ["wedding", "corporate", "brunch", "residency", "private event", "lobby"],
    blurb: "Hotels book residencies, weddings and corporate events",
  },
  RESTAURANT: {
    genres: ["jazz", "acoustic", "soul", "lounge", "latin", "funk", "chill"],
    eventTypes: ["brunch", "dinner", "live music", "residency", "private event"],
    blurb: "Restaurants book dinner and brunch entertainment",
  },
  EVENT_SPACE: {
    genres: ["open format", "top 40", "wedding", "dj", "band", "acoustic"],
    eventTypes: ["wedding", "corporate", "private event", "party", "birthday", "gala"],
    blurb: "Event spaces refer entertainment for every booking",
  },
  CLUB: {
    genres: ["house", "techno", "edm", "hip hop", "open format", "drum and bass", "top 40", "dj"],
    eventTypes: ["club night", "residency", "guest set", "party"],
    blurb: "Clubs book DJs by genre fit",
  },
  OTHER: {
    genres: [],
    eventTypes: [],
    blurb: "May host live entertainment",
  },
};

const KIND_LABEL: Record<VenueKind, string> = {
  BAR: "Bar",
  ROOFTOP: "Rooftop bar",
  HOTEL: "Hotel",
  RESTAURANT: "Restaurant",
  EVENT_SPACE: "Event space",
  CLUB: "Club",
  OTHER: "Venue",
};

// Weights (sum 100): geo is the gate, heat is the moment, kind is the match.
const W_GEO = 30;
const W_KIND = 25;
const W_HEAT = 25;
const W_VOLUME = 10;
const W_PITCHABLE = 10;

const DAY_MS = 24 * 3600 * 1000;

const norm = (s: string) => s.trim().toLowerCase();

/** Case-insensitive substring match either way ("club" ~ "club nights"). */
function tagsOverlap(profileTags: string[], affinityTags: string[]): boolean {
  const p = profileTags.map(norm).filter(Boolean);
  return affinityTags.some((a) => p.some((t) => t.includes(a) || a.includes(t)));
}

/** Hot-signal freshness: 1.0 inside 14 days, linear decay to 0 at 90 days. */
export function signalFreshness(observedAt: Date, now: Date): number {
  const ageDays = (now.getTime() - observedAt.getTime()) / DAY_MS;
  if (ageDays < 0) return 1; // future-dated (e.g. "opening next month") = max heat
  if (ageDays <= 14) return 1;
  if (ageDays >= 90) return 0;
  return (90 - ageDays) / (90 - 14);
}

function weeksAgo(observedAt: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - observedAt.getTime()) / DAY_MS));
  if (days < 7) return "this week";
  const w = Math.floor(days / 7);
  return w === 1 ? "a week ago" : `${w} weeks ago`;
}

export function scoreVenue(
  venue: ScorableVenue,
  signals: ScorableSignal[],
  profile: MatchProfile,
  now: Date,
): VenueScore {
  const reasons: string[] = [];
  let caution: string | undefined;
  let score = 0;

  // --- Geo (30): the agent hunts where the artist plays — but an artist who's
  // open to travel can take a room out of area, so that earns half geo + a soft
  // note rather than the hard "outside your area" caution.
  const inServiceArea = profile.serviceCities.map(norm).includes(norm(venue.city));
  if (inServiceArea) {
    score += W_GEO;
    reasons.push(`In ${venue.city} — one of your service cities`);
  } else if (profile.acceptsTravel) {
    score += W_GEO / 2;
    reasons.push(`${venue.city} is outside your usual area — but you're open to travel`);
  } else {
    caution = `${venue.city} is outside your service cities`;
  }

  // --- Kind vs genres/event types (25): full credit on genre fit, half on
  // event-type-only fit (the venue books that occasion, not your sound).
  const affinity = KIND_AFFINITY[venue.kind];
  const genreFit = tagsOverlap(profile.genres, affinity.genres);
  const eventFit = tagsOverlap(profile.eventTypes, affinity.eventTypes);
  if (genreFit) {
    score += W_KIND;
    reasons.push(`${KIND_LABEL[venue.kind]} — your sound fits the room`);
  } else if (eventFit) {
    score += W_KIND / 2;
    reasons.push(`${KIND_LABEL[venue.kind]} — books the event types you play`);
  } else if (venue.kind === "OTHER") {
    caution ??= "Venue type unclear — may not host live acts";
  } else {
    caution ??= `${KIND_LABEL[venue.kind]} — not an obvious match for your act`;
  }

  // --- Signal heat (25): a venue opening NOW is deciding its entertainment
  // program NOW. Hottest fresh signal wins; opening signals outrank the rest.
  const HEAT_BY_TYPE: Record<SignalType, number> = {
    NEW_OPENING: 1,
    OPENING_SOON: 1,
    HIRING: 0.6,
    NEW_SOCIAL: 0.5,
    PRESS: 0.4,
    MANUAL: 0.4,
    // 10.2c: evidence of an EXISTING entertainment program is solid but not a
    // "deciding now" moment — timing lives in lib/venues/timing.ts, not here.
    HOSTS_ENTERTAINMENT: 0.55,
    EVENT_PROGRAM: 0.55,
    TEAM_CONTACT: 0.35,
  };
  let bestHeat = 0;
  let bestSignal: ScorableSignal | null = null;
  for (const s of signals) {
    const heat = HEAT_BY_TYPE[s.type] * signalFreshness(s.observedAt, now);
    if (heat > bestHeat) {
      bestHeat = heat;
      bestSignal = s;
    }
  }
  score += W_HEAT * bestHeat;
  if (bestSignal && bestHeat >= 0.5) {
    const when = weeksAgo(bestSignal.observedAt, now);
    const SIGNAL_PHRASE: Record<SignalType, string> = {
      NEW_OPENING: `Opened ${when} — booking entertainment now`,
      OPENING_SOON: `Opening soon (announced ${when}) — planning entertainment now`,
      HIRING: `Hiring staff ${when} — gearing up for events`,
      NEW_SOCIAL: `New on social ${when} — building its program`,
      PRESS: `In the press ${when}`,
      MANUAL: `You flagged this one ${when}`,
      HOSTS_ENTERTAINMENT: `Books DJs/live acts (seen ${when})`,
      EVENT_PROGRAM: `Runs a public events program (seen ${when})`,
      TEAM_CONTACT: `Events contact named publicly ${when}`,
    };
    reasons.push(SIGNAL_PHRASE[bestSignal.type]);
  }
  if (signals.length === 0) {
    caution ??= "No recent activity found — may not host live acts";
  }

  // --- Signal volume (10): corroboration. 2nd..4th signal each add a third.
  score += W_VOLUME * Math.min(Math.max(signals.length - 1, 0), 3) / 3;

  // --- Pitchability (10): a published booking email = actually actionable.
  if (venue.bookingEmail) {
    score += W_PITCHABLE;
    if (reasons.length < 3) reasons.push("Booking contact published — ready to pitch");
  } else {
    caution ??= "No booking email found yet";
  }

  return {
    fitScore: Math.round(Math.min(100, Math.max(0, score))),
    reasons: reasons.slice(0, 3),
    ...(caution ? { caution } : {}),
  };
}
