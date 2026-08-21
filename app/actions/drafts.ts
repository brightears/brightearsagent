"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { draftBookingConfirmation } from "@/lib/agent/confirmation";
import { sendDraftReply } from "@/lib/agent/send-reply";
import { isAgentPaused } from "@/lib/billing/metering";
import {
  appendVoiceExample,
  isDraftRejectionReason,
} from "@/lib/feedback/owner-controls";
import { outreachSuppressionScope } from "@/lib/outreach/suppression";
import { reportError } from "@/lib/report-error";

const draftEditsSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Subject can't be empty")
    .max(160, "Keep the subject under 160 characters")
    .refine((value) => !/[\x00-\x1F\x7F]/.test(value), "Subject contains an invalid character")
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, "Reply can't be empty")
    .max(10_000, "Keep the reply under 10,000 characters")
    .optional(),
  saveVoiceExample: z.boolean().optional(),
});

type DraftEdits = z.infer<typeof draftEditsSchema>;

/**
 * The one-tap loop: approve (optionally with edits) → send as the business,
 * Reply-To the owner → lead becomes REPLIED (first reply timestamped).
 * Owner edits are kept on the draft. They affect the voice profile only when
 * the owner explicitly checks "save this edit as a voice example".
 *
 * Thin tenant-scoped wrapper: the actual send + compliance + sequencing lives in
 * lib/agent/send-reply.ts so the inbound pipeline's AUTO-SEND (Pro+) runs the
 * exact same path — manual approve and auto-send can never diverge.
 */
