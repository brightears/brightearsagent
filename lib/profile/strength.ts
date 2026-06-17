// Profile strength + the "hunting license" (ROADMAP 10.1, ADR-004).
//
// The sales agent may FIND venues with minimal data, but it may NOT PITCH
// until the profile has real ammunition — a weak pitch burns the venue
// contact forever. `canPitch` is that quality gate; `percent` is the softer
// completeness meter the profile editor shows; `missing` is the human to-do
// list, priority-ordered, in plain language.
//
// Pure function — no db, no I/O. Callers pass the Business row (or any object
// with these fields) plus counts they already have.

export type ProfileFields = {
  genres: string[];
  eventTypes: string[];
  serviceCities: string[];
  travelPolicy: string | null;
  feeFloor: number | null;
  feeSweetSpot: number | null;
  insured: boolean;
  headline: string | null;
  bio: string | null;
  videoLinks: string[];
  photoUrls: string[];
  reviewQuotes: string[];
  notableVenues: string[];
};

export type ProfileCounts = {
  /** Active rate-card packages (Package.active = true). */
  activePackages: number;
  /** Gigs on the in-app calendar — our proxy for "calendar is real". */
  gigs: number;
};

export type ProfileStrength = {
  /** 0-100 weighted completeness. */
  percent: number;
  /** Priority-ordered, human-readable gaps. */
  missing: string[];
  /** The hunting license: true = the agent may pitch venues. */
  canPitch: boolean;
};

/** Photos required before the agent may pitch (venues book what they can see). */
export const MIN_PITCH_PHOTOS = 3;

const present = (s: string | null | undefined) => !!s && s.trim().length > 0;

// Weighted checks, in priority order — missing[] preserves this order, so the
// license-critical ammunition surfaces first. Weights sum to 100.
const CHECKS: {
  weight: number;
  license: boolean;
  hint: string;
  /** Fraction of the weight earned (0..1). */
  earned: (p: ProfileFields, c: ProfileCounts) => number;
}[] = [
  {
    weight: 14,
    license: true,
    hint: "Add a performance video — venues book what they can see",
    earned: (p) => (p.videoLinks.length > 0 ? 1 : 0),
  },
  {
    weight: 12,
    license: true,
    hint: `Add at least ${MIN_PITCH_PHOTOS} photos — a pitch without faces gets deleted`,
    // Partial credit per photo so the meter moves as they paste URLs.
    earned: (p) => Math.min(p.photoUrls.length, MIN_PITCH_PHOTOS) / MIN_PITCH_PHOTOS,
  },
  {
    weight: 10,
    license: true,
    hint: "Write a short bio in your own voice — 40 to 120 words is the sweet spot",
    earned: (p) => (present(p.bio) ? 1 : 0),
  },
  {
    weight: 8,
    license: true,
    hint: "Give yourself a headline — the one line a venue reads first",
    earned: (p) => (present(p.headline) ? 1 : 0),
  },
  {
    // NOT license-critical: packages feed REACTIVE inbound quoting, not the
    // Hunt (which never reads Package). Onboarding is now profile-first, so a
    // package can't be a prerequisite to pitch — it's a nudge for inbound replies.
    weight: 8,
    license: false,
    hint: "Add a package for inbound replies — the agent quotes from your rate card",
    earned: (_p, c) => (c.activePackages > 0 ? 1 : 0),
  },
  {
    weight: 8,
    license: true,
    hint: "Tag your genres and vibe — it's how the agent matches you to venues",
    earned: (p) => (p.genres.length > 0 ? 1 : 0),
  },
  {
    weight: 8,
    license: true,
    hint: "Name the cities you serve — the agent only hunts where you play",
    earned: (p) => (p.serviceCities.length > 0 ? 1 : 0),
  },
  {
    weight: 8,
    license: true,
    hint: "Set your fee floor — the agent never pitches below it",
    earned: (p) => (p.feeFloor !== null ? 1 : 0),
  },
  {
    weight: 6,
    license: true,
    hint: "Put a gig on your calendar — availability is half of every pitch",
    earned: (_p, c) => (c.gigs > 0 ? 1 : 0),
  },
  {
    weight: 4,
    license: false,
    hint: "List the event types you play — weddings, corporate, club nights",
    earned: (p) => (p.eventTypes.length > 0 ? 1 : 0),
  },
  {
    weight: 4,
    license: false,
    hint: "Paste a client quote or two — borrowed trust closes venues",
    earned: (p) => (p.reviewQuotes.length > 0 ? 1 : 0),
  },
  {
    weight: 3,
    license: false,
    hint: "Name venues you've played — bookers recognize rooms, not bios",
    earned: (p) => (p.notableVenues.length > 0 ? 1 : 0),
  },
  {
    weight: 3,
    license: false,
    hint: "Set your sweet-spot fee — what the agent aims for, not just your floor",
    earned: (p) => (p.feeSweetSpot !== null ? 1 : 0),
  },
  {
    weight: 3,
    license: false,
    hint: "Spell out your travel policy — saves a back-and-forth on every pitch",
    earned: (p) => (present(p.travelPolicy) ? 1 : 0),
  },
  {
    weight: 1,
    license: false,
    hint: "Insured? Tick it — some venues require it before they'll reply",
    earned: (p) => (p.insured ? 1 : 0),
  },
];

export function profileStrength(profile: ProfileFields, counts: ProfileCounts): ProfileStrength {
  let earned = 0;
  let total = 0;
  const missing: string[] = [];
  let canPitch = true;

  for (const check of CHECKS) {
    total += check.weight;
    const fraction = check.earned(profile, counts);
    earned += check.weight * fraction;
    if (fraction < 1) {
      missing.push(check.hint);
      if (check.license) canPitch = false;
    }
  }

  return {
    percent: Math.round((earned / total) * 100),
    missing,
    canPitch,
  };
}
