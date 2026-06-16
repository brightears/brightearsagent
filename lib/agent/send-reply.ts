// The core "send a PENDING reply draft" path, shared by:
//   • approveDraft (app/actions/drafts.ts) — the owner taps Approve (Clerk-auth)
//   • the inbound pipeline's AUTO-SEND (lib/inbound/pipeline.ts) — no user
//     session, runs in the webhook/background, so it CANNOT use getCurrentBusiness.
// Hence this is tenant-scoped by an explicit `businessId` and contains NO auth
// and NO revalidatePath (the owner action adds revalidate itself).
//
// All the compliance + sequencing invariants that used to live inline in
// approveDraft live here now, so auto-send and manual approve behave identically:
// never email an opted-out/terminal lead, append the compliance footer to
// follow-ups, keep ENGAGED from restarting the sequence, start the sequence on
// the first reply.
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/outbound/send";
import { complianceFooter } from "@/lib/optout";

export type SendReplyResult =
  | { ok: true; transport: "postmark" | "dev" }
  | { ok: false; error: string };

export async function sendDraftReply(opts: {
  draftId: string;
  /** Tenant scope — the draft must belong to a lead of this business. */
  businessId: string;
  /** Owner edits (manual approve only); auto-send never edits. */
  editedBody?: string;
}): Promise<SendReplyResult> {
  const { draftId, businessId, editedBody } = opts;
  const draft = await db.draft.findFirst({
    where: { id: draftId, lead: { businessId } }, // tenant-scoped
    include: { lead: { include: { business: true } } },
  });
  if (!draft || draft.status !== "PENDING") return { ok: false, error: "draft not pending" };

  const { lead } = draft;
  if (!lead.clientEmail) {
    return { ok: false, error: "lead has no reachable email (reply on the platform instead)" };
  }
  // Compliance hard-stop at the SEND boundary (not just in the cron engine):
  // a draft can sit PENDING while the client opts out or the lead is closed.
  // Never email an opted-out or terminal lead. (CLAUDE.md rule 5.)
  if (lead.optedOut || lead.status === "DEAD" || lead.status === "BOOKED") {
    await db.draft.update({
      where: { id: draft.id },
      data: { status: "EXPIRED", decidedAt: new Date() },
    });
    return { ok: false, error: "this lead has opted out or is closed — nothing was sent" };
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
        // If the client wrote back while this draft was pending (ENGAGED), keep
        // ENGAGED so the sequence never restarts — replying doesn't undo a reply.
        status: lead.status === "ENGAGED" ? "ENGAGED" : draft.isFollowUp ? "IN_SEQUENCE" : "REPLIED",
        firstReplyAt: lead.firstReplyAt ?? new Date(),
      },
    }),
  ]);

  // First reply sent → the follow-up sequence clock starts (engine fires steps).
  // Skip if the client already replied (ENGAGED) — they don't need chasing.
  if (!draft.isFollowUp && lead.status !== "ENGAGED") {
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

  return { ok: true, transport: sent.transport };
}
