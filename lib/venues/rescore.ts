import { db } from "@/lib/db";
import { scoreVenue, type MatchProfile, type ScorableSignal } from "@/lib/venues/score";
import { computeTimingScore } from "@/lib/venues/timing";
import type { VenueKind, VenueTemperature } from "@/app/generated/prisma/enums";

/**
 * Feed hygiene (P8.8) — scores used to FREEZE at last ingest: a June "HOT
 * opening, deciding now" card still said so in September, teaching artists to
 * distrust the numbers. Every scan now re-scores the live feed from stored
 * signals (pure functions — DB cost only, zero Serper/LLM), and stale HOT
 * openings arc down to WARM once the opening moment has clearly passed.
 */

/** HOT's premise is "deciding NOW" — 60 days without a fresh signal ends it. */
const HOT_STALE_MS = 60 * 24 * 3600 * 1000;

/** Kinds this tenant skipped 2+ times as WRONG_VIBE (P8.9's training signal). */
export async function downweightedKinds(businessId: string): Promise<VenueKind[]> {
  const groups = await db.venue.groupBy({
    by: ["kind"],
    where: { businessId, status: "SUPPRESSED", suppressedReason: "WRONG_VIBE" },
    _count: { kind: true },
  });
  return groups.filter((g) => g._count.kind >= 2).map((g) => g.kind);
}

/** 12.4: silence this long after a pitch = fair to knock again. */
export const RETOUCH_MS = 180 * 24 * 3600 * 1000;

export type RescoreResult = { rescored: number; arcedToWarm: number; retouched: number };

export async function rescoreVenues(businessId: string, now = new Date()): Promise<RescoreResult> {
  const result: RescoreResult = { rescored: 0, arcedToWarm: 0, retouched: 0 };

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { genres: true, eventTypes: true, serviceCities: true, acceptsTravel: true },
  });
  if (!business) return result;

  const profile: MatchProfile = {
    ...business,
    downweightKinds: await downweightedKinds(businessId),
  };

  // The live feed only — anything pitched/suppressed/dead keeps its snapshot.
  const venues = await db.venue.findMany({
    where: { businessId, status: { in: ["DISCOVERED", "QUALIFIED", "PITCH_DRAFTED"] } },
    include: { signals: { select: { type: true, observedAt: true } } },
  });

  for (const venue of venues) {
    const signals: ScorableSignal[] = venue.signals;
    const lastSignalAt = signals.length
      ? new Date(Math.max(...signals.map((s) => s.observedAt.getTime())))
      : venue.createdAt;

    // Stale-HOT arc: the opening decided its program long ago — it's now an
    // operating venue that buys entertainment, i.e. WARM by definition.
    const arcToWarm =
      venue.temperature === "HOT" && now.getTime() - lastSignalAt.getTime() > HOT_STALE_MS;
    const temperature: VenueTemperature = arcToWarm ? "WARM" : venue.temperature;

    const score = scoreVenue(
      {
        name: venue.name,
        city: venue.city,
        country: venue.country,
        kind: venue.kind,
        bookingEmail: venue.bookingEmail,
        travelWindowId: venue.travelWindowId,
      },
      signals,
      profile,
      now,
    );
    const timingScore = computeTimingScore(
      { temperature, signals, entertainmentEvidence: venue.entertainmentEvidence },
      now,
    );

    const changed =
      score.fitScore !== venue.fitScore ||
      timingScore !== venue.timingScore ||
      temperature !== venue.temperature ||
      (score.caution ?? null) !== venue.caution;
    if (!changed) continue;

    await db.venue.update({
      where: { id: venue.id },
      data: {
        fitScore: score.fitScore,
        fitReasons: score.reasons,
        caution: score.caution ?? null,
        timingScore,
        temperature,
      },
    });
    result.rescored++;
    if (arcToWarm) result.arcedToWarm++;
  }

  // 12.4 re-touch arc: a venue pitched 180+ days ago that never replied
  // returns to the feed as WARM AGAIN — the residency game is long, and six
  // silent months make a second knock polite, not pushy. QUALIFIED is
  // draftable (draft-pitch guard), retouchedAt drives the card's chip, and
  // the arc can't repeat (status leaves PITCHED). Replied venues never arc —
  // a live conversation is the owner's to run.
  const retouch = await db.venue.updateMany({
    where: {
      businessId,
      status: "PITCHED",
      repliedAt: null,
      pitchedAt: { lt: new Date(now.getTime() - RETOUCH_MS) },
    },
    data: { status: "QUALIFIED", temperature: "WARM", retouchedAt: now },
  });
  result.retouched = retouch.count;

  return result;
}
