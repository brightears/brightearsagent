import type { Availability } from "@/lib/agent/types";

export interface GigOnDate {
  date: Date;
  title: string;
  performerId: string | null;
}

export interface PerformerRef {
  id: string;
  name: string;
  active: boolean;
}

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

  // Solo op (or unassigned gig blocking the whole business): any gig = conflict.
  if (active.length <= 1 || hasUnassignedGig) {
    return { state: "conflict", bookedTitles: dayGigs.map((g) => g.title) };
  }

  const free = active.filter((p) => !bookedIds.has(p.id));
  if (free.length === 0) {
    return { state: "conflict", bookedTitles: dayGigs.map((g) => g.title) };
  }
  return { state: "partial", freePerformers: free.map((p) => p.name) };
}
