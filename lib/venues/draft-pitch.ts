import { db } from "@/lib/db";
import { isAgentPaused } from "@/lib/billing/metering";
import { profileStrength } from "@/lib/profile/strength";
import { jurisdictionFor } from "@/lib/outreach/jurisdiction";
import { capError, capFor, startOfTenantDay } from "@/lib/outreach/caps";
import {
  epkUrlFor,
  formatTravelDateRange,
  generateVenuePitch,
  pitchLanguageFor,
  type VenuePitchRequest,
} from "@/lib/agent/venue-pitch";
import type { Business } from "@/app/generated/prisma/client";

export type DraftPitchResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string; reason: "paused" | "license" | "cap" | "state" | "llm" };

/**
 * The pitch-drafting core, extracted from app/actions/venues.ts (P8.1) so the
 * nightly auto-draft can call it WITHOUT a Clerk session. Every guard the
 * user-initiated path had runs here identically — pause, hunting license,
 * suppression, live-pitch dedupe, per-temperature daily caps (checked BEFORE
 * the LLM spends), jurisdiction, SEED no-follow-up snapshot. Drafting is
 * autonomy-safe on every tier: a draft is not a send.
 *
 * Caller owns tenant resolution (server action: getCurrentBusiness; cron: its
 * own fetch) and any revalidatePath.
 */
export async function draftPitchForVenue(business: Business, venueId: string): Promise<DraftPitchResult> {
  if (isAgentPaused(business.plan)) {
    return { ok: false, error: "Your agent is paused — subscribe to switch it on", reason: "paused" };
  }

  // The hunting license, enforced server-side (never trust the UI): a weak
  // pitch burns the venue contact forever, so no license = no pitch.
  const [activePackages, gigs] = await Promise.all([
    db.package.count({ where: { businessId: business.id, active: true } }),
    db.gig.count({ where: { businessId: business.id } }),
  ]);
  const strength = profileStrength(business, { activePackages, gigs });
  if (!strength.canPitch) {
    return { ok: false, error: "Finish your profile before the agent may pitch", reason: "license" };
  }

  const venue = await db.venue.findFirst({
    where: { id: venueId, businessId: business.id },
    include: {
      signals: { orderBy: { observedAt: "desc" }, take: 5 },
      // Travel Mode: if this venue was found for a travel window, the pitch must
      // be date-bounded to that window's city + dates (never open-ended).
      travelWindow: { select: { city: true, startDate: true, endDate: true } },
    },
  });
  if (!venue) return { ok: false, error: "Venue not found", reason: "state" };
  if (venue.status !== "DISCOVERED" && venue.status !== "QUALIFIED" && venue.status !== "PITCH_DRAFTED") {
    return { ok: false, error: "This venue is past the pitch stage", reason: "state" };
  }

  // Master do-not-contact list (ADR-004 hard cap) — checked before generating,
  // not just before sending: never even draft toward a suppressed contact.
  if (venue.bookingEmail) {
    const suppressed = await db.outreachSuppression.findUnique({
      where: {
        businessId_email: { businessId: business.id, email: venue.bookingEmail.toLowerCase() },
      },
      select: { id: true },
    });
    if (suppressed) {
      return { ok: false, error: "This contact is on your do-not-contact list", reason: "state" };
    }
  }

  // Dedupe guard: one live (PENDING or parked APPROVED) pitch per venue —
  // double-submit, retries and stale UI all land here as a quiet no-op.
  const existingLive = await db.venuePitch.findFirst({
    where: { venueId: venue.id, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true },
  });
  if (existingLive) return { ok: true, created: false };

  // Daily pitch-creation cap by temperature (10.2c, ADR-004 spam discipline):
  // count = VenuePitch rows created today in the TENANT's timezone (CLAUDE.md
  // rule 9). Checked before the LLM spends tokens.
  const createdToday = await db.venuePitch.count({
    where: {
      businessId: business.id,
      temperature: venue.temperature,
      createdAt: { gte: startOfTenantDay(new Date(), business.timezone) },
    },
  });
  if (createdToday >= capFor(venue.temperature)) {
    return { ok: false, error: capError(venue.temperature), reason: "cap" };
  }

  const jurisdiction = jurisdictionFor(venue.country);
  // 12.9 draw-proof: real calendar volume, last 90 days — grounded ammo only.
  const recentGigs90d = await db.gig.count({
    where: {
      businessId: business.id,
      date: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000), lte: new Date() },
    },
  });
  const req: VenuePitchRequest = {
    business: {
      id: business.id,
      name: business.name,
      ownerName: business.ownerName,
      performerKind: business.performerKind,
      voiceSamples: business.voiceSamples,
      headline: business.headline,
      bio: business.bio,
      genres: business.genres,
      eventTypes: business.eventTypes,
      serviceCities: business.serviceCities,
      gigTypes: business.gigTypes,
      riderNotes: business.riderNotes,
      feeFloor: business.feeFloor,
      feeSweetSpot: business.feeSweetSpot,
      reviewQuotes: business.reviewQuotes,
      notableVenues: business.notableVenues,
      recentGigs90d,
    },
    venue: {
      name: venue.name,
      city: venue.city,
      country: venue.country,
      kind: venue.kind,
      // 10.2c: temperature picks the template (HOT date-ask / WARM rotation
      // intro / SEED file-me-away); evidence is the only program grounding.
      temperature: venue.temperature,
      signals: venue.signals.map((s) => s.summary),
      entertainmentEvidence: venue.entertainmentEvidence,
      fitReasons: venue.fitReasons,
      // Travel Mode: a date-bounded pitch when this venue came from a travel
      // window — the artist is in town only for these dates.
      travelWindow: venue.travelWindow
        ? {
            city: venue.travelWindow.city,
            dateRange: formatTravelDateRange(
              venue.travelWindow.startDate,
              venue.travelWindow.endDate,
            ),
          }
        : undefined,
    },
    epkUrl: epkUrlFor(business.slug),
    language: pitchLanguageFor(venue.country, business.pitchLanguages),
  };

  let pitch: Awaited<ReturnType<typeof generateVenuePitch>>;
  try {
    pitch = await generateVenuePitch(req);
  } catch {
    return {
      ok: false,
      error: "The pitch didn't come together — give it another try in a moment",
      reason: "llm",
    };
  }

  // SEQUENCING GUARD (10.2c): WARM and SEED pitches NEVER enter any follow-up
  // sequence. The existing reactive sequences (SequenceRun) are lead-bound, so
  // a venue pitch can't ride them today — but the rule is product law, not an
  // accident of schema: one polite intro, then silence (one re-touch allowed
  // after 180 days; that engine is deferred — we only store the temperature
  // snapshot here so it can enforce the rule later). Any future venue-side
  // sequence engine MUST refuse temperature !== HOT.
  await db.$transaction([
    db.venuePitch.create({
      data: {
        venueId: venue.id,
        businessId: business.id,
        subject: pitch.subject,
        body: pitch.body,
        language: req.language,
        jurisdictionMode: jurisdiction.mode,
        temperature: venue.temperature, // snapshot at draft time (caps + guard)
        model: pitch.model,
      },
    }),
    // Status filter repeated in the WHERE so a double-submit can't regress a
    // venue that moved on between read and write.
    db.venue.updateMany({
      where: {
        id: venue.id,
        businessId: business.id,
        status: { in: ["DISCOVERED", "QUALIFIED", "PITCH_DRAFTED"] },
      },
      data: { status: "PITCH_DRAFTED" },
    }),
  ]);

  return { ok: true, created: true };
}
