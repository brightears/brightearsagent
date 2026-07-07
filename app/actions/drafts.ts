"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { sendDraftReply } from "@/lib/agent/send-reply";

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

export async function markBooked(leadId: string) {
  const business = await getCurrentBusiness();
  const lead = await db.lead.findFirst({ where: { id: leadId, businessId: business.id } });
  if (!lead) return { ok: false, error: "lead not found" };
  await db.$transaction([
    db.lead.update({ where: { id: leadId }, data: { status: "BOOKED", bookedAt: new Date() } }),
    db.sequenceRun.updateMany({
      where: { leadId, stoppedAt: null },
      data: { stoppedAt: new Date(), stopReason: "booked" },
    }),
    ...(lead.eventDate
      ? [
          db.gig.create({
            data: {
              businessId: lead.businessId,
              date: lead.eventDate,
              title: `${lead.clientName ?? "Client"} — ${lead.eventType ?? "event"}`,
              venue: lead.venue,
              leadId,
            },
          }),
        ]
      : []),
  ]);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markDead(leadId: string) {
  const business = await getCurrentBusiness();
  const updated = await db.lead.updateMany({
    where: { id: leadId, businessId: business.id },
    data: { status: "DEAD", deadAt: new Date() },
  });
  if (updated.count === 0) return { ok: false, error: "lead not found" };
  await db.sequenceRun.updateMany({
    where: { leadId, stoppedAt: null },
    data: { stoppedAt: new Date(), stopReason: "marked_dead" },
  });
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
