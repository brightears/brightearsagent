// Travel Mode scan-scoping helpers (Travel Mode, ADR-004). PURE and
// deterministic — no DB, no clock: `now` is always a parameter so tests are
// stable. The scan orchestrator (lib/discovery/scan.ts) uses these to decide
// which travel windows are LIVE this scan and which have EXPIRED.
//
// Date-only semantics: a TravelWindow's start/end are stored as DateTime but
// the window is inclusive of both calendar dates. We compare against UTC day
// boundaries (the window dates are entered as date-only, persisted at UTC
// midnight) so a window ending "Aug 11" stays live for all of Aug 11.

// Travel Mode: how early a travel window goes "live" — we start hunting a
// destination city this far AHEAD of its startDate so date-bounded outreach has
// time to land before the artist arrives. A window is live when
// now ∈ [startDate − TRAVEL_WINDOW_LEAD_MS, endDate].
export const TRAVEL_WINDOW_LEAD_MS = 28 * 24 * 3600 * 1000; // ~4 weeks

// Reduced cadence for speculative travel windows: a window that has produced 0
// venues so far is scanned only 1-in-TRAVEL_COLD_SCAN_MODULO scans (skip on 2
// of every 3), keyed off the same discoveryScanCount wheel as the warm battery.
// Once it has ≥1 venue it scans every time, like home base — keeps Serper spend
// off cold speculative cities.
export const TRAVEL_COLD_SCAN_MODULO = 3;

export type ScopableWindow = {
  id: string;
  city: string;
  country: string;
  startDate: Date;
  endDate: Date;
  status: string; // TravelWindowStatus
};

const DAY_MS = 24 * 3600 * 1000;

/** UTC midnight of `d`'s calendar day — the date-only anchor for comparisons. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Has this window's end date passed (date-only)? A window ending Aug 11 is NOT
 * expired on Aug 11 — only from Aug 12. (endDate's day < today's day.)
 */
export function isWindowExpired(w: { endDate: Date }, now: Date): boolean {
  return startOfUtcDay(w.endDate).getTime() < startOfUtcDay(now).getTime();
}

/**
 * Is the window LIVE this scan? Live = ACTIVE and now ∈ [startDate − LEAD, endDate]:
 *  - we start hunting LEAD (~4 weeks) BEFORE startDate so date-bounded outreach
 *    lands before arrival;
 *  - it stays live through the whole endDate calendar day.
 * EXPIRED/CANCELLED windows are never live.
 */
export function isWindowLive(w: ScopableWindow, now: Date): boolean {
  if (w.status !== "ACTIVE") return false;
  if (isWindowExpired(w, now)) return false;
  const earliest = startOfUtcDay(w.startDate).getTime() - TRAVEL_WINDOW_LEAD_MS;
  return now.getTime() >= earliest;
}

/**
 * Reduced cadence for speculative (cold) travel windows. A window that has
 * found 0 venues so far is scanned only 1-in-TRAVEL_COLD_SCAN_MODULO scans
 * (keyed off the same discoveryScanCount wheel as the warm battery, so cadence
 * is deterministic regardless of how irregularly scans actually run). A window
 * that already has ≥1 venue scans every time, like home base.
 */
export function shouldScanWindowThisScan(
  hasVenues: boolean,
  scanCount: number,
): boolean {
  if (hasVenues) return true;
  return scanCount % TRAVEL_COLD_SCAN_MODULO === 0;
}

export { DAY_MS };
