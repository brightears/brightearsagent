"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";

const emailSchema = z.string().trim().email().max(320);

export async function correctLeadEmail(
  leadId: string,
  rawEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const business = await getCurrentBusiness();
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };

  const lead = await db.lead.findFirst({
    where: { id: leadId, businessId: business.id },
    include: {
      sequenceRun: true,
      messages: {
        where: { direction: "OUTBOUND", bouncedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { draft: true },
      },
    },
  });
  if (!lead || !lead.undeliverableAt) {
    return { ok: false, error: "This lead does not have an address failure to recover." };
  }
  if (lead.optedOut || lead.undeliverableReason?.startsWith("Spam complaint:")) {
    return { ok: false, error: "A spam complaint is a permanent stop and cannot be overridden." };
  }

  const email = parsed.data.toLowerCase();
  if (email === lead.clientEmail?.trim().toLowerCase()) {
    return { ok: false, error: "Use a different address—the current one was rejected." };
  }

  const bouncedMessage = lead.messages[0];
  if (!bouncedMessage) {
    return { ok: false, error: "The failed reply could not be found." };
  }
  const originalDraft = bouncedMessage.draft;
  const isFollowUp =
    originalDraft?.isFollowUp ?? (lead.status === "IN_SEQUENCE" && !!lead.sequenceRun);
  const isConfirmation = originalDraft?.isConfirmation ?? false;
  const sequenceStep =
    originalDraft?.sequenceStep ?? (isFollowUp ? lead.sequenceRun?.currentStep ?? 1 : null);
  if (lead.status === "DEAD" || lead.status === "SPAM") {
    return { ok: false, error: "This lead is closed and cannot be reopened by changing its email." };
  }
  if (lead.status === "BOOKED" && !isConfirmation) {
    return { ok: false, error: "This booking is closed; there is no reply to resend." };
  }
  const now = new Date();

  await db.$transaction([
    db.draft.updateMany({
      where: { leadId, status: "PENDING" },
      data: { status: "EXPIRED", decidedAt: now, scheduledSendAt: null },
    }),
    db.draft.create({
      data: {
        leadId,
        subject: originalDraft?.subject ?? bouncedMessage.subject ?? "Re: your inquiry",
        body: originalDraft?.body ?? bouncedMessage.body,
        isFollowUp,
        isConfirmation,
        sequenceStep,
        wantsProfile: originalDraft?.wantsProfile ?? false,
        wantsQuote: originalDraft?.wantsQuote ?? false,
        expiresAt: new Date(now.getTime() + 14 * 24 * 3600 * 1000),
      },
    }),
    db.lead.update({
      where: { id: leadId },
      data: {
        clientEmail: email,
        undeliverableAt: null,
        undeliverableReason: null,
        ...(!isFollowUp && !isConfirmation ? { firstReplyAt: null } : {}),
        ...(["BOOKED", "DEAD", "SPAM"].includes(lead.status)
          ? {}
          : { status: isFollowUp ? "IN_SEQUENCE" : "DRAFTED" }),
      },
    }),
    ...(!isFollowUp && !isConfirmation
      ? [db.sequenceRun.deleteMany({ where: { leadId } })]
      : isFollowUp
        ? [
            db.sequenceRun.updateMany({
              where: { leadId },
              // Keep the run deliberately stopped until the replacement reply
              // is actually sent. sendDraftReply reopens and re-anchors it in
              // the same transaction that records successful delivery.
              data: { stopReason: "email_corrected_pending_resend" },
            }),
          ]
        : []),
  ]);

  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
