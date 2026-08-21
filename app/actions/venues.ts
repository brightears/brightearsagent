"use server";

// Venue-opportunity feed actions (Phase 10.3/10.4, ADR-004) — tenant-scoped
// via getCurrentBusiness, zod-validated, never trusting the UI: the hunting
// license (profileStrength().canPitch) is re-checked server-side before any
// pitch is generated.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isAgentPaused } from "@/lib/billing/metering";
import {
  appendVoiceExample,
  isVenuePitchDiscardReason,
} from "@/lib/feedback/owner-controls";
import {
  isSkipReason,
  SKIP_REASONS,
  isInPlayStatus,
  isInPlayTargetStatus,
} from "@/lib/venues/feed";
import { jurisdictionFor, pitchFooter } from "@/lib/outreach/jurisdiction";
import { sentCapFor, sendCapError, startOfTenantDay, SEND_CAP_STATUSES } from "@/lib/outreach/caps";
import { outreachSuppressionScope } from "@/lib/outreach/suppression";
import { draftPitchForVenue } from "@/lib/venues/draft-pitch";
import {
  epkUrlFor,
  formatTravelDateRange,
  generateVenuePitch,
  isVenuePitchAutoSendLanguage,
  pitchLanguageFor,
  validateVenuePitch,
  type VenuePitchRequest,
} from "@/lib/agent/venue-pitch";
import { sendGmail, MailboxError } from "@/lib/outbound/gmail";
import {
  TEST_EMAIL_BANNER,
  TEST_EMAIL_STATIC_SAMPLE,
  testSendAllowed,
} from "@/lib/outreach/test-email";

type ActionResult =
  | { ok: true; voiceExampleSaved?: boolean }
  | { ok: false; error: string };

const venueIdSchema = z.string().trim().min(1, "No venue given").max(64);
const pitchIdSchema = z.string().trim().min(1, "No pitch given").max(64);

/** The venue, only if it belongs to the current tenant. */
async function findTenantVenue(businessId: string, venueId: string) {
  return db.venue.findFirst({ where: { id: venueId, businessId } });
}

// The SAME entitlement gate guards the reactive lead path and discovery scan:
// paid plans and an active invited beta may work; ordinary/expired TRIAL is
// blocked everywhere but may still browse the feed.
const TRIAL_ENDED = "Your agent is paused — subscribe to switch it on";

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

  // Core extracted to lib/venues/draft-pitch.ts (P8.1) so the nightly
  // auto-draft runs the IDENTICAL guard ladder without a Clerk session —
  // pause, license, suppression, dedupe, caps, jurisdiction all live there.
  const result = await draftPitchForVenue(business, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard");
  return { ok: true };
}

/** The pitch, only if it belongs to the current tenant (with its venue). */
async function findTenantPitch(businessId: string, pitchId: string) {
  return db.venuePitch.findFirst({
    where: { id: pitchId, businessId },
    include: {
      venue: {
        select: {
          id: true,
          name: true,
          country: true,
          status: true,
          bookingEmail: true,
        },
      },
    },
  });
}

/**
 * Approve a PENDING pitch: it parks as APPROVED (the venue stays
 * PITCH_DRAFTED, card badge "Ready to send"). Actual sending is 10.5 —
 * Google/Gmail OAuth — so nothing leaves the building here. The
 * jurisdiction footer is appended at send/copy time from jurisdictionMode,
 * never stored in the editable body (drafts.ts footer-at-send pattern).
 */
export async function approveVenuePitch(pitchId: string): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };

  const business = await getCurrentBusiness();
  const decidedAt = new Date();
  const updated = await db.venuePitch.updateMany({
    where: { id: parsed.data, businessId: business.id, status: "PENDING" },
    data: { status: "APPROVED", decidedAt },
  });
  if (updated.count === 0) return { ok: false, error: "Pitch not pending" };
  await db.venue.updateMany({
    where: { businessId: business.id, pitches: { some: { id: parsed.data } } },
    data: { reviewedAt: decidedAt },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Last-moment compliance check for every manual-handoff copy. Clipboard
 * handoff is not a Bright Ears transport, but it is still an outbound Hunt
 * path the product actively facilitates, so a product-wide or tenant stop must
 * block it just like Send now.
 */
export async function authorizeVenuePitchCopy(
  pitchId: string,
): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };

  const business = await getCurrentBusiness();
  if (!business.postalAddress?.trim()) {
    return {
      ok: false,
      error: "Add your business mailing address in Settings before copying venue outreach",
    };
  }
  const pitch = await findTenantPitch(business.id, parsed.data);
  if (!pitch) return { ok: false, error: "Pitch not found" };
  if (pitch.status !== "APPROVED") {
    return { ok: false, error: "Approve the pitch before copying it" };
  }
  if (!pitch.venue.bookingEmail) {
    return { ok: false, error: "No booking email on file for this venue" };
  }
  if (await outreachSuppressionScope(business.id, pitch.venue.bookingEmail)) {
    return { ok: false, error: "This contact is on your do-not-contact list" };
  }
  return { ok: true };
}