export async function approveDraft(
  draftId: string,
  edits?: DraftEdits,
  attach?: { pressKit?: boolean; quote?: boolean },
) {
  const parsed = draftEditsSchema.safeParse(edits ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid edit" };
  }
  const business = await getCurrentBusiness();
  // Subscription gate (founder decision 2026-06-16): the agent — including
  // sending its drafted replies — only runs on an active subscription. Same
  // gate as the sequence engine and venue pitches; the draft stays PENDING so
  // subscribing lets it send.
  if (isAgentPaused(business)) {
    return { ok: false, error: "Your agent is paused — subscribe to activate it and send this reply" };
  }
  const result = await sendDraftReply({
    draftId,
    businessId: business.id,
    editedSubject: parsed.data.subject,
    editedBody: parsed.data.body,
    saveVoiceExample: parsed.data.saveVoiceExample,
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
export async function markSentOnPlatform(draftId: string, edits?: DraftEdits) {
  const parsed = draftEditsSchema.safeParse(edits ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid edit" };
  }
  const business = await getCurrentBusiness();
  const draft = await db.draft.findFirst({
    where: { id: draftId, lead: { businessId: business.id } },
    include: {
      message: { select: { id: true } },
      lead: {
        select: {
          id: true,
          status: true,
          firstReplyAt: true,
          optedOut: true,
          clientEmail: true,
        },
      },
    },
  });
  if (!draft) return { ok: false, error: "draft not found" };
  // A second tap after the first transaction committed is a friendly no-op.
  // Message.draftId is unique, so this is also the durable idempotency anchor.
  if (draft.message && (draft.status === "APPROVED" || draft.status === "EDITED")) {
    return { ok: true };
  }
  if (draft.status !== "PENDING") return { ok: false, error: "draft not pending" };

  const recordableLeadStatuses = ["NEW", "DRAFTED", "REPLIED", "IN_SEQUENCE", "ENGAGED"] as const;
  if (
    draft.lead.optedOut ||
    !recordableLeadStatuses.includes(
      draft.lead.status as (typeof recordableLeadStatuses)[number],
    )
  ) {
    return { ok: false, error: "this lead has opted out or is closed" };
  }
  if (
    draft.lead.clientEmail &&
    (await outreachSuppressionScope(business.id, draft.lead.clientEmail))
  ) {
    return { ok: false, error: "this contact is on the do-not-contact list" };
  }

  const subject = parsed.data.subject ?? draft.subject;
  const body = parsed.data.body ?? draft.body;
  const editedSubject =
    parsed.data.subject !== undefined && subject !== draft.subject.trim() ? subject : null;
  const editedBody =
    parsed.data.body !== undefined && body !== draft.body.trim() ? body : null;
  const hasOwnerEdits = editedSubject !== null || editedBody !== null;
  const wantsVoiceExample = !!parsed.data.saveVoiceExample && hasOwnerEdits;
  const decidedAt = new Date();
  const conflict = "platform-send-record-conflict";
  let recorded = false;
  try {
    recorded = await db.$transaction(async (tx) => {
      // Claim first. The relational predicates are evaluated in the same SQL
      // statement as PENDING -> SENDING, so a terminal/opt-out transition that
      // won the race prevents this caller from recording anything.
      const claim = await tx.draft.updateMany({
        where: {
          id: draft.id,
          status: "PENDING",
          lead: {
            businessId: business.id,
            optedOut: false,
            status: { in: [...recordableLeadStatuses] },
          },
        },
        data: { status: "SENDING" },
      });
      if (claim.count === 0) return false;

      // Re-read after the claim, then make the lead transition itself a
      // compare-and-set. That row update is held until commit, so a concurrent
      // terminal transition cannot be overwritten by a stale REPLIED write.
      const currentLead = await tx.lead.findUnique({
        where: { id: draft.lead.id },
        select: { businessId: true, status: true, optedOut: true },
      });
      if (
        !currentLead ||
        currentLead.businessId !== business.id ||
        currentLead.optedOut ||
        !recordableLeadStatuses.includes(
          currentLead.status as (typeof recordableLeadStatuses)[number],
        )
      ) {
        throw new Error(conflict);
      }
      const leadUpdate = await tx.lead.updateMany({
        where: {
          id: draft.lead.id,
          businessId: business.id,
          optedOut: false,
          status: currentLead.status,
        },
        data: {
          // Replying must not demote an already-engaged conversation.
          status: currentLead.status === "ENGAGED" ? "ENGAGED" : "REPLIED",
        },
      });
      if (leadUpdate.count === 0) throw new Error(conflict);
      await tx.lead.updateMany({
        where: { id: draft.lead.id, businessId: business.id, firstReplyAt: null },
        data: { firstReplyAt: decidedAt },
      });

      await tx.message.create({
        data: {
          leadId: draft.lead.id,
          direction: "OUTBOUND",
          subject,
          body,
          draftId: draft.id,
        },
      });
      const settled = await tx.draft.updateMany({
        where: { id: draft.id, status: "SENDING" },
        data: {
          status: hasOwnerEdits ? "EDITED" : "APPROVED",
          editedSubject,
          editedBody,
          decidedAt,
        },
      });
      if (settled.count === 0) throw new Error(conflict);
      return true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === conflict) {
      return { ok: false, error: "this lead changed — refresh before recording the send" };
    }
    throw error;
  }
  if (!recorded) {
    // Another caller may have committed between the initial read and claim.
    const existing = await db.message.findFirst({
      where: { draftId: draft.id, lead: { businessId: business.id } },
      select: { id: true },
    });
    return existing
      ? { ok: true }
      : { ok: false, error: "this lead changed — refresh before recording the send" };
  }

  let voiceExampleSaved = false;
  if (wantsVoiceExample) {
    try {
      const current = await db.business.findUnique({
        where: { id: business.id },
        select: { voiceSamples: true },
      });
      const nextVoiceSamples = appendVoiceExample(current?.voiceSamples, {
        kind: "reply",
        subject,
        body,
      });
      if (current && nextVoiceSamples !== current.voiceSamples) {
        await db.$transaction([
          db.business.update({
            where: { id: business.id },
            data: { voiceSamples: nextVoiceSamples },
          }),
          db.draft.update({
            where: { id: draft.id },
            data: { voiceSampleSavedAt: decidedAt },
          }),
        ]);
        voiceExampleSaved = true;
      }
    } catch (err) {
      await reportError(err, {
        kind: "voice-example-save",
        businessId: business.id,
        draftId: draft.id,
        note: "platform send recorded successfully; optional voice example was not saved",
      });
    }
  }
  revalidatePath("/dashboard");
  return voiceExampleSaved ? { ok: true, voiceExampleSaved } : { ok: true };
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

export async function rejectDraft(draftId: string, reason: string) {
  if (!isDraftRejectionReason(reason)) {
    return { ok: false, error: "Choose why you're rejecting this draft" };
  }
  const business = await getCurrentBusiness();
  // Tenant-scoped count guard: only reject a PENDING draft of our own lead.
  const updated = await db.draft.updateMany({
    where: { id: draftId, status: "PENDING", lead: { businessId: business.id } },
    data: { status: "REJECTED", rejectionReason: reason, decidedAt: new Date() },
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
    select: { id: true, status: true, optedOut: true, undeliverableAt: true },
  });
  if (!lead) return { ok: false, error: "lead not found" };
  if (lead.optedOut || lead.status === "SPAM" || lead.status === "BOOKED" || lead.status === "DEAD") {
    return { ok: false, error: "this lead is closed — no reply to draft" };
  }
  if (lead.undeliverableAt) {
    return { ok: false, error: "correct the bounced email address before drafting another reply" };
  }
  try {
    await generateDraftForLead(leadId);
  } catch {
    return { ok: false, error: "couldn't draft a reply just now — try again in a moment" };
  }
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}
