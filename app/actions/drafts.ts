"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { draftBookingConfirmation } from "@/lib/agent/confirmation";
import { sendDraftReply } from "@/lib/agent/send-reply";
import { isAgentPaused } from "@/lib/billing/metering";

/**
 * The one-tap loop: approve (optionally with edits) → send as the business,
 * Reply-To the owner → lead becomes REPLIED (first reply timestamped).
 * Owner edits are kept on the draft (voice-tuning signal).
 *
 * Thin tenant-scoped wrapper: the actual send + compliance + sequencing lives in
 * lib/agent/send-reply.ts so the inbound pipeline's AUTO-SEND (Pro+) runs the
 * exact same path — manual approve and auto-send can never diverge.
 */
export async function approveDraft(
  draftId: string,
  editedBody?: string,
  attach?: { pressKit?: boolean; quote?: boolean },
) {
  const business = await getCurrentBusiness();
  // Subscription gate (founder decision 2026-06-16): the agent — including
  // sending its drafted replies — only runs on an active subscription. Same
  // gate as the sequence engine and venue pitches; the draft stays PENDING so
  // subscribing lets it send.
  if (isAgentPaused(business.plan)) {
    return { ok: false, error: "Your agent is paused — subscribe to activate it and send this reply" };
  }
  const result = await sendDraftReply({
    draftId,
    businessId: business.id,
    editedBody,
    attachPressKit: attach?.pressKit,
    attachQuote: attach?.quote,
  });
  if (result.ok) revalidatePath("/dashboard");
  return result;
}

/**
 * Platform reply kit (P9.8): GigSalad hides the client's email, and their ToS
 * says reply ON the platform — draft + deep link only, never send (CLAUDE.md
 * rule 4). So the owner copies the draft, pastes it there, and taps "I sent
 * it" — this records that reality: draft resolved, outbound message on the
 * thread (no email fields — it went out on the platform), lead REPLIED with
 * the first-reply clock stamped. No sequence starts: with no reachable email,
 * follow-ups would have nowhere to go.
 */
