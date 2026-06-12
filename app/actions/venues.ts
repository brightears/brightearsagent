"use server";

// Venue-opportunity feed actions (Phase 10.3/10.4, ADR-004) — tenant-scoped
// via getCurrentBusiness, zod-validated, never trusting the UI: the hunting
// license (profileStrength().canPitch) is re-checked server-side before any
// pitch is generated.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { profileStrength } from "@/lib/profile/strength";
import { isSkipReason, SKIP_REASONS } from "@/lib/venues/feed";
import { jurisdictionFor } from "@/lib/outreach/jurisdiction";
import {
  epkUrlFor,
  generateVenuePitch,
  pitchLanguageFor,
  type VenuePitchRequest,
} from "@/lib/agent/venue-pitch";

type ActionResult = { ok: true } | { ok: false; error: string };

const venueIdSchema = z.string().trim().min(1, "No venue given").max(64);
const pitchIdSchema = z.string().trim().min(1, "No pitch given").max(64);

/** The venue, only if it belongs to the current tenant. */
async function findTenantVenue(businessId: string, venueId: string) {
  return db.venue.findFirst({ where: { id: venueId, businessId } });
}

/**
 * Draft a REAL pitch for a venue (Phase 10.3): license check → suppression
 * check → dedupe → generate in the artist's voice (lib/agent/venue-pitch,
 * metered as "venuePitch") → persist PENDING VenuePitch → venue becomes
 * PITCH_DRAFTED. User-initiated, so we await the LLM (no fire-and-forget);
 * LLM failures come back as a friendly form error, never a crash.
 */
