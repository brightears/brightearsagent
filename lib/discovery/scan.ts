// Scan orchestration (Phase 10.2b): one tenant's full discovery cycle —
// metros from the artist profile → provider scan → ingest (dedup/suppression/
// scoring) → contact pass for promising venues missing an email.
//
// Budget guard: a live scan burns real Serper queries, so a tenant gets at
// most one scan per 20h (Business.lastDiscoveryScanAt). Manual --force (the
// dev script) bypasses; the cron never does.

import { db } from "@/lib/db";
import { getDiscoveryProvider, type DiscoveryProvider, type Metro } from "@/lib/discovery/provider";
import { ingestSignals } from "@/lib/discovery/ingest";
import { runContactPass, type ContactPassResult } from "@/lib/discovery/contacts";
import {
  isWindowExpired,
  isWindowLive,
  shouldScanWindowThisScan,
} from "@/lib/discovery/travel";

export const SCAN_MIN_INTERVAL_MS = 20 * 3600 * 1000; // 20h
export const MAX_METROS_PER_SCAN = 2; // v1 cap — caps differ by tier later

// Travel Mode constants + liveness helpers live in lib/discovery/travel.ts (no
// import cycle). Re-exported here so callers/tests have one discovery surface.
export {
  TRAVEL_WINDOW_LEAD_MS,
  TRAVEL_COLD_SCAN_MODULO,
} from "@/lib/discovery/travel";

export type MetroScanSummary = {
  city: string;
  country: string;
  rawSignals: number;
  created: number;
  updated: number;
  skipped: number;
  /** Travel Mode: the TravelWindow this metro came from (null = home base). */
  travelWindowId: string | null;
};

export type ScanResult = {
  businessId: string;
  ran: boolean;
  reason?: string; // when ran=false
  /** 10.2c: did this scan include the WARM battery (the slow wheel)? */
  warm: boolean;
  metros: MetroScanSummary[];
  contacts: ContactPassResult | null;
  /** Total Serper queries consumed (discovery + contact pass). */
  serperQueries: number;
};

export async function runDiscoveryScan(
  businessId: string,
  opts: { now?: Date; force?: boolean; forceWarm?: boolean; provider?: DiscoveryProvider } = {},
): Promise<ScanResult> {
  const now = opts.now ?? new Date();
  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: {
      id: true,
      country: true,
      serviceCities: true,
      lastDiscoveryScanAt: true,
      discoveryScanCount: true,
      // Travel Mode: every travel window + a count of venues already found for
      // it (drives the speculative-window reduced cadence). Only ACTIVE/EXPIRED
      // matter here — CANCELLED windows are inert (kept for history).
      travelWindows: {
        select: {
          id: true,
          city: true,
          country: true,
          startDate: true,
          endDate: true,
          status: true,
          _count: { select: { venues: true } },
        },
      },
    },
  });

  // 10.2c warm wheel: the hot battery runs every scan; the WARM battery (8
  // more queries/metro) fires every 3rd scan. A COUNTER over date-modulo:
  // scans run irregularly (manual --force, missed crons), so date-modulo on
  // lastDiscoveryScanAt could starve the warm wheel for weeks — the counter
  // guarantees exactly 1-in-3 regardless of cadence. count 0 (first ever
  // scan) is warm, so new tenants see WARM venues from day one.
  const warm = opts.forceWarm || business.discoveryScanCount % 3 === 0;

  const base: ScanResult = {
    businessId,
    ran: false,
    warm,
    metros: [],
    contacts: null,
    serperQueries: 0,
  };

  // Travel Mode: a tenant with NO home cities can still be hunted in a travel
  // city, so refuse only when there's neither a home base nor any travel window.
  if (business.serviceCities.length === 0 && business.travelWindows.length === 0) {
    return { ...base, reason: "no service cities on the artist profile" };
  }
  if (
    !opts.force &&
    business.lastDiscoveryScanAt &&
    now.getTime() - business.lastDiscoveryScanAt.getTime() < SCAN_MIN_INTERVAL_MS
  ) {
    return {
      ...base,
      reason: `scan budget: last scan ${business.lastDiscoveryScanAt.toISOString()} is < 20h ago`,
    };
  }

  // Travel Mode auto-expire (at the start of a scan): ACTIVE windows whose
  // endDate has passed (date-only) become EXPIRED and are excluded below. A
  // single updateMany; the in-memory copies are flipped too so the metro plan
  // doesn't re-include them this scan.
  const toExpire = business.travelWindows.filter(
    (w) => w.status === "ACTIVE" && isWindowExpired(w, now),
  );
  if (toExpire.length > 0) {
    await db.travelWindow.updateMany({
      where: { id: { in: toExpire.map((w) => w.id) }, businessId, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    for (const w of toExpire) w.status = "EXPIRED";
  }

  // Stamp BEFORE scanning: a crash mid-scan has already spent queries, and a
  // hot retry loop must not double-spend the budget. The wheel counter
  // advances here too — a crashed warm scan still counts as the warm turn.
  await db.business.update({
    where: { id: businessId },
    data: { lastDiscoveryScanAt: now, discoveryScanCount: { increment: 1 } },
  });

  const provider = opts.provider ?? getDiscoveryProvider();

  // Build the scan plan: HOME metros first (serviceCities, the home country),
  // then LIVE travel windows. A travel target carries the WINDOW's country (so
  // jurisdiction follows the destination) and its id (so discovered venues are
  // tagged + outreach is date-bounded). Speculative (0-venue) windows scan at a
  // reduced 1-in-3 cadence; windows with ≥1 venue scan every time. The
  // MAX_METROS_PER_SCAN cap still bounds total Serper spend (home wins the cap).
  type ScanTarget = { metro: Metro; travelWindowId: string | null };
  const homeTargets: ScanTarget[] = business.serviceCities.map((city) => ({
    metro: { city, country: business.country },
    travelWindowId: null,
  }));
  const travelTargets: ScanTarget[] = business.travelWindows
    .filter((w) => isWindowLive(w, now))
    .filter((w) => shouldScanWindowThisScan(w._count.venues > 0, business.discoveryScanCount))
    .map((w) => ({
      metro: { city: w.city, country: w.country },
      travelWindowId: w.id,
    }));
  const targets = [...homeTargets, ...travelTargets].slice(0, MAX_METROS_PER_SCAN);

  const result: ScanResult = { ...base, ran: true };
  const queriesBefore = queriesUsed(provider);

  for (const { metro, travelWindowId } of targets) {
    const raw = await provider.searchVenueSignals(metro, { now, businessId, warm });
    const plan = await ingestSignals(businessId, metro, raw, now, travelWindowId);
    result.metros.push({
      city: metro.city,
      country: metro.country,
      rawSignals: raw.length,
      created: plan.creates.length,
      updated: plan.updates.length,
      skipped: plan.skipped.length,
      travelWindowId,
    });
  }

  result.contacts = await runContactPass(businessId, {
    now,
    gl: business.country.trim().toLowerCase(),
  });
  result.serperQueries =
    queriesUsed(provider) - queriesBefore + result.contacts.serperQueries;
  return result;
}

/** Live provider exposes a query ledger; the stub doesn't (and costs nothing). */
function queriesUsed(provider: DiscoveryProvider): number {
  const q = (provider as { queriesUsed?: unknown }).queriesUsed;
  return typeof q === "number" ? q : 0;
}
