// Discovery provider seam (Phase 10.2). Live web scanning needs a search-API
// key (FOUNDER GATE: SERPER_API_KEY) — until it lands, the stub below feeds
// deterministic fixture data modeled on the city probe's REAL findings
// (docs/PROBE-CITY-DEMAND.md), so ingest, scoring and the feed UI are fully
// buildable and testable today.

import type { SignalType, VenueKind } from "@/lib/venues/score";

export type Metro = {
  city: string;
  country: string; // ISO-2
};

/** One observation from a scan, pre-ingest. Venue identity = (venueName, metro.city). */
export type RawSignal = {
  venueName: string;
  /** Scanner's best guess — ingest only trusts it on first sight of a venue. */
  kindGuess: VenueKind;
  type: SignalType;
  summary: string;
  sourceUrl: string;
  observedAt?: Date; // publish date when known; ingest defaults to scan time
  // Optional enrichment when the source page exposes it:
  website?: string;
  instagram?: string;
  bookingEmail?: string;
  bookingContactName?: string;
  /** Provenance of the booking email — trust signal shown on the card. */
  contactSource?: string;
};

export type DiscoveryOpts = {
  /** Time anchor for "recent" windows — pass through, never Date.now() in providers. */
  now: Date;
};

export interface DiscoveryProvider {
  searchVenueSignals(metro: Metro, opts: DiscoveryOpts): Promise<RawSignal[]>;
}

const DAY_MS = 24 * 3600 * 1000;
const daysAgo = (now: Date, d: number) => new Date(now.getTime() - d * DAY_MS);

/**
 * Deterministic fixture provider — venues modeled on the June 2026 probe
 * (Manchester UK + Nashville TN had the cleanest signal sets). Used in dev,
 * tests and the seed script; returns [] for metros it has no fixtures for.
 */
export class StubDiscoveryProvider implements DiscoveryProvider {
  async searchVenueSignals(metro: Metro, opts: DiscoveryOpts): Promise<RawSignal[]> {
    const { now } = opts;
    const fixtures: Record<string, RawSignal[]> = {
      manchester: [
        {
          venueName: "The Nest",
          kindGuess: "ROOFTOP",
          type: "NEW_OPENING",
          summary: "Rooftop bar and terrace opened atop the Treehouse Hotel, Deansgate",
          sourceUrl: "https://www.manchestereveningnews.example/whats-on/the-nest-rooftop-opens",
          observedAt: daysAgo(now, 12),
          website: "https://thenest-manchester.example",
          bookingEmail: "events@thenest-manchester.example",
          contactSource: "venue website /private-hire page",
        },
        {
          venueName: "The Nest",
          kindGuess: "ROOFTOP",
          type: "NEW_SOCIAL",
          summary: "New Instagram account posting launch-week DJ sets",
          sourceUrl: "https://instagram.example/thenestmcr",
          observedAt: daysAgo(now, 9),
          instagram: "@thenestmcr",
        },
        {
          venueName: "Lucky Ramen & Highballs",
          kindGuess: "BAR",
          type: "OPENING_SOON",
          summary: "Japanese listening-bar concept announced for the Northern Quarter, late-summer opening",
          sourceUrl: "https://secretmanchester.example/lucky-ramen-highballs-announced",
          observedAt: daysAgo(now, 20),
        },
        {
          venueName: "Freight Island",
          kindGuess: "EVENT_SPACE",
          type: "HIRING",
          summary: "Hiring events coordinators and bar staff for the summer season",
          sourceUrl: "https://jobs.example/freight-island-events-coordinator",
          observedAt: daysAgo(now, 30),
          website: "https://freightisland.example",
          bookingEmail: "bookings@freightisland.example",
          contactSource: "careers post footer",
        },
      ],
      nashville: [
        {
          venueName: "Glowbird",
          kindGuess: "RESTAURANT",
          type: "NEW_OPENING",
          summary: "All-day cafe and listening bar opened in Wedgewood-Houston with a vinyl program",
          sourceUrl: "https://nashvillescene.example/food-drink/glowbird-now-open",
          observedAt: daysAgo(now, 8),
          website: "https://glowbirdnashville.example",
          bookingEmail: "hello@glowbirdnashville.example",
          contactSource: "venue website contact page",
        },
        {
          venueName: "The Stillery Rooftop",
          kindGuess: "ROOFTOP",
          type: "OPENING_SOON",
          summary: "Downtown rooftop expansion announced, opening for bachelorette season",
          sourceUrl: "https://tennessean.example/stillery-rooftop-expansion",
          observedAt: daysAgo(now, 25),
        },
        {
          venueName: "Hotel Saint Cecilia Nashville",
          kindGuess: "HOTEL",
          type: "PRESS",
          summary: "Boutique hotel profiled for its weekend courtyard music series",
          sourceUrl: "https://stylepress.example/saint-cecilia-nashville-music",
          observedAt: daysAgo(now, 45),
          website: "https://saintcecilianash.example",
          bookingEmail: "events@saintcecilianash.example",
          contactSource: "press article byline quote",
        },
      ],
    };
    return fixtures[metro.city.trim().toLowerCase()] ?? [];
  }
}

/** The live implementation lands when the founder provides a search-API key. */
export class SerperDiscoveryProvider implements DiscoveryProvider {
  async searchVenueSignals(): Promise<RawSignal[]> {
    throw new Error(
      "Live venue discovery not implemented yet (founder gate: search API key — SERPER_API_KEY)",
    );
  }
}

/**
 * Stub unless a live provider is configured. DISCOVERY_PROVIDER=stub forces
 * the stub even with a key present (demo/dev safety).
 */
export function getDiscoveryProvider(): DiscoveryProvider {
  if (process.env.DISCOVERY_PROVIDER === "stub") return new StubDiscoveryProvider();
  if (process.env.SERPER_API_KEY || process.env.DISCOVERY_PROVIDER === "serper") {
    return new SerperDiscoveryProvider();
  }
  return new StubDiscoveryProvider();
}
