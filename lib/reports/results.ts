// The "Results" proof surface (dashboard) — the live, in-app counterpart to the
// weekly email (lib/reports/weekly.ts). It proves the agent earned its keep:
// both halves of the product — the proactive HUNT (venues found, pitches sent,
// conversations opened) and the reactive INBOUND (inquiries answered, how fast,
// spam filtered, booked). Honest metrics only — everything here is something the
// agent actually DID; we never invent outcomes.
//
// Two windows: THIS MONTH (the cap/billing period the owner lives in) and ALL
// TIME (the cumulative trophy case). Pure aggregation over real rows.
import { db } from "@/lib/db";
import { monthStart } from "@/lib/billing/metering";

export interface ResultsSummary {
  /** First day the data covers (monthStart) — for the "since {date}" label. */
  monthStart: Date;

  // --- This month (since monthStart) ---
  /** Real (non-spam) inquiries that arrived. */
  newInquiries: number;
  /** Spam/scams filtered before the owner ever saw them — the silent gift. */
  spamFiltered: number;
  /** Replies actually sent (outbound messages). */
  repliesSent: number;
  /** Median minutes from inquiry → first reply (the speed-to-lead proof), or null. */
  medianFirstReplyMinutes: number | null;
  /** Conversations currently live (a prospect wrote back). */
  conversationsActive: number;
  /** Venues the Hunt surfaced this month. */
  venuesFound: number;
  /** Pitches the Hunt sent (from the owner's own mailbox) this month. */
  pitchesSent: number;
  /** Gigs booked this month. */
  gigsBookedThisMonth: number;

  // --- All time (the cumulative trophy case) ---
  gigsBookedAllTime: number;
  venuesFoundAllTime: number;
  pitchesSentAllTime: number;
}

export async function computeResults(businessId: string, now = new Date()): Promise<ResultsSummary> {
  const since = monthStart(now);

  const [
    newInquiries,
    spamFiltered,
    repliesSent,
    repliedLeads,
    conversationsActive,
    venuesFound,
    pitchesSent,
    gigsBookedThisMonth,
    gigsBookedAllTime,
    venuesFoundAllTime,
    pitchesSentAllTime,
  ] = await Promise.all([
    db.lead.count({ where: { businessId, createdAt: { gte: since }, status: { not: "SPAM" } } }),
    db.lead.count({ where: { businessId, createdAt: { gte: since }, status: "SPAM" } }),
    db.message.count({
      where: { lead: { businessId }, direction: "OUTBOUND", createdAt: { gte: since } },
    }),
    db.lead.findMany({
      where: { businessId, firstReplyAt: { gte: since } },
      select: { createdAt: true, firstReplyAt: true },
    }),
    db.lead.count({ where: { businessId, status: "ENGAGED" } }),
    db.venue.count({ where: { businessId, createdAt: { gte: since } } }),
    db.venuePitch.count({ where: { businessId, sentAt: { gte: since } } }),
    db.lead.count({ where: { businessId, bookedAt: { gte: since } } }),
    db.lead.count({ where: { businessId, bookedAt: { not: null } } }),
    db.venue.count({ where: { businessId } }),
    db.venuePitch.count({ where: { businessId, sentAt: { not: null } } }),
  ]);

  // Median first-reply time (minutes) over leads first-replied this month.
  const medianFirstReplyMinutes = medianReplyMinutes(repliedLeads);

  return {
    monthStart: since,
    newInquiries,
    spamFiltered,
    repliesSent,
    medianFirstReplyMinutes,
    conversationsActive,
    venuesFound,
    pitchesSent,
    gigsBookedThisMonth,
    gigsBookedAllTime,
    venuesFoundAllTime,
    pitchesSentAllTime,
  };
}

/** Median inquiry→first-reply gap in whole minutes; null when no data (honesty). */
export function medianReplyMinutes(
  rows: { createdAt: Date; firstReplyAt: Date | null }[],
): number | null {
  const minutes = rows
    .filter((r) => r.firstReplyAt)
    .map((r) => (r.firstReplyAt!.getTime() - r.createdAt.getTime()) / 60000)
    .sort((a, b) => a - b);
  return minutes.length ? Math.round(minutes[Math.floor(minutes.length / 2)]) : null;
}

/** Has the agent done anything yet? Drives the empty-state vs the metric grid. */
export function hasResults(r: ResultsSummary): boolean {
  return (
    r.newInquiries > 0 ||
    r.repliesSent > 0 ||
    r.venuesFound > 0 ||
    r.pitchesSent > 0 ||
    r.gigsBookedAllTime > 0 ||
    r.venuesFoundAllTime > 0
  );
}

/** Human "median first reply" phrasing (shared shape with the weekly email). */
export function formatReplyTime(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hr`;
  return `${Math.round(minutes / (60 * 24))} d`;
}
