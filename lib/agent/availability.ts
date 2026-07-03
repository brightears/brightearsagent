import type { Availability } from "@/lib/agent/types";

export interface GigOnDate {
  date: Date;
  title: string;
  performerId: string | null;
  startTime?: string | null; // "HH:MM" (24h); null = all-day booking
  endTime?: string | null;
}

export interface PerformerRef {
  id: string;
  name: string;
  active: boolean;
}

/** "18:00" → "6:00 PM". Returns the input unchanged if unparseable. */
function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(Number.isNaN(m) ? 0 : m).padStart(2, "0")} ${period}`;
}

/** A gig's busy window in plain language ("6:00 PM–9:00 PM"), for the drafter. */
export function formatWindow(g: GigOnDate): string {
  if (!g.startTime) return g.title;
  const start = to12h(g.startTime);
  return g.endTime ? `${start}–${to12h(g.endTime)}` : `from ${start}`;
}

/** True when every gig has a start time (a windowed commitment, not all-day). */
const allTimed = (gigs: GigOnDate[]) => gigs.length > 0 && gigs.every((g) => !!g.startTime);

/**
 * Date convention (whole codebase): event dates are stored as NOON UTC of the
 * local calendar date (seed, parsers, pipeline all follow this), so date-only
 * comparison via the ISO day slice is timezone-stable for any tenant tz.
 */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Multi-performer availability: free if nobody's booked that day; partial if
 * some performers are booked but others are free; conflict if the business is
 * fully committed (every performer booked, or any unassigned gig for a solo op).
 */
export function checkAvailability(
  eventDate: string | null | undefined, // YYYY-MM-DD
  gigs: GigOnDate[],
  performers: PerformerRef[],
): Availability {
  if (!eventDate) return { state: "unknown" };

  const dayGigs = gigs.filter((g) => isoDay(g.date) === eventDate);
  if (dayGigs.length === 0) return { state: "free" };

  const active = performers.filter((p) => p.active);
  const bookedIds = new Set(dayGigs.map((g) => g.performerId).filter(Boolean) as string[]);
  const hasUnassignedGig = dayGigs.some((g) => !g.performerId);

  // Solo op (or an unassigned gig blocking the whole business): the day is
  // committed — UNLESS every commitment is a timed window (e.g. a 7-9pm
  // residency), in which case the artist may well be free around it, so we
  // surface the windows rather than declare a hard conflict.
  if (active.length <= 1 || hasUnassignedGig) {
    if (allTimed(dayGigs)) return { state: "timed", busyWindows: dayGigs.map(formatWindow) };
    return { state: "conflict", bookedTitles: dayGigs.map((g) => g.title) };
  }

  const free = active.filter((p) => !bookedIds.has(p.id));
  if (free.length > 0) return { state: "partial", freePerformers: free.map((p) => p.name) };

  // Every performer is booked — timed if all windowed, else a hard conflict.
  if (allTimed(dayGigs)) return { state: "timed", busyWindows: dayGigs.map(formatWindow) };
  return { state: "conflict", bookedTitles: dayGigs.map((g) => g.title) };
}
