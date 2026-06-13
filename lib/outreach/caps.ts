// Per-tenant daily pitch-creation caps by temperature (Phase 10.2c — the
// ADR-004 spam discipline made real). Quality beats volume: a venue contact
// burned by a sloppy blast never opens the second email, so the agent is
// rate-limited at the DRAFT stage, not just at send time.
//
// PURE module (no DB): the action layer counts VenuePitch rows created today
// in the TENANT's timezone (CLAUDE.md rule 9) and asks `capFor`/`capError`.

import type { VenueTemperature } from "@/lib/venues/timing";

/**
 * Max pitch CREATIONS per tenant per tenant-local day, by temperature.
 * HOT venues are time-sensitive (deciding now) so they get the most room;
 * SEED intros are pure relationship-planting — three polite seeds a day is
 * plenty, thirty is spam.
 */
export const DAILY_PITCH_CAPS: Record<VenueTemperature, number> = {
  HOT: 10,
  WARM: 5,
  SEED: 3,
};

export function capFor(temperature: VenueTemperature): number {
  return DAILY_PITCH_CAPS[temperature];
}

/**
 * Max pitch SENDS per tenant per tenant-local day (Phase 10.5 — the ADR-004
 * "10-20 outbound/day per artist" hard cap). Counts VenuePitch rows that went
 * SENT today, re-checked at send time so a stale UI or a burst of approvals
 * can't blow past the daily send budget. Mirrors the draft caps per
 * temperature (HOT room is widest; total across temperatures stays ≤ 18/day).
 */
export const DAILY_SEND_CAPS: Record<VenueTemperature, number> = {
  HOT: 10,
  WARM: 5,
  SEED: 3,
};

export function sentCapFor(temperature: VenueTemperature): number {
  return DAILY_SEND_CAPS[temperature];
}

/** The friendly refusal shown on the card when today's cap is hit. */
export function capError(temperature: VenueTemperature): string {
  const label: Record<VenueTemperature, string> = {
    HOT: "hot",
    WARM: "warm",
    SEED: "intro",
  };
  return `Daily ${label[temperature]}-pitch cap reached — quality beats volume`;
}

/** The friendly refusal when today's SEND cap (not draft cap) is hit. */
export function sendCapError(temperature: VenueTemperature): string {
  const label: Record<VenueTemperature, string> = {
    HOT: "hot",
    WARM: "warm",
    SEED: "intro",
  };
  return `Daily ${label[temperature]}-send cap reached — quality beats volume`;
}

/**
 * UTC instant of local midnight "today" in the given IANA timezone —
 * `createdAt >= startOfTenantDay(now, tz)` is "created today" for the tenant
 * (CLAUDE.md rule 9: all date logic in tenant timezone).
 *
 * Implementation: read the tenant-local calendar date + clock for `now` via
 * Intl, then subtract the time-of-day. DST transitions on the current day can
 * shift the boundary by the offset delta (≤1h) — acceptable for a soft daily
 * cap, and it never crashes on exotic zones.
 */
export function startOfTenantDay(now: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // "24" can appear for midnight in some ICU versions — normalize to 0.
  const hours = get("hour") % 24;
  const sinceMidnightMs =
    hours * 3600_000 + get("minute") * 60_000 + get("second") * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnightMs);
}