/**
 * Send an APPROVED pitch from the artist's OWN connected mailbox (Phase 10.5,
 * Gmail OAuth). EVERY guard runs server-side, in this exact order, each a hard
 * stop with a friendly error — the UI is never trusted:
 *
 *   1. tenant-scoped pitch lookup; status must be APPROVED (only APPROVED
 *      pitches send). Already-SENT or in-flight SENDING → idempotent no-op
 *      success (NEVER a second real email).
 *   2. mailbox CONNECTED for this tenant ("Connect your mailbox first").
 *   3. jurisdiction MUST be STANDARD — CONSENT/STRICT (GB/Canada/Germany/…)
 *      are review-and-copy handoffs; auto-send is REFUSED, and recording a
 *      manual send requires confirmation of consent or another lawful basis
 *      (ADR-004 D4 / lib/outreach/jurisdiction.ts).
 *   4. suppression re-check: the venue's bookingEmail must not be on the master
 *      do-not-contact list (re-checked here, not just at draft).
 *   5. daily SEND cap by temperature (count SENT + SENDING today, tenant tz —
 *      in-flight claims count so a burst can't blow the cap).
 *   6. ATOMIC CLAIM: APPROVED → SENDING via updateMany where status=APPROVED;
 *      count===1 wins, count===0 means someone else already claimed/sent it →
 *      friendly no-op (closes the double-send / TOCTOU window — only the winner
 *      crosses the network).
 *   7. build the email — body + the jurisdiction pitchFooter appended NOW (at
 *      send, never stored in the editable body) — send via lib/outbound/gmail.
 *   8. on success: pitch SENDING → SENT (sentAt, providerMessageId), venue →
 *      PITCHED (pitchedAt). On a send throw: revert SENDING → APPROVED so the
 *      owner can retry (except auth/permanent errors, where the transport has
 *      already flagged the mailbox ERROR — the pitch is left APPROVED to retry
 *      after reconnect). No LlmUsage write (no LLM here). revalidate.
 */