export async function markSentOnPlatform(draftId: string, editedBody?: string) {
  const business = await getCurrentBusiness();
  const draft = await db.draft.findFirst({
    where: { id: draftId, status: "PENDING", lead: { businessId: business.id } },
    include: { lead: { select: { id: true, status: true, firstReplyAt: true } } },
  });
  if (!draft) return { ok: false, error: "draft not pending" };
  const body = editedBody?.trim() || draft.body;
  await db.$transaction([
    db.draft.update({
      where: { id: draft.id },
      data: {
        status: editedBody?.trim() ? "EDITED" : "APPROVED",
        editedBody: editedBody?.trim() || null,
        decidedAt: new Date(),
      },
    }),
    db.message.create({
      data: {
        leadId: draft.lead.id,
        direction: "OUTBOUND",
        subject: draft.subject,
        body,
        draftId: draft.id,
      },
    }),
    db.lead.update({
      where: { id: draft.lead.id },
      data: {
        // Same ENGAGED guard as sendDraftReply — replying doesn't undo a reply.
        status: draft.lead.status === "ENGAGED" ? "ENGAGED" : "REPLIED",
        firstReplyAt: draft.lead.firstReplyAt ?? new Date(),
      },
    }),
  ]);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Spam rescue (P10.6): the triage classifier is allowed to be wrong — what it
 * can't be is irreversible. One tap flips a SPAM lead back to NEW and drafts
 * the reply the classifier withheld. spamScore/spamReason stay on the row
 * (the classifier's verdict is history, the owner's overrule is the status).
 */
export async function rescueFromSpam(leadId: string) {
  const business = await getCurrentBusiness();
  const updated = await db.lead.updateMany({
    where: { id: leadId, businessId: business.id, status: "SPAM" },
    data: { status: "NEW" },
  });
  if (updated.count === 0) return { ok: false as const, error: "lead not found" };
  try {
    await generateDraftForLead(leadId);
  } catch {
    // Lead stays NEW — the lead page's manual "Draft a reply" is the retry.
  }
  revalidatePath("/dashboard");
  return { ok: true as const, leadId };
}

/**
 * Hold a "sending soon" autonomous send (P10.4): clears the buffer clock so
 * the draft drops back to the normal approve flow. PENDING-only and
 * tenant-scoped; racing the tick is safe — sendDraftReply's atomic claim
 * means a draft that already started sending can't be held (count 0).
 */
export async function holdScheduledSend(draftId: string) {
  const business = await getCurrentBusiness();
  const updated = await db.draft.updateMany({
    where: {
      id: draftId,
      status: "PENDING",
      scheduledSendAt: { not: null },
      lead: { businessId: business.id },
    },
    data: { scheduledSendAt: null },
  });
  if (updated.count === 0) return { ok: false as const, error: "nothing scheduled to hold" };
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function rejectDraft(draftId: string) {
  const business = await getCurrentBusiness();
  // Tenant-scoped count guard: only reject a PENDING draft of our own lead.
  const updated = await db.draft.updateMany({
    where: { id: draftId, status: "PENDING", lead: { businessId: business.id } },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  if (updated.count === 0) return { ok: false, error: "draft not pending" };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markBooked(leadId: string, feeMinor?: number) {
  const business = await getCurrentBusiness();
  const lead = await db.lead.findFirst({ where: { id: leadId, businessId: business.id } });
  if (!lead) return { ok: false, error: "lead not found" };
  // 11.1 fee capture: optional, validated, minor units in the artist's own
  // currency. Bad input degrades to "no value recorded" - never an error.
  const value =
    typeof feeMinor === "number" && Number.isInteger(feeMinor) && feeMinor > 0
      ? Math.min(feeMinor, 1_000_000_000)
      : null;
  const bookedAt = new Date();
  // A gig is created when there's a date OR a fee to record (P15 review: a
  // captured fee was silently dropped when the lead had no eventDate, so
  // booked-value receipts under-reported). Date-less gigs fall back to the
  // booking date so the value has a home and the owner can fix the date on
  // the calendar; a fee-less, date-less booking still needs no gig row.
  const needsGig = !!lead.eventDate || value != null;
  // Date-less gigs anchor to the tenant-local calendar day of the booking,
  // stored as NOON UTC — the codebase-wide gig date convention (see
  // app/actions/gigs.ts / lib/agent/availability.ts); a raw timestamp would
  // land the gig on the wrong ISO day for half the world's timezones.
  const bookedDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(bookedAt);
  await db.$transaction([
    db.lead.update({ where: { id: leadId }, data: { status: "BOOKED", bookedAt } }),
    db.sequenceRun.updateMany({
      where: { leadId, stoppedAt: null },
      data: { stoppedAt: new Date(), stopReason: "booked" },
    }),
    // Retire the pre-booking draft (staging audit 2026-07-10): it can never
    // send on a closed lead, it squats in "Needs you", and — worse — the
    // confirmation drafter dedupes on PENDING and would silently skip.
    db.draft.updateMany({
      where: { leadId, status: "PENDING" },
      data: { status: "EXPIRED", decidedAt: new Date(), scheduledSendAt: null },
    }),
    ...(needsGig
      ? [
          db.gig.create({
            data: {
              businessId: lead.businessId,
              date: lead.eventDate ?? new Date(`${bookedDay}T12:00:00Z`),
              title: `${lead.clientName ?? "Client"} — ${lead.eventType ?? "event"}${
                lead.eventDate ? "" : " (date TBD)"
              }`,
              venue: lead.venue,
              value,
              leadId,
            },
          }),
        ]
      : []),
  ]);
  // 11.2: the booked moment drafts its own confirmation email (deterministic,
  // carries the booking link + quote PDF option) — owner approves like any
  // draft. Failure never blocks the booked outcome itself.
  let confirmationDrafted = false;
  try {
    confirmationDrafted = !!(await draftBookingConfirmation(leadId, value));
  } catch {
    // Confirmation is a bonus, not a gate — the lead page can redraft.
  }
  revalidatePath("/dashboard");
  return { ok: true, confirmationDrafted };
}

export async function markDead(leadId: string) {
  const business = await getCurrentBusiness();
  const updated = await db.lead.updateMany({
    where: { id: leadId, businessId: business.id },
    data: { status: "DEAD", deadAt: new Date() },
  });
  if (updated.count === 0) return { ok: false, error: "lead not found" };
  await db.$transaction([
    db.sequenceRun.updateMany({
      where: { leadId, stoppedAt: null },
      data: { stoppedAt: new Date(), stopReason: "marked_dead" },
    }),
    // A dead lead's pending draft can never send (compliance hard-stop) —
    // expire it so it stops squatting in "Needs you" (staging audit 2026-07-10).
    db.draft.updateMany({
      where: { leadId, status: "PENDING" },
      data: { status: "EXPIRED", decidedAt: new Date(), scheduledSendAt: null },
    }),
  ]);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Manually draft a reply for a lead (audit C1-NF). The inbound pipeline stops
 * sequences and sets ENGAGED when a prospect replies but generates no new draft,
 * so an owner had no way to respond in-app. This reuses generateDraftForLead
 * (which drafts off the latest inbound message and dedupes on an existing
 * PENDING draft); the resulting draft then appears in DraftReview for approval.
 * Also a retry when the automatic draft failed for a NEW lead.
 */
export async function draftReplyForLead(leadId: string) {
  const business = await getCurrentBusiness();
  const lead = await db.lead.findFirst({
    where: { id: leadId, businessId: business.id },
    select: { id: true, status: true, optedOut: true },
  });
  if (!lead) return { ok: false, error: "lead not found" };
  if (lead.optedOut || lead.status === "SPAM" || lead.status === "BOOKED" || lead.status === "DEAD") {
    return { ok: false, error: "this lead is closed — no reply to draft" };
  }
  try {
    await generateDraftForLead(leadId);
  } catch {
    return { ok: false, error: "couldn't draft a reply just now — try again in a moment" };
  }
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}
