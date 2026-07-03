// Residency → dates. A working artist often holds a recurring slot ("every
// Wednesday at Venue A for the next 3 months"). Rather than hand-enter ~13
// dates, they log the rule and we expand it to individual booked nights so the
// existing availability check (which reads Gig rows by date) just works.
//
// Dates use the whole-codebase NOON-UTC convention (a local calendar date is
// stored at T12:00:00Z so the ISO-day slice is timezone-stable), so a date's
// weekday is read via getUTCDay on the noon-UTC instant.

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// A sane ceiling so a huge/mistyped range can't create thousands of rows
// (~14 months of a weekly slot).
export const MAX_RESIDENCY_DATES = 60;

const DAY_MS = 24 * 3600 * 1000;

/**
 * Every date (YYYY-MM-DD) matching `weekday` (0=Sun..6=Sat) within
 * [fromISO, toISO] inclusive. Empty for a bad/empty range; capped at
 * MAX_RESIDENCY_DATES.
 */
export function residencyDates(weekday: number, fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return out;
  const start = new Date(`${fromISO}T12:00:00Z`);
  const end = new Date(`${toISO}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return out;

  for (let t = start.getTime(); t <= end.getTime() && out.length < MAX_RESIDENCY_DATES; t += DAY_MS) {
    const d = new Date(t);
    if (d.getUTCDay() === weekday) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
