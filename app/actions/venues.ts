"use server";

// Venue-opportunity feed actions (Phase 10.3/10.4, ADR-004) — tenant-scoped
// via getCurrentBusiness, zod-validated, never trusting the UI: the hunting
// license (profileStrength().canPitch) is re-checked server-side before any
// pitch is generated.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isAgentPaused } from "@/lib/billing/metering";
import { profileStrength } from "@/lib/profile/strength";
import { isSkipReason, SKIP_REASONS } from "@/lib/venues/feed";
import { jurisdictionFor, pitchFooter } from "@/lib/outreach/jurisdiction";
import {
  capError,
  capFor,
  sentCapFor,
  sendCapError,
  startOfTenantDay,
  SEND_CAP_STATUSES,
} from "@/lib/outreach/caps";
import {
  epkUrlFor,
  generateVenuePitch,
  pitchLanguageFor,
  type VenuePitchRequest,
} from "@/lib/agent/venue-pitch";
import { sendGmail, MailboxError } from "@/lib/outbound/gmail";
import {
  TEST_EMAIL_BANNER,
  TEST_EMAIL_STATIC_SAMPLE,
  testSendAllowed,
} from "@/lib/outreach/test-email";

type ActionResult = { ok: true } | { ok: false; error: string };

const venueIdSchema = z.string().trim().min(1, "No venue given").max(64);
const pitchIdSchema = z.string().trim().min(1, "No pitch given").max(64);

/** The venue, only if it belongs to the current tenant. */
async function findTenantVenue(businessId: string, venueId: string) {
  return db.venue.findFirst({ where: { id: venueId, businessId } });
}

// Trial-expiry gate copy (FINAL founder decision 2026-06-14: a 14-day full-Pro
// free trial — the agent works during the trial AND on any paid plan).
// isAgentPaused() is a pure check (no DB): plan=TRIAL + trialEndsAt-in-past =
// "trial ended, unsubscribed → agent paused". The SAME gate guards the reactive
// lead path, so reactive drafting and proactive venue pitches gate identically:
// an active trial may generate AND send pitches; only an expired-trial tenant
// with no subscription is blocked, and may still browse the feed.
const TRIAL_ENDED = "Your trial has ended — choose a plan to keep your agent working";

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

  // Active trial OR paid plan: the agent drafts. Only an expired trial with no
  // subscription is paused — same gate as the reactive lead path.
  if (isAgentPaused(business.plan, business.trialEndsAt)) {
    return { ok: false, error: TRIAL_ENDED };
  }

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
    return { ok: false, error: capError(venue.temperature) };
  }

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
      // 10.2c: temperature picks the template (HOT date-ask / WARM rotation
      // intro / SEED file-me-away); evidence is the only program grounding.
      temperature: venue.temperature,
      signals: venue.signals.map((s) => s.summary),
      entertainmentEvidence: venue.entertainmentEvidence,
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

/**
 * Send an APPROVED pitch from the artist's OWN connected mailbox (Phase 10.5,
 * Gmail OAuth). EVERY guard runs server-side, in this exact order, each a hard
 * stop with a friendly error — the UI is never trusted:
 *
 *   1. tenant-scoped pitch lookup; status must be APPROVED (only APPROVED
 *      pitches send). Already-SENT or in-flight SENDING → idempotent no-op
 *      success (NEVER a second real email).
 *   2. mailbox CONNECTED for this tenant ("Connect your mailbox first").
 *   3. jurisdiction MUST be STANDARD — CONSENT/STRICT (Canada/Germany/…) are
 *      copy-and-send only; auto-send is REFUSED (the legal handoff guarantee,
 *      ADR-004 D4 / lib/outreach/jurisdiction.ts).
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

  // Active trial OR paid plan: the agent sends. Only an expired trial with no
  // subscription is paused — same gate as the reactive lead path.
  if (isAgentPaused(business.plan, business.trialEndsAt)) {
    return { ok: false, error: TRIAL_ENDED };
  }

  // (1) Tenant-scoped lookup + status gate.
  const pitch = await db.venuePitch.findFirst({
    where: { id: parsed.data, businessId: business.id },
    include: { venue: true },
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

  // (3) Jurisdiction: STANDARD only — CONSENT/STRICT are copy-and-send by law.
  const jurisdiction = jurisdictionFor(venue.country);
  if (jurisdiction.mode !== "STANDARD") {
    return {
      ok: false,
      error: "Canada/Germany are copy-and-send only — use the Copy button",
    };
  }

  // (4) Suppression re-check (email always lowercased — schema contract).
  const email = venue.bookingEmail.toLowerCase();
  const suppressed = await db.outreachSuppression.findUnique({
    where: { businessId_email: { businessId: business.id, email } },
    select: { id: true },
  });
  if (suppressed) {
    return { ok: false, error: "This contact is on your do-not-contact list" };
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

  // (7) Build + send. The owner's edits win; the jurisdiction footer is
  // appended HERE (at send), never stored in the editable body.
  const subject = pitch.editedSubject ?? pitch.subject;
  const body = (pitch.editedBody ?? pitch.body) +
    pitchFooter({
      mode: jurisdiction.mode,
      businessName: business.name,
      city: business.serviceCities[0] ?? "",
      venueName: venue.name,
    });

  let messageId: string;
  try {
    const result = await sendGmail(business.id, {
      toEmail: venue.bookingEmail,
      toName: venue.bookingContactName ?? undefined,
      subject,
      body,
      replyToEmail: business.replyToEmail ?? business.ownerEmail,
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
  // re-send, so we never double-email a venue. A SENDING pitch older than a few
  // minutes is a human-recoverable state (an operator can mark it SENT or
  // re-open it). We do NOT build a reaper here — just flag the recovery point.
  // TODO(reaper): sweep pitches SENDING > N minutes → surface for manual review.
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

// ---------------------------------------------------------------------------
// Send test email (mailbox onboarding affordance) — proves the whole send path
// works end-to-end on prod and gives the owner a permanent "verify my mailbox"
// button. It generates a REALISTIC SAMPLE venue pitch in the owner's own voice
// (the real generator, metered as "venuePitch" per CLAUDE.md rule 8) and sends
// it through the real Gmail path to the owner's OWN connected address. It
// NEVER creates Venue/VenuePitch rows and NEVER emails a real venue. Constants
// + the in-memory rate limiter live in lib/outreach/test-email (a "use server"
// module may only export async functions).

type TestEmailResult = { ok: true; sentTo: string } | { ok: false; error: string };

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
  try {
    const pitch = await generateVenuePitch(req);
    subject = pitch.subject;
    pitchBody = pitch.body;
  } catch {
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

  return { ok: true, sentTo: connection.email };
}
