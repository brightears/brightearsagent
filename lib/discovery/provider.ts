// Discovery provider seam (Phase 10.2). The LIVE scanner (Serper + LLM
// extraction) lives in serper.ts; the stub below feeds deterministic fixture
// data modeled on the city probe's REAL findings (docs/PROBE-CITY-DEMAND.md)
// for dev, tests and demo seeding.

import { SerperDiscoveryProvider } from "@/lib/discovery/serper";
import type { SignalType, VenueKind } from "@/lib/venues/score";
import type { VenueTemperature } from "@/lib/venues/timing";

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
  // --- 10.2c temperature model ---
  /** Scanner's temperature read; ingest merges per venue (HOT > WARM > SEED). */
  temperature?: VenueTemperature;
  /** ≤3 short grounded facts proving the venue buys entertainment. */
  entertainmentEvidence?: string[];
  /**
   * LinkedIn profile URL for the handoff card when the ONLY source naming a
   * contact is linkedin.com — a name is NEVER stored from LinkedIn (ADR-004).
   */
  linkedinUrl?: string;
};

export type DiscoveryOpts = {
  /** Time anchor for "recent" windows — pass through, never Date.now() in providers. */
  now: Date;
  /** Tenant the scan bills to (LlmUsage); null/absent = unmetered (tests). */
  businessId?: string | null;
  /**
   * 10.2c: fire the WARM query battery too (existing venues that already buy
   * entertainment). The hot battery runs every scan; scan.ts puts warm on a
   * slower wheel — every 3rd scan per tenant (Business.discoveryScanCount).
   */
  warm?: boolean;
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

/**
 * Stub unless a live provider is configured. DISCOVERY_PROVIDER=stub forces
 * the stub even with a key present (demo/dev safety). The live class lives in
 * serper.ts (which only type-imports from this file — no runtime cycle).
 */
export function getDiscoveryProvider(): DiscoveryProvider {
  if (process.env.DISCOVERY_PROVIDER === "stub") return new StubDiscoveryProvider();
  if (process.env.SERPER_API_KEY || process.env.DISCOVERY_PROVIDER === "serper") {
    return new SerperDiscoveryProvider();
  }
  // Fail CLOSED in production (audit 2026-07): a missing key used to silently
  // serve FIXTURE venues — fake rooms with fake booking emails — to paying
  // artists. Serving fixtures must be an explicit choice.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SERPER_API_KEY is missing in production — the Hunt would serve fixture venues with fake contacts. Set the key, or set DISCOVERY_PROVIDER=stub to explicitly opt into fixtures.",
    );
  }
  return new StubDiscoveryProvider();
}