export async function sendVenuePitch(pitchId: string): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };

  const business = await getCurrentBusiness();

  // Only a paid plan may send. TRIAL is the unsubscribed/paused state, using
  // the same fail-closed gate as the reactive lead path.
  if (isAgentPaused(business)) {
    return { ok: false, error: TRIAL_ENDED };
  }
  const postalAddress = business.postalAddress?.trim();
  if (!postalAddress) {
    return {
      ok: false,
      error: "Add your business mailing address in Settings before sending venue outreach",
    };
  }

  // (1) Tenant-scoped lookup + status gate.
  const pitch = await db.venuePitch.findFirst({
    where: { id: parsed.data, businessId: business.id },
    include: {
      venue: {
        include: {
          signals: { orderBy: { observedAt: "desc" }, take: 5 },
          travelWindow: { select: { city: true, startDate: true, endDate: true } },
        },
      },
    },
  });
  if (!pitch) return { ok: false, error: "Pitch not found" };
  // Idempotency: an already-SENT pitch — or one currently SENDING (claimed by a
  // concurrent call) — is a friendly no-op, never a second real email.
  if (pitch.status === "SENT" || pitch.status === "SENDING") return { ok: true };
  if (pitch.status !== "APPROVED") {
    return { ok: false, error: "Approve the pitch before sending" };
  }
  const venue = pitch.venue;
  if (!venue.bookingEmail) {
    return { ok: false, error: "No booking email on file for this venue" };
  }

  // (2) Mailbox connected.
  const mailbox = await db.mailboxConnection.findUnique({
    where: { businessId: business.id },
    select: { status: true },
  });
  if (!mailbox || mailbox.status !== "CONNECTED") {
    return { ok: false, error: "Connect your mailbox first" };
  }

  // (3) Jurisdiction: STANDARD only. CONSENT/STRICT are review/copy handoffs;
  // manual transport is not a lawful basis and does not bypass this refusal.
  const jurisdiction = jurisdictionFor(venue.country);
  if (jurisdiction.mode !== "STANDARD") {
    return {
      ok: false,
      error: jurisdiction.note || "This jurisdiction is copy-and-send only — use the Copy button",
    };
  }
  if (!isVenuePitchAutoSendLanguage(pitch.language)) {
    return {
      ok: false,
      error: "Non-English pitches require your manual review and send",
    };
  }

  // (4) Suppression re-check (email always lowercased — schema contract).
  const email = venue.bookingEmail.toLowerCase();
  const suppressed = await outreachSuppressionScope(business.id, email);
  if (suppressed) {
    return { ok: false, error: "This contact is on your do-not-contact list" };
  }

  // Re-run the exact generation safety gate at the delivery boundary. This
  // protects legacy drafts created before the gate shipped and catches owner
  // edits that accidentally add a second ask, an invented commercial promise,
  // or open-ended travel availability. Normalization is deterministic (EPK
  // once, clean subject) and the normalized copy is what crosses the network.
  const travelWindow = venue.travelWindow
    ? {
        city: venue.travelWindow.city,
        dateRange: formatTravelDateRange(
          venue.travelWindow.startDate,
          venue.travelWindow.endDate,
        ),
      }
    : undefined;
  const checkedPitch = validateVenuePitch(
    {
      business: {
        id: business.id,
        name: business.name,
        ownerName: business.ownerName,
        performerKind: business.performerKind,
        headline: business.headline,
        bio: business.bio,
        genres: business.genres,
        eventTypes: business.eventTypes,
        serviceCities: business.serviceCities,
        gigTypes: business.gigTypes,
        riderNotes: business.riderNotes,
        reviewQuotes: business.reviewQuotes,
        notableVenues: business.notableVenues,
      },
      venue: {
        name: venue.name,
        city: venue.city,
        country: venue.country,
        kind: venue.kind,
        temperature: pitch.temperature,
        signals: venue.signals.map((signal) => signal.summary),
        entertainmentEvidence: venue.entertainmentEvidence,
        fitReasons: venue.fitReasons,
        travelWindow,
      },
      epkUrl: epkUrlFor(business.slug),
      language: pitch.language,
    },
    {
      subject: pitch.editedSubject ?? pitch.subject,
      body: pitch.editedBody ?? pitch.body,
    },
  );
  if (checkedPitch.issues.length > 0) {
    return {
      ok: false,
      error: "This pitch needs a fresh review before it can be sent",
    };
  }

  // (5) Daily SEND cap by temperature — count SENT + SENDING today in the
  // tenant's tz. Counting in-flight SENDING (not just delivered SENT) means a
  // burst of concurrent claims can't each pass a SENT-only check and blow the
  // cap. We bound the window with createdAt for SENDING rows (sentAt is null
  // until they land); a row counts if EITHER timestamp is today.
  const dayStart = startOfTenantDay(new Date(), business.timezone);
  const sentToday = await db.venuePitch.count({
    where: {
      businessId: business.id,
      temperature: pitch.temperature,
      status: { in: [...SEND_CAP_STATUSES] },
      OR: [{ sentAt: { gte: dayStart } }, { sentAt: null, updatedAt: { gte: dayStart } }],
    },
  });
  if (sentToday >= sentCapFor(pitch.temperature)) {
    return { ok: false, error: sendCapError(pitch.temperature) };
  }

  // (6) ATOMIC CLAIM — the heart of the double-send fix. Flip APPROVED →
  // SENDING in a single conditional write IMMEDIATELY before the network send.
  // Only one concurrent caller's updateMany matches (count===1); the loser sees
  // count===0 and returns a friendly no-op WITHOUT crossing the network, so a
  // TOCTOU race or a stale double-click can never send two real emails.
  const claim = await db.venuePitch.updateMany({
    where: { id: pitch.id, businessId: business.id, status: "APPROVED" },
    data: { status: "SENDING" },
  });
  if (claim.count === 0) {
    // Someone else claimed/sent it between our read and this write — no-op.
    return { ok: true };
  }

  // (5b) Post-claim recount: the pre-claim count (5) is check-then-claim — two
  // concurrent sends at cap-1 both pass it, both claim, and the cap is blown.
  // Recount with OUR claim included; if the claims oversubscribed the cap,
  // release ours back to APPROVED and refuse with the same at-cap error. At
  // most `cap` claims can see a compliant recount, so the cap holds.
  const sentIncludingClaim = await db.venuePitch.count({
    where: {
      businessId: business.id,
      temperature: pitch.temperature,
      status: { in: [...SEND_CAP_STATUSES] },
      OR: [{ sentAt: { gte: dayStart } }, { sentAt: null, updatedAt: { gte: dayStart } }],
    },
  });
  if (sentIncludingClaim > sentCapFor(pitch.temperature)) {
    await db.venuePitch.updateMany({
      where: { id: pitch.id, businessId: business.id, status: "SENDING" },
      data: { status: "APPROVED" },
    });
    return { ok: false, error: sendCapError(pitch.temperature) };
  }

  // (7) Build + send. The owner's edits win; the jurisdiction footer is
  // appended HERE (at send), never stored in the editable body.
  const subject = checkedPitch.result.subject;
  const body = checkedPitch.result.body +
    pitchFooter({
      mode: jurisdiction.mode,
      businessName: business.name,
      city: business.serviceCities[0] ?? "",
      postalAddress,
      venueName: venue.name,
    });

  let messageId: string;
  try {
    const result = await sendGmail(business.id, {
      toEmail: venue.bookingEmail,
      toName: venue.bookingContactName ?? undefined,
      subject,
      body,
      // Reply capture (P8.3, founder-approved 2026-07-07): venue replies route
      // to the tenant's parse address so they flow into the pipeline — status
      // flips, a drafted answer, a real reply-rate for the 10.9 gate. From
      // stays the artist's own Gmail; a venue that just hits Reply lands in
      // the machine instead of vanishing into an unwatched inbox.
      replyToEmail: `leads@${business.slug}.in.brightears.io`,
    });
    messageId = result.messageId;
  } catch (err) {
    // Send threw BEFORE any successful delivery — release the claim so the
    // owner can retry. (On an auth/permanent MailboxError the transport has
    // already flagged the mailbox ERROR; reverting to APPROVED is still correct
    // — the pitch waits, ready to retry once the mailbox is reconnected.)
    await db.venuePitch.updateMany({
      where: { id: pitch.id, businessId: business.id, status: "SENDING" },
      data: { status: "APPROVED" },
    });
    if (err instanceof MailboxError) return { ok: false, error: err.message };
    return { ok: false, error: "The send didn't go through — try again in a moment" };
  }

  // (8) Send SUCCEEDED — record it: pitch SENDING → SENT, venue → PITCHED.
  //
  // RESIDUAL WINDOW (documented honestly): if the process dies AFTER a
  // successful Gmail send but BEFORE this write lands, the pitch is stuck
  // SENDING — the email was delivered but not recorded. That is the SAFE
  // direction: a retry sees SENDING (step 1 idempotency guard) and REFUSES to
  // re-send, so we never double-email a venue. The sequence cron's read-only
  // recovery sweep surfaces SENDING claims older than 10 minutes with the
  // identifiers operators need to inspect Gmail Sent and logs. It deliberately
  // never mutates, reopens or resends an uncertain pitch.
  await db.$transaction([
    db.venuePitch.updateMany({
      where: { id: pitch.id, businessId: business.id, status: "SENDING" },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: messageId },
    }),
    db.venue.updateMany({
      where: { id: venue.id, businessId: business.id, status: "PITCH_DRAFTED" },
      data: { status: "PITCHED", pitchedAt: new Date() },
    }),
  ]);

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Record a copy-only pitch after the artist actually sent it themselves.
 * This is not a compliance bypass: consent-first jurisdictions require an
 * explicit lawful-basis confirmation, and the current address/suppression
 * gates are re-checked immediately before the atomic state transition.
 */
