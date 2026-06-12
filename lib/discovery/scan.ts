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

export const SCAN_MIN_INTERVAL_MS = 20 * 3600 * 1000; // 20h
export const MAX_METROS_PER_SCAN = 2; // v1 cap — caps differ by tier later

export type MetroScanSummary = {
  city: string;
  country: string;
  rawSignals: number;
  created: number;
  updated: number;
  skipped: number;
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

  if (business.serviceCities.length === 0) {
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

  // Stamp BEFORE scanning: a crash mid-scan has already spent queries, and a
  // hot retry loop must not double-spend the budget. The wheel counter
  // advances here too — a crashed warm scan still counts as the warm turn.
  await db.business.update({
    where: { id: businessId },
    data: { lastDiscoveryScanAt: now, discoveryScanCount: { increment: 1 } },
  });

  const provider = opts.provider ?? getDiscoveryProvider();
  const metros: Metro[] = business.serviceCities
    .slice(0, MAX_METROS_PER_SCAN)
    .map((city) => ({ city, country: business.country }));

  const result: ScanResult = { ...base, ran: true };
  const queriesBefore = queriesUsed(provider);

  for (const metro of metros) {
    const raw = await provider.searchVenueSignals(metro, { now, businessId, warm });
    const plan = await ingestSignals(businessId, metro, raw, now);
    result.metros.push({
      city: metro.city,
      country: metro.country,
      rawSignals: raw.length,
      created: plan.creates.length,
      updated: plan.updates.length,
      skipped: plan.skipped.length,
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