export async function draftVenuePitch(venueId: string): Promise<ActionResult> {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return { ok: false, error: "No venue given" };

  const business = await getCurrentBusiness();

  // The hunting license, enforced server-side (never trust the UI): a weak
  // pitch burns the venue contact forever, so no license = no pitch.
  const [activePackages, gigs] = await Promise.all([
    db.package.count({ where: { businessId: business.id, active: true } }),
    db.gig.count({ where: { businessId: business.id } }),
  ]);
  const strength = profileStrength(business, { activePackages, gigs });
  if (!strength.canPitch) {
    return { ok: false, error: "Finish your profile before the agent may pitch" };
  }

  const venue = await db.venue.findFirst({
    where: { id: parsed.data, businessId: business.id },
    include: {
      signals: { orderBy: { observedAt: "desc" }, take: 5 },
    },
  });
  if (!venue) return { ok: false, error: "Venue not found" };
  if (venue.status !== "DISCOVERED" && venue.status !== "QUALIFIED" && venue.status !== "PITCH_DRAFTED") {
    return { ok: false, error: "This venue is past the pitch stage" };
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
      return { ok: false, error: "This contact is on your do-not-contact list" };
    }
  }

  // Dedupe guard: one live (PENDING or parked APPROVED) pitch per venue —
  // double-submit, retries and stale UI all land here as a quiet no-op.
  const existingLive = await db.venuePitch.findFirst({
    where: { venueId: venue.id, status: { in: ["PENDING", "APPROVED"] } },
    select: { id: true },
  });
  if (existingLive) return { ok: true };

  const jurisdiction = jurisdictionFor(venue.country);
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
      feeFloor: business.feeFloor,
      feeSweetSpot: business.feeSweetSpot,
      reviewQuotes: business.reviewQuotes,
      notableVenues: business.notableVenues,
    },
    venue: {
      name: venue.name,
      city: venue.city,
      country: venue.country,
      kind: venue.kind,
      signals: venue.signals.map((s) => s.summary),
      fitReasons: venue.fitReasons,
    },
    epkUrl: epkUrlFor(business.slug),
    language: pitchLanguageFor(venue.country, business.pitchLanguages),
  };

  let pitch: Awaited<ReturnType<typeof generateVenuePitch>>;
  try {
    pitch = await generateVenuePitch(req);
  } catch {
    return { ok: false, error: "The pitch didn't come together — give it another try in a moment" };
  }

  await db.$transaction([
    db.venuePitch.create({
      data: {
        venueId: venue.id,
        businessId: business.id,
        subject: pitch.subject,
        body: pitch.body,
        language: req.language,
        jurisdictionMode: jurisdiction.mode,
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

  revalidatePath("/dashboard");
  return { ok: true };
}

/** The pitch, only if it belongs to the current tenant (with its venue). */
async function findTenantPitch(businessId: string, pitchId: string) {
  return db.venuePitch.findFirst({
    where: { id: pitchId, businessId },
    include: { venue: { select: { id: true, name: true, status: true } } },
  });
}

/**
 * Approve a PENDING pitch: it parks as APPROVED (the venue stays
 * PITCH_DRAFTED, card badge "Ready to send"). Actual sending is 10.5 —
 * Gmail/Microsoft OAuth — so nothing leaves the building here. The
 * jurisdiction footer is appended at send/copy time from jurisdictionMode,
 * never stored in the editable body (drafts.ts footer-at-send pattern).
 */
export async function approveVenuePitch(pitchId: string): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };

  const business = await getCurrentBusiness();
  const updated = await db.venuePitch.updateMany({
    where: { id: parsed.data, businessId: business.id, status: "PENDING" },
    data: { status: "APPROVED", decidedAt: new Date() },
  });
  if (updated.count === 0) return { ok: false, error: "Pitch not pending" };

  revalidatePath("/dashboard");
  return { ok: true };
}

const editPitchSchema = z.object({
  pitchId: pitchIdSchema,
  subject: z.string().trim().min(1, "Subject can't be empty").max(120),
  body: z.string().trim().min(1, "Body can't be empty").max(4000),
});

/**
 * Save owner edits on a PENDING pitch (editedSubject/editedBody — the voice-
 * tuning signal, same pattern as Draft.editedBody). Approval is separate.
 */
export async function editVenuePitch(
  pitchId: string,
  subject: string,
  body: string,
): Promise<ActionResult> {
  const parsed = editPitchSchema.safeParse({ pitchId, subject, body });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid edit" };
  }

  const business = await getCurrentBusiness();
  const updated = await db.venuePitch.updateMany({
    where: { id: parsed.data.pitchId, businessId: business.id, status: "PENDING" },
    data: { editedSubject: parsed.data.subject, editedBody: parsed.data.body },
  });
  if (updated.count === 0) return { ok: false, error: "Pitch not pending" };

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Discard a pitch (PENDING or parked APPROVED): pitch → DISCARDED, venue back
 * to DISCOVERED so it can be re-drafted later (pitch history is kept).
 */
export async function discardVenuePitch(pitchId: string): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };

  const business = await getCurrentBusiness();
  const pitch = await findTenantPitch(business.id, parsed.data);
  if (!pitch) return { ok: false, error: "Pitch not found" };
  if (pitch.status !== "PENDING" && pitch.status !== "APPROVED") {
    return { ok: false, error: "This pitch is already settled" };
  }

  await db.$transaction([
    db.venuePitch.update({
      where: { id: pitch.id },
      data: { status: "DISCARDED", decidedAt: new Date() },
    }),
    db.venue.updateMany({
      where: { id: pitch.venue.id, businessId: business.id, status: "PITCH_DRAFTED" },
      data: { status: "DISCOVERED" },
    }),
  ]);

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * One-tap skip: SUPPRESSED + reason (feeds the future matching tuner), and if
 * the venue has a published booking email it joins the per-tenant master
 * do-not-contact list (OutreachSuppression). Idempotent — re-skipping a
 * suppressed venue is a no-op success.
 */
export async function skipVenue(venueId: string, reason: string): Promise<ActionResult> {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return { ok: false, error: "No venue given" };
  if (!isSkipReason(reason)) return { ok: false, error: "Unknown skip reason" };

  const business = await getCurrentBusiness();
  const venue = await findTenantVenue(business.id, parsed.data);
  if (!venue) return { ok: false, error: "Venue not found" };

  if (venue.status !== "SUPPRESSED") {
    await db.venue.update({
      where: { id: venue.id },
      data: { status: "SUPPRESSED", suppressedReason: reason },
    });
  }

  // Master suppression list — email ALWAYS lowercased (schema contract).
  // Upsert keeps this idempotent; an existing entry's original reason wins.
  if (venue.bookingEmail) {
    const email = venue.bookingEmail.toLowerCase();
    await db.outreachSuppression.upsert({
      where: { businessId_email: { businessId: business.id, email } },
      create: {
        businessId: business.id,
        email,
        reason: `owner-skip:${SKIP_REASONS[reason]}`,
      },
      update: {},
    });
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (form `action` must return void). */
export async function skipVenueForm(venueId: string, reason: string): Promise<void> {
  await skipVenue(venueId, reason);
}
