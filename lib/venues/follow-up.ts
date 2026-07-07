import { db } from "@/lib/db";
import { isAgentPaused } from "@/lib/billing/metering";
import { jurisdictionFor } from "@/lib/outreach/jurisdiction";
import { capFor, startOfTenantDay } from "@/lib/outreach/caps";
import type { Business } from "@/app/generated/prisma/client";

/**
 * The one polite HOT follow-up (P8.4). Research: a single bump ~6 days after
 * an unanswered cold email roughly doubles reply rates — and persistence is
 * the stated value of an agent over human willpower. The rails make it safe:
 *
 *  - HOT pitches only (WARM/SEED never follow up — 10.2c product law).
 *  - STANDARD jurisdictions only (CONSENT/STRICT are copy-and-send lands).
 *  - Exactly ONE follow-up per pitch, ever (self-relation is the marker).
 *  - Venue must still be sitting in PITCHED — a reply flips it to REPLIED via
 *    reply capture (P8.3) and a suppression takes it out entirely, so both
 *    stop the bump without any extra machinery.
 *  - Approval-gated: the bump lands as a PENDING pitch in the same queue;
 *    nothing sends without the artist's tap (or their autonomy settings).
 *  - Counts against the HOT daily creation cap like any other pitch.
 *
 * The body is DETERMINISTIC — a short, human bump referencing the original.
 * No LLM: a two-line nudge is a solved problem, costs nothing, and can't
 * hallucinate. The original pitch carried the substance.
 */
const FOLLOW_UP_AFTER_MS = 6 * 24 * 3600 * 1000;

export type FollowUpResult = { drafted: number };

function followUpBody(venueName: string, ownerName: string): string {
  return [
    `Just floating this back to the top of your inbox — I know how fast it fills.`,
    ``,
    `Everything in my last note still stands, and the dates I mentioned are still open as of today. If the timing's wrong, a one-line "not now" is genuinely welcome and I'll leave it there.`,
    ``,
    `Either way — good luck with everything at ${venueName}.`,
    ``,
    ownerName,
  ].join("\n");
}

export async function draftHotFollowUps(business: Business, now = new Date()): Promise<FollowUpResult> {
  const result: FollowUpResult = { drafted: 0 };
  if (isAgentPaused(business.plan)) return result;

  // Candidates: HOT, SENT ≥6 days, no follow-up child yet, venue still in
  // PITCHED (replies/suppression have moved on otherwise).
  const due = await db.venuePitch.findMany({
    where: {
      businessId: business.id,
      temperature: "HOT",
      status: "SENT",
      followUpOfId: null, // never bump a bump
      followUps: { none: {} },
      sentAt: { lte: new Date(now.getTime() - FOLLOW_UP_AFTER_MS) },
      venue: { status: "PITCHED" },
    },
    include: { venue: true },
    orderBy: { sentAt: "asc" },
    take: 10,
  });

  for (const pitch of due) {
    const venue = pitch.venue;
    // STANDARD only — the bump auto-queues; consent regimes stay hands-on.
    if (jurisdictionFor(venue.country).mode !== "STANDARD") continue;
    if (!venue.bookingEmail) continue;

    const suppressed = await db.outreachSuppression.findUnique({
      where: {
        businessId_email: { businessId: business.id, email: venue.bookingEmail.toLowerCase() },
      },
      select: { id: true },
    });
    if (suppressed) continue;

    // HOT daily creation cap includes follow-ups — same budget, same day.
    const createdToday = await db.venuePitch.count({
      where: {
        businessId: business.id,
        temperature: "HOT",
        createdAt: { gte: startOfTenantDay(now, business.timezone) },
      },
    });
    if (createdToday >= capFor("HOT")) break;

    await db.venuePitch.create({
      data: {
        venueId: venue.id,
        businessId: business.id,
        followUpOfId: pitch.id,
        subject: `Re: ${pitch.subject}`,
        body: followUpBody(venue.name, business.ownerName),
        language: pitch.language,
        jurisdictionMode: "STANDARD",
        temperature: "HOT",
        model: "deterministic-follow-up",
      },
    });
    result.drafted++;
  }
  return result;
}
