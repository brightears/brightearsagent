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
import { sendEmail, type OutboundAttachment } from "@/lib/outbound/send";
import { resolveAttachments } from "@/lib/agent/attach-policy";
import { isAgentPaused } from "@/lib/billing/metering";
import { complianceFooter } from "@/lib/optout";
import { reportError } from "@/lib/report-error";

export type SendReplyResult =
  | { ok: true; transport: "postmark" | "dev" }
  | { ok: false; error: string };

/** Distinguishable error strings so callers can branch on the failure class. */
export const SEND_ERR = {
  notPending: "draft not pending",
  noEmail: "lead has no reachable email (reply on the platform instead)",
  compliance: "this lead has opted out or is closed — nothing was sent",
  paused: "the agent is paused — subscribe to activate it",
} as const;

export async function sendDraftReply(opts: {
  draftId: string;
  /** Tenant scope — the draft must belong to a lead of this business. */
  businessId: string;
  /** Owner edits (manual approve only); auto-send never edits. */
  editedBody?: string;
  /** Attach the artist's press-kit PDF to this reply (manual approve). */
  attachPressKit?: boolean;
  /** Attach a grounded quote PDF (skipped silently if there's no pricing to quote from). */
  attachQuote?: boolean;
  /** AUTO-SEND path: derive attachments from the artist's autonomy toggles +
   *  the draft's detected intent, instead of explicit owner choices. */
  autoAttach?: boolean;
  /** Scheduled autonomous send (P10.4): the atomic claim ALSO requires the
   *  buffer to still be armed, so a Hold that cleared scheduledSendAt wins the
   *  race — the owner's explicit cancel can never be out-run by the tick. */
  requireScheduled?: boolean;
}): Promise<SendReplyResult> {
  const { draftId, businessId, editedBody, attachPressKit, attachQuote, autoAttach, requireScheduled } = opts;
  const draft = await db.draft.findFirst({
    where: { id: draftId, lead: { businessId } }, // tenant-scoped
    include: { lead: { include: { business: { include: { packages: { where: { active: true } } } } } } },
  });
  if (!draft || draft.status !== "PENDING") return { ok: false, error: SEND_ERR.notPending };

  const { lead } = draft;
  if (!lead.clientEmail) {
    return { ok: false, error: SEND_ERR.noEmail };
  }
  // Subscription gate at the SEND boundary (defense in depth): every caller —
  // approveDraft, auto-send, the scheduled buffer, sequence autopilot — funnels
  // through here, so a paused (unsubscribed) tenant can never email regardless
  // of which path missed its own check. Draft stays PENDING: subscribing
  // lets it send.
  if (isAgentPaused(lead.business.plan)) {
    return { ok: false, error: SEND_ERR.paused };
  }
  // Compliance hard-stop at the SEND boundary (not just in the cron engine):
  // a draft can sit PENDING while the client opts out or the lead is closed.
  // Never email an opted-out or terminal lead. (CLAUDE.md rule 5.) The ONE
  // exception (11.2): a booking-confirmation draft exists precisely BECAUSE
  // the lead is BOOKED — it may send there (and only there).
  if (
    lead.optedOut ||
    lead.status === "DEAD" ||
    (lead.status === "BOOKED" && !draft.isConfirmation)
  ) {
    await db.draft.update({
      where: { id: draft.id },
      data: { status: "EXPIRED", decidedAt: new Date() },
    });
    return { ok: false, error: SEND_ERR.compliance };
  }

  // Atomic claim (10.10): a double-tap on Approve, or manual approve racing
  // the autopilot cron, could both pass the PENDING read above and both send.
  // updateMany with the status in the WHERE lets exactly one caller through;
  // the loser sees count 0. Everything before this point only reads.
  //
  // requireScheduled (P15 review fix): the scheduled tick must ALSO match a
  // still-armed buffer — a Hold clears scheduledSendAt, so its updateMany and
  // this claim can't both win. Without it, a Hold that succeeded (and told the
  // owner so) could still be out-run by an in-flight tick and send anyway.
  const claimed = await db.draft.updateMany({
    where: {
      id: draft.id,
      status: "PENDING",
      ...(requireScheduled ? { scheduledSendAt: { not: null } } : {}),
    },
    data: { status: "SENDING" },
  });
  if (claimed.count === 0) return { ok: false, error: SEND_ERR.notPending };

  const approvedBody = editedBody?.trim() || draft.body;
  // Follow-ups carry the compliance footer (who/why/opt-out) — appended at send
  // time so the owner reviews clean copy and the footer is never edited away.
  const body = draft.isFollowUp
    ? approvedBody + complianceFooter(lead.business.name, lead.id)
    : approvedBody;

  // PDF attachments (opt-in). Dynamic import keeps @react-pdf out of the hot
  // inbound/send path unless an attachment is actually requested. A quote with
  // no pricing to ground it is skipped silently — never a fabricated price, and
  // never a failed send just because there's nothing to quote.
  // Auto-send derives attachments from the artist's toggles + the draft's
  // detected intent; manual approve uses the owner's explicit choices.
  const { pressKit: wantPressKit, quote: wantQuote } = resolveAttachments({
    autoAttach: !!autoAttach,
    attachPressKit,
    attachQuote,
    autoAttachProfile: lead.business.autoAttachProfile,
    autoAttachQuote: lead.business.autoAttachQuote,
    wantsProfile: draft.wantsProfile,
    wantsQuote: draft.wantsQuote,
  });

  const attachments: OutboundAttachment[] = [];
  if (wantPressKit || wantQuote) {
    const { renderPressKitForBusiness, renderQuotationForLead } = await import("@/lib/pdf/build");
    if (wantPressKit) {
      try {
        const pdf = await renderPressKitForBusiness(lead.business);
        attachments.push({ filename: `${lead.business.slug}-press-kit.pdf`, content: pdf, contentType: "application/pdf" });
      } catch {
        // A press-kit render failure must never block the actual reply.
      }
    }
    if (wantQuote) {
      try {
        const pdf = await renderQuotationForLead(lead, lead.business);
        if (pdf) attachments.push({ filename: `quote-${lead.id.slice(-6)}.pdf`, content: pdf, contentType: "application/pdf" });
      } catch {
        // Same: never block the reply on a quote render.
      }
    }
  }

  let sent: Awaited<ReturnType<typeof sendEmail>>;
  try {
    sent = await sendEmail({
      fromName: lead.business.name,
      to: lead.clientEmail,
      replyTo: lead.business.replyToEmail ?? lead.business.ownerEmail,
      subject: draft.subject,
      textBody: body,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  } catch (err) {
    // Send failed — release the claim so the draft stays retryable (the
    // behavior a thrown send always had before the claim existed).
    await db.draft
      .updateMany({ where: { id: draft.id, status: "SENDING" }, data: { status: "PENDING" } })
      .catch(() => null);
    throw err;
  }

  // The email is ALREADY delivered here. If this terminal write throws, the
  // draft must NOT be left in SENDING (stranded forever → no receipt, and the
  // redraft sweep would produce a duplicate reply — P15 review). Retry once;
  // if it still fails, force the draft out of SENDING to its decided status as
  // a best-effort backstop so it can never be re-sent or re-drafted. The
  // Message/lead rows may be lost, but a lost receipt beats a double-email.
  const decidedStatus = editedBody?.trim() ? "EDITED" : "APPROVED";
  const writeTerminal = () =>
    db.$transaction([
      db.draft.update({
        where: { id: draft.id },
        // autoAttach is the reliable "the agent sent this itself" signal —
        // manual approveDraft never passes it. Keeps graduation honest.
        data: {
          status: decidedStatus,
          editedBody: editedBody?.trim() || null,
          decidedAt: new Date(),
          autoSent: !!autoAttach,
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
          // ENGAGED so the sequence never restarts — replying doesn't undo a
          // reply. BOOKED stays BOOKED (a confirmation send never reopens it).
          status:
            lead.status === "BOOKED"
              ? "BOOKED"
              : lead.status === "ENGAGED"
                ? "ENGAGED"
                : draft.isFollowUp
                  ? "IN_SEQUENCE"
                  : "REPLIED",
          firstReplyAt: lead.firstReplyAt ?? new Date(),
        },
      }),
    ]);
  try {
    await writeTerminal();
  } catch {
    try {
      await writeTerminal();
    } catch (err) {
      await db.draft
        .updateMany({
          where: { id: draft.id, status: "SENDING" },
          data: { status: decidedStatus, decidedAt: new Date() },
        })
        .catch(() => null);
      await reportError(err, {
        kind: "send-reply-terminal-write",
        businessId: lead.businessId,
        draftId: draft.id,
        note: "email was delivered but the DB write failed; draft un-stranded, receipt may be lost",
      });
      // The reply DID go out — report success so callers don't re-notify/retry.
      return { ok: true, transport: sent.transport };
    }
  }

  // First reply sent → the follow-up sequence clock starts (engine fires steps).
  // Skip if the client already replied (ENGAGED) — they don't need chasing.
  // A booking confirmation NEVER starts a sequence (the deal is closed).
  if (!draft.isFollowUp && !draft.isConfirmation && lead.status !== "ENGAGED" && lead.status !== "BOOKED") {
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