export async function recordManualVenuePitchSend(
  pitchId: string,
  lawfulBasisConfirmed = false,
): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };

  const business = await getCurrentBusiness();
  if (!business.postalAddress?.trim()) {
    return {
      ok: false,
      error: "Add your business mailing address in Settings before copying or sending venue outreach",
    };
  }

  const pitch = await findTenantPitch(business.id, parsed.data);
  if (!pitch) return { ok: false, error: "Pitch not found" };
  if (pitch.status === "SENT") return { ok: true };
  if (pitch.status !== "APPROVED") {
    return { ok: false, error: "Approve the pitch before recording a manual send" };
  }
  if (!pitch.venue.bookingEmail) {
    return { ok: false, error: "No booking email on file for this venue" };
  }

  const liveJurisdiction = jurisdictionFor(pitch.venue.country);
  const consentFirst =
    liveJurisdiction.mode !== "STANDARD" || pitch.jurisdictionMode !== "STANDARD";
  const manualReviewLanguage = !isVenuePitchAutoSendLanguage(pitch.language);
  if (!consentFirst && !manualReviewLanguage) {
    return { ok: false, error: "Use Send now for this fully validated pitch" };
  }
  if (consentFirst && !lawfulBasisConfirmed) {
    return {
      ok: false,
      error: "Confirm that you have consent or another lawful basis before recording this send",
    };
  }

  const email = pitch.venue.bookingEmail.toLowerCase();
  if (await outreachSuppressionScope(business.id, email)) {
    return { ok: false, error: "This contact is on your do-not-contact list" };
  }

  const sentAt = new Date();
  const conflict = "manual-venue-pitch-send-conflict";
  try {
    const recorded = await db.$transaction(async (tx) => {
      const claimed = await tx.venuePitch.updateMany({
        where: {
          id: pitch.id,
          businessId: business.id,
          status: "APPROVED",
          venue: { status: "PITCH_DRAFTED" },
        },
        data: { status: "SENT", sentAt },
      });
      if (claimed.count === 0) return false;
      const advanced = await tx.venue.updateMany({
        where: {
          id: pitch.venue.id,
          businessId: business.id,
          status: "PITCH_DRAFTED",
        },
        data: { status: "PITCHED", pitchedAt: sentAt },
      });
      if (advanced.count === 0) throw new Error(conflict);
      return true;
    });
    if (!recorded) {
      return { ok: false, error: "This pitch changed — refresh before recording the send" };
    }
  } catch (error) {
    if (error instanceof Error && error.message === conflict) {
      return { ok: false, error: "This pitch changed — refresh before recording the send" };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

const editPitchSchema = z.object({
  pitchId: pitchIdSchema,
  subject: z.string().trim().min(1, "Subject can't be empty").max(120),
  body: z.string().trim().min(1, "Body can't be empty").max(4000),
  saveVoiceExample: z.boolean(),
});

/**
 * Save owner edits on a PENDING pitch. Approval is separate. Editing alone
 * never changes the voice profile; an example is appended only when the owner
 * explicitly opts in, and at most once for a given pitch.
 */
export async function editVenuePitch(
  pitchId: string,
  subject: string,
  body: string,
  saveVoiceExample = false,
): Promise<ActionResult> {
  const parsed = editPitchSchema.safeParse({ pitchId, subject, body, saveVoiceExample });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid edit" };
  }

  const business = await getCurrentBusiness();
  const pitch = await db.venuePitch.findFirst({
    where: { id: parsed.data.pitchId, businessId: business.id, status: "PENDING" },
    select: {
      id: true,
      subject: true,
      body: true,
      voiceSampleSavedAt: true,
    },
  });
  if (!pitch) return { ok: false, error: "Pitch not pending" };

  const hasOwnerEdits =
    parsed.data.subject !== pitch.subject.trim() || parsed.data.body !== pitch.body.trim();
  const wantsVoiceExample =
    parsed.data.saveVoiceExample &&
    hasOwnerEdits &&
    !pitch.voiceSampleSavedAt;
  const savedAt = new Date();
  const outcome = await db.$transaction(async (tx) => {
    const current = wantsVoiceExample
      ? await tx.business.findUnique({
          where: { id: business.id },
          select: { voiceSamples: true },
        })
      : null;
    const nextVoiceSamples = current
      ? appendVoiceExample(current.voiceSamples, {
          kind: "venue pitch",
          subject: parsed.data.subject,
          body: parsed.data.body,
        })
      : null;
    const storesVoiceExample =
      !!current && nextVoiceSamples !== current.voiceSamples;
    const claimed = await tx.venuePitch.updateMany({
      where: { id: pitch.id, businessId: business.id, status: "PENDING" },
      data: {
        editedSubject: parsed.data.subject,
        editedBody: parsed.data.body,
        ...(storesVoiceExample ? { voiceSampleSavedAt: savedAt } : {}),
      },
    });
    if (claimed.count === 0) return { updated: false, voiceExampleSaved: false };
    if (storesVoiceExample) {
      await tx.business.update({
        where: { id: business.id },
        data: { voiceSamples: nextVoiceSamples },
      });
    }
    return { updated: true, voiceExampleSaved: storesVoiceExample };
  });
  if (!outcome.updated) return { ok: false, error: "Pitch not pending" };

  revalidatePath("/dashboard");
  return { ok: true, voiceExampleSaved: outcome.voiceExampleSaved };
}

/**
 * Discard a pitch (PENDING or parked APPROVED): pitch → DISCARDED, venue back
 * to DISCOVERED so it can be re-drafted later (pitch history is kept).
 */
export async function discardVenuePitch(
  pitchId: string,
  reason: string,
): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };
  if (!isVenuePitchDiscardReason(reason)) {
    return { ok: false, error: "Choose why you're discarding this draft" };
  }

  const business = await getCurrentBusiness();
  const pitch = await findTenantPitch(business.id, parsed.data);
  if (!pitch) return { ok: false, error: "Pitch not found" };
  if (pitch.status !== "PENDING" && pitch.status !== "APPROVED") {
    return { ok: false, error: "This pitch is already settled" };
  }

  const decidedAt = new Date();
  const discarded = await db.$transaction(async (tx) => {
    const claimed = await tx.venuePitch.updateMany({
      where: {
        id: pitch.id,
        businessId: business.id,
        status: { in: ["PENDING", "APPROVED"] },
      },
      data: { status: "DISCARDED", discardReason: reason, decidedAt },
    });
    if (claimed.count === 0) return false;
    await tx.venue.updateMany({
      where: { id: pitch.venue.id, businessId: business.id, status: "PITCH_DRAFTED" },
      data: { status: "DISCOVERED", reviewedAt: decidedAt },
    });
    return true;
  });
  if (!discarded) {
    return { ok: false, error: "This pitch changed — refresh and try again" };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * The structured beta-quality decision on an auto-drafted card.
 *
 * "Discard draft" above means the venue may still be useful and can receive a
 * better draft later. "Not a fit" means the opportunity itself is wrong:
 * settle the live pitch, suppress the venue and retain the exact owner reason
 * for the rolling Hunt-quality scorecard. Nothing is sent.
 */
export async function skipVenuePitch(
  pitchId: string,
  reason: string,
): Promise<ActionResult> {
  const parsed = pitchIdSchema.safeParse(pitchId);
  if (!parsed.success) return { ok: false, error: "No pitch given" };
  if (!isSkipReason(reason)) return { ok: false, error: "Unknown skip reason" };

  const business = await getCurrentBusiness();
  const pitch = await findTenantPitch(business.id, parsed.data);
  if (!pitch) return { ok: false, error: "Pitch not found" };
  if (pitch.status !== "PENDING" && pitch.status !== "APPROVED") {
    return { ok: false, error: "This pitch is already settled" };
  }

  const conflict = "venue-pitch-skip-conflict";
  const reviewedAt = new Date();
  try {
    await db.$transaction(async (tx) => {
      // Claim the decision before touching the venue. A concurrent send moves
      // APPROVED → SENDING, so this update fails and the transaction rolls back
      // instead of suppressing a pitch that just left the building.
      const decided = await tx.venuePitch.updateMany({
        where: {
          id: pitch.id,
          businessId: business.id,
          status: { in: ["PENDING", "APPROVED"] },
        },
        data: { status: "DISCARDED", decidedAt: reviewedAt },
      });
      if (decided.count === 0) throw new Error(conflict);

      const suppressed = await tx.venue.updateMany({
        where: {
          id: pitch.venue.id,
          businessId: business.id,
          status: "PITCH_DRAFTED",
        },
        data: { status: "SUPPRESSED", suppressedReason: reason, reviewedAt },
      });
      if (suppressed.count === 0) throw new Error(conflict);

      if (pitch.venue.bookingEmail) {
        const email = pitch.venue.bookingEmail.toLowerCase();
        await tx.outreachSuppression.upsert({
          where: { businessId_email: { businessId: business.id, email } },
          create: {
            businessId: business.id,
            email,
            reason: `owner-skip:${SKIP_REASONS[reason]}`,
          },
          update: {},
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === conflict) {
      return { ok: false, error: "This pitch changed — refresh and try again" };
    }
    throw error;
  }

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
      data: { status: "SUPPRESSED", suppressedReason: reason, reviewedAt: new Date() },
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

/**
 * Private venue field notes (P12.4): tenant-scoped, capped, plain text. The
 * notes never enter pitches or LLM prompts - dashboard memory only.
 */
export async function saveVenueNotesForm(venueId: string, formData: FormData): Promise<void> {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return;
  const business = await getCurrentBusiness();
  const raw = formData.get("staffNotes");
  const notes = typeof raw === "string" ? raw.trim().slice(0, 2000) : "";
  await db.venue.updateMany({
    where: { id: parsed.data, businessId: business.id },
    data: { staffNotes: notes || null },
  });
  revalidatePath("/dashboard");
}

/** Form-friendly wrapper (form `action` must return void). */
export async function skipVenueForm(venueId: string, reason: string): Promise<void> {
  const result = await skipVenue(venueId, reason);
  // Visible tuning ack (P10.2): a WRONG_VIBE skip actually teaches the hunt
  // (2+ same-kind skips downweight that kind - lib/venues/rescore.ts), so the
  // dashboard SAYS so. Silent learning reads as no learning.
  if (result.ok && reason === "WRONG_VIBE") {
    const business = await getCurrentBusiness();
    const venue = await db.venue.findFirst({
      where: { id: venueId, businessId: business.id },
      select: { kind: true },
    });
    if (venue) {
      const skips = await db.venue.count({
        where: {
          businessId: business.id,
          status: "SUPPRESSED",
          suppressedReason: "WRONG_VIBE",
          kind: venue.kind,
        },
      });
      redirect(`/dashboard?tuned=${venue.kind}&skips=${skips}`);
    }
  }
}

/**
 * Manual post-send venue tracking (audit C2). gmail.send is send-only — once a
 * pitch goes out there's no automated venue-reply capture — so the owner moves
 * a venue along by hand from the "In play" surface: PITCHED → REPLIED /
 * IN_CONVERSATION / BOOKED / DEAD. Tenant-scoped, status-gated:
 *   - the venue must currently be IN PLAY (PITCHED onward; SUPPRESSED/feed
 *     statuses are not movable here — those have their own flows);
 *   - the target must be a valid in-play target (REPLIED / IN_CONVERSATION /
 *     BOOKED / DEAD — never back to PITCHED, the system-set "sent" state).
 * Idempotent: setting the status it already has is a no-op success. BOOKED/DEAD
 * are terminal for venue automation (mirrors the lead booked-or-dead rule), but
 * the owner may still re-open by hand if they mis-clicked.
 */
export async function setVenueStatus(venueId: string, status: string): Promise<ActionResult> {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return { ok: false, error: "No venue given" };
  if (!isInPlayTargetStatus(status)) return { ok: false, error: "Not a status you can set here" };

  const business = await getCurrentBusiness();
  const venue = await findTenantVenue(business.id, parsed.data);
  if (!venue) return { ok: false, error: "Venue not found" };

  // No-op success if already there (double-click / stale UI).
  if (venue.status === status) {
    revalidatePath("/dashboard");
    return { ok: true };
  }

  // Only an in-play venue is trackable here — never resurrect a SUPPRESSED one
  // or hijack a feed-stage venue (DISCOVERED/QUALIFIED/PITCH_DRAFTED).
  if (!isInPlayStatus(venue.status)) {
    return { ok: false, error: "This venue isn't in play yet" };
  }

  await db.venue.update({
    where: { id: venue.id },
    data: {
      status,
      ...((status === "REPLIED" || status === "IN_CONVERSATION" || status === "BOOKED") &&
      !venue.repliedAt
        ? { repliedAt: new Date() }
        : {}),
      ...(status === "BOOKED" && !venue.bookedAt ? { bookedAt: new Date() } : {}),
    },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (form `action` must return void). */
export async function setVenueStatusForm(venueId: string, status: string): Promise<void> {
  await setVenueStatus(venueId, status);
}

// ---------------------------------------------------------------------------
// Send test email (mailbox onboarding affordance) — proves the whole send path
// works end-to-end on prod and gives the owner a permanent "verify my mailbox"
// button. It generates a REALISTIC SAMPLE venue pitch in the owner's own voice
// (the real generator, metered as "venuePitch" per CLAUDE.md rule 8) and sends
// it through the real Gmail path to the owner's OWN connected address. It
// NEVER creates Venue/VenuePitch rows and NEVER emails a real venue. Constants
// + the in-memory rate limiter live in lib/outreach/test-email (a "use server"
// module may only export async functions).

type TestEmailResult =
  | { ok: true; sentTo: string; generation: "ai" | "static-fallback" }
  | { ok: false; error: string };

/**
 * Send a SAMPLE venue pitch to the owner's OWN connected mailbox (onboarding /
 * "verify your mailbox" affordance). Guards, in order:
 *   1. tenant-scoped via getCurrentBusiness.
 *   2. mailbox must be CONNECTED ("Connect your mailbox first").
 *   3. light per-tenant rate limit (5/hour).
 *   4. build a SAMPLE VenuePitchRequest: a built-in rooftop-bar sample venue in
 *      the tenant's first serviceCity (else "your city"), country = the tenant's
 *      own country so the jurisdiction footer resolves, temperature HOT, plain
 *      sample signals + fitReasons — paired with the tenant's REAL profile.
 *   5. generate via the real generator (metered "venuePitch"); on ANY throw fall
 *      back to STATIC_SAMPLE so the transport is still exercised.
 *   6. prepend the TEST banner, append the same jurisdiction pitchFooter a real
 *      send would, prefix the subject "[Test] ".
 *   7. send via sendGmail to the OWNER'S OWN connected address (To + Reply-To).
 * NEVER touches Venue or VenuePitch.
 */
export async function sendTestEmail(): Promise<TestEmailResult> {
  const business = await getCurrentBusiness();
  const postalAddress = business.postalAddress?.trim();
  if (!postalAddress) {
    return {
      ok: false,
      error: "Add your business mailing address in Settings before testing venue outreach",
    };
  }

  // (2) Mailbox must be connected.
  const connection = await db.mailboxConnection.findUnique({
    where: { businessId: business.id },
    select: { email: true, status: true },
  });
  if (!connection || connection.status !== "CONNECTED") {
    return { ok: false, error: "Connect your mailbox first" };
  }

  // (3) Abuse guard.
  if (!testSendAllowed(business.id)) {
    return { ok: false, error: "You've sent a few test emails recently — try again in a little while." };
  }

  // (4) Build a SAMPLE request from a built-in sample venue + the REAL profile.
  const sampleCity = business.serviceCities[0] ?? "your city";
  const req: VenuePitchRequest = {
    business: {
      id: business.id, // logs LlmUsage per rule 8 — intended
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
    },
    venue: {
      name: "The Sample Rooftop",
      city: sampleCity,
      country: business.country, // tenant's own country → footer/jurisdiction resolve
      kind: "BAR",
      temperature: "HOT",
      signals: [
        `New rooftop bar in ${sampleCity} now booking entertainment`,
        "Hosts weekend events and private parties",
      ],
      fitReasons: ["Rooftop bar — your sound fits the room", "Books live entertainment for events"],
    },
    epkUrl: epkUrlFor(business.slug),
    language: pitchLanguageFor(business.country, business.pitchLanguages),
  };

  // (5) Generate in the owner's voice; fall back to the static sample on ANY
  // failure so the test still proves sending works.
  let subject: string;
  let pitchBody: string;
  let generation: "ai" | "static-fallback" = "ai";
  try {
    const pitch = await generateVenuePitch(req);
    subject = pitch.subject;
    pitchBody = pitch.body;
  } catch {
    generation = "static-fallback";
    subject = TEST_EMAIL_STATIC_SAMPLE.subject;
    pitchBody = TEST_EMAIL_STATIC_SAMPLE.body;
  }

  // (6) Banner + the same jurisdiction footer a real send appends.
  const jurisdiction = jurisdictionFor(business.country);
  const body =
    `${TEST_EMAIL_BANNER}\n\n${pitchBody}` +
    pitchFooter({
      mode: jurisdiction.mode,
      businessName: business.name,
      city: sampleCity,
      postalAddress,
      venueName: req.venue.name,
    });

  // (7) Send to the OWNER'S OWN connected address (To + Reply-To). NEVER a venue.
  try {
    await sendGmail(business.id, {
      toEmail: connection.email,
      toName: business.name,
      subject: `[Test] ${subject}`,
      body,
      replyToEmail: connection.email,
    });
  } catch (err) {
    if (err instanceof MailboxError) return { ok: false, error: err.message };
    return { ok: false, error: "The test email didn't go through — try again in a moment" };
  }

  return { ok: true, sentTo: connection.email, generation };
}
