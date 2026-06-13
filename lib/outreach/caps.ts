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

/**
 * The statuses that count toward today's SEND cap (Phase 10.5 hardening).
 * BOTH SENT (delivered) and SENDING (claimed, in flight) count — otherwise a
 * burst of concurrent claims could each pass a SENT-only check and blow the
 * daily cap. The cap query is `status: { in: SEND_CAP_STATUSES }` plus today's
 * window in the tenant tz.
 */
export const SEND_CAP_STATUSES = ["SENT", "SENDING"] as const;

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

/** The UTC offset (ms) in effect at a given UTC instant for an IANA zone. */
function tzOffsetMs(instant: Date, timezone: string): number {
  // Format the instant AS the tenant's local wall-clock, read it back as if it
  // were UTC, and the difference is the offset. Robust for any IANA zone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // ICU can emit "24" for midnight — normalize
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * UTC instant of local midnight "today" in the given IANA timezone —
 * `createdAt >= startOfTenantDay(now, tz)` is "created today" for the tenant
 * (CLAUDE.md rule 9: all date logic in tenant timezone).
 *
 * DST-correct: we read the tenant-local calendar date for `now`, then resolve
 * the UTC instant of 00:00:00 on that date using the offset IN EFFECT AT
 * MIDNIGHT (not at `now`). On a DST-flip day the offset at midnight differs
 * from the offset now; computing it at the boundary itself fixes the old ±1h
 * drift. We re-resolve the offset once after the first guess so a guess that
 * lands on the wrong side of the transition self-corrects. Never crashes on
 * exotic zones.
 */
export function startOfTenantDay(now: Date, timezone: string): Date {
  // Tenant-local calendar date of `now`.
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(dateParts.find((p) => p.type === type)?.value ?? 0);
  // Local midnight expressed as a UTC-epoch as if the wall clock were UTC.
  const localMidnightAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0);

  // First guess: subtract the offset at `now`. Then re-read the offset at that
  // guessed instant (which is at/near midnight) and correct — this is what
  // makes the DST-flip day exact rather than ±1h off.
  let guess = new Date(localMidnightAsUtc - tzOffsetMs(now, timezone));
  const offsetAtGuess = tzOffsetMs(guess, timezone);
  guess = new Date(localMidnightAsUtc - offsetAtGuess);
  return guess;
}
