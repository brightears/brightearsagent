"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/outbound/send";
import { complianceFooter } from "@/lib/optout";

/**
 * The one-tap loop: approve (optionally with edits) → send as the business,
 * Reply-To the owner → lead becomes REPLIED (first reply timestamped).
 * Owner edits are kept on the draft (voice-tuning signal).
 */
export async function approveDraft(draftId: string, editedBody?: string) {
  const draft = await db.draft.findUnique({
    where: { id: draftId },
    include: { lead: { include: { business: true } } },
  });
  if (!draft || draft.status !== "PENDING") return { ok: false, error: "draft not pending" };

  const { lead } = draft;
  if (!lead.clientEmail) {
    return { ok: false, error: "lead has no reachable email (reply on the platform instead)" };
  }

  const approvedBody = editedBody?.trim() || draft.body;
  // Follow-ups carry the compliance footer (who/why/opt-out) — appended at send
  // time so the owner reviews clean copy and the footer is never edited away.
  const body = draft.isFollowUp
    ? approvedBody + complianceFooter(lead.business.name, lead.id)
    : approvedBody;
  const sent = await sendEmail({
    fromName: lead.business.name,
    to: lead.clientEmail,
    replyTo: lead.business.replyToEmail ?? lead.business.ownerEmail,
    subject: draft.subject,
    textBody: body,
  });

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
        leadId: lead.id,
        direction: "OUTBOUND",
        subject: draft.subject,
        body,
        fromEmail: lead.business.ownerEmail,
        toEmail: lead.clientEmail,
        providerMessageId: sent.providerMessageId,
        draftId: draft.id,
      },
    }),
    db.lead.update({
      where: { id: lead.id },
      data: {
        status: draft.isFollowUp ? "IN_SEQUENCE" : "REPLIED",
        firstReplyAt: lead.firstReplyAt ?? new Date(),
      },
    }),
  ]);

  // First reply sent → the follow-up sequence clock starts (engine fires steps).
  if (!draft.isFollowUp) {
    const template = await db.sequenceTemplate.findFirst({
      where: { businessId: lead.businessId, active: true },
    });
    if (template && template.stepsDays.length > 0) {
      await db.sequenceRun
        .create({
          data: {
            leadId: lead.id,
            templateId: template.id,
            currentStep: 0,
            nextRunAt: new Date(Date.now() + template.stepsDays[0] * 24 * 3600 * 1000),
          },
        })
        .catch(() => null); // unique leadId — already has a run
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, transport: sent.transport };
}

export async function rejectDraft(draftId: string) {
  const draft = await db.draft.findUnique({ where: { id: draftId } });
  if (!draft || draft.status !== "PENDING") return { ok: false, error: "draft not pending" };
  await db.draft.update({
    where: { id: draftId },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markBooked(leadId: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
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
  await db.$transaction([
    db.lead.update({ where: { id: leadId }, data: { status: "DEAD", deadAt: new Date() } }),
    db.sequenceRun.updateMany({
      where: { leadId, stoppedAt: null },
      data: { stoppedAt: new Date(), stopReason: "marked_dead" },
    }),
  ]);
  revalidatePath("/dashboard");
  return { ok: true };
}
