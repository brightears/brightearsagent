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
import { checkAvailability, isoDay } from "@/lib/agent/availability";
import { validateDraft } from "@/lib/agent/draft-safety";
import { isAgentPaused } from "@/lib/billing/metering";
import { appendVoiceExample } from "@/lib/feedback/owner-controls";
import { complianceFooter } from "@/lib/optout";
import { outreachSuppressionScope } from "@/lib/outreach/suppression";
import { reportError } from "@/lib/report-error";
import { nextRunAtAfterStep } from "@/lib/sequences/timing";

export type SendReplyResult =
  | { ok: true; transport: "postmark" | "dev" }
  | { ok: false; error: string };

/** Distinguishable error strings so callers can branch on the failure class. */
export const SEND_ERR = {
  notPending: "draft not pending",
  noEmail: "lead has no reachable email (reply on the platform instead)",
  undeliverable: "this email address bounced — correct it before sending again",
  compliance: "this lead has opted out or is closed — nothing was sent",
  paused: "the agent is paused — subscribe to activate it",
  safety: "this reply no longer matches the inquiry or current calendar — review it before sending",
} as const;

export async function sendDraftReply(opts: {
  draftId: string;
  /** Tenant scope — the draft must belong to a lead of this business. */
  businessId: string;
  /** Owner edits (manual approve only); auto-send never edits. */
  editedSubject?: string;
  editedBody?: string;
  /** Editing alone never changes the voice profile; this must be explicit. */
  saveVoiceExample?: boolean;
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
  const {
    draftId,
    businessId,
    editedSubject,
    editedBody,
    saveVoiceExample,
    attachPressKit,
    attachQuote,
    autoAttach,
    requireScheduled,
  } = opts;
  const draft = await db.draft.findFirst({
    where: { id: draftId, lead: { businessId } }, // tenant-scoped
    include: {
      lead: {
        include: {
          business: {
            include: {
              packages: { where: { active: true } },
              performers: true,
            },
          },
          messages: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!draft || draft.status !== "PENDING") return { ok: false, error: SEND_ERR.notPending };

  const { lead } = draft;
  if (!lead.clientEmail) {
    return { ok: false, error: SEND_ERR.noEmail };
  }
  if (lead.undeliverableAt) {
    return { ok: false, error: SEND_ERR.undeliverable };
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

  // Product-wide and tenant-local recipient stops are re-checked at the last
  // read-only boundary shared by manual approval, scheduled sends and sequence
  // autopilot. Expire the stale draft so no retry loop can keep presenting it.
  if (await outreachSuppressionScope(lead.businessId, lead.clientEmail)) {
    await db.draft.update({
      where: { id: draft.id },
      data: { status: "EXPIRED", decidedAt: new Date(), scheduledSendAt: null },
    });
    return { ok: false, error: SEND_ERR.compliance };
  }

  const approvedSubject = editedSubject === undefined ? draft.subject : editedSubject.trim();
  const approvedBody = editedBody === undefined ? draft.body : editedBody.trim();
  // Header/body shape is enforced even for deterministic booking
  // confirmations, which deliberately skip the LLM-specific grounding checks.
  if (
    !approvedSubject ||
    approvedSubject.length > 160 ||
    /[\x00-\x1F\x7F]/.test(approvedSubject) ||
    !approvedBody ||
    approvedBody.length > 10_000
  ) {
    return { ok: false, error: SEND_ERR.safety };
  }
  const finalEditedSubject =
    editedSubject !== undefined && approvedSubject !== draft.subject.trim()
      ? approvedSubject
      : null;
  const finalEditedBody =
    editedBody !== undefined && approvedBody !== draft.body.trim() ? approvedBody : null;
  const hasOwnerEdits = finalEditedSubject !== null || finalEditedBody !== null;
  const wantsVoiceExample = !!saveVoiceExample && hasOwnerEdits;
  // Booking confirmations are deterministic contractual copy and deliberately
  // describe the newly-booked gig, so the reactive-draft availability rules do
  // not apply. Every LLM-authored reply is revalidated against the CURRENT gig
  // calendar immediately before it may claim the send slot. This catches a
  // booking added after generation and owner edits that introduce an ungrounded
  // price or promise.
  if (!draft.isConfirmation) {
    const eventDate = lead.eventDate ? isoDay(lead.eventDate) : null;
    const gigs =
      eventDate && lead.eventDate
        ? await db.gig.findMany({
            where: {
              businessId: lead.businessId,
              date: {
                gte: new Date(`${eventDate}T00:00:00Z`),
                lt: new Date(`${eventDate}T23:59:59.999Z`),
              },
            },
          })
        : [];
    const draftingMessages = (lead.messages ?? []).filter((message) => !message.autoReply);
    const safety = validateDraft(
      {
        business: {
          id: lead.business.id,
          name: lead.business.name,
          ownerName: lead.business.ownerName,
          performerKind: lead.business.performerKind,
          country: lead.business.country,
          currency: lead.business.currency,
          websiteUrl: lead.business.websiteUrl,
          bookingLinkUrl: lead.business.bookingLinkUrl,
          riderNotes: lead.business.riderNotes,
        },
        packages: lead.business.packages.map((pkg) => ({
          name: pkg.name,
          description: pkg.description,
          priceMin: pkg.priceMin,
          priceMax: pkg.priceMax,
          eventTypes: pkg.eventTypes,
        })),
        lead: {
          source: lead.source,
          subject: lead.rawSubject,
          clientName: lead.clientName,
          clientEmail: lead.clientEmail,
          eventType: lead.eventType,
          eventDate,
          venue: lead.venue,
          guestCount: lead.guestCount,
          budgetHint: lead.budgetHint,
          message:
            draftingMessages.filter((message) => message.direction === "INBOUND").at(-1)?.body ??
            lead.rawBody,
        },
        availability: checkAvailability(eventDate, gigs, lead.business.performers ?? []),
        thread: draftingMessages.map((message) => ({
          direction: message.direction,
          body: message.body,
        })),
        sequenceStep: draft.sequenceStep ?? 0,
      },
      {
        subject: approvedSubject,
        body: approvedBody,
        availabilityStatement: "not_addressed",
        wantsProfile: draft.wantsProfile,
        wantsQuote: draft.wantsQuote,
      },
    );
    if (safety.issues.length > 0) {
      await reportError(new Error(safety.issues.join("; ")), {
        kind: "draft-send-safety",
        businessId: lead.businessId,
        draftId: draft.id,
      });
      return { ok: false, error: SEND_ERR.safety };
    }
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
      subject: approvedSubject,
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
  const decidedStatus = hasOwnerEdits ? "EDITED" : "APPROVED";
  const sentAt = new Date();
  const followUpRun = draft.isFollowUp
    ? await db.sequenceRun.findUnique({
        where: { leadId: lead.id },
        include: { template: { select: { stepsDays: true } } },
      })
    : null;
  const recoveredStep =
    followUpRun && draft.isFollowUp
      ? Math.max(followUpRun.currentStep, draft.sequenceStep ?? 0)
      : 0;
  const writeTerminal = () =>
    db.$transaction([
      db.draft.update({
        where: { id: draft.id },
        // autoAttach is the reliable "the agent sent this itself" signal —
        // manual approveDraft never passes it. Keeps graduation honest.
        data: {
          status: decidedStatus,
          editedSubject: finalEditedSubject,
          editedBody: finalEditedBody,
          decidedAt: sentAt,
          autoSent: !!autoAttach,
        },
      }),
      db.message.create({
        data: {
          leadId: lead.id,
          direction: "OUTBOUND",
          subject: approvedSubject,
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
          firstReplyAt: lead.firstReplyAt ?? sentAt,
        },
      }),
      ...(followUpRun && recoveredStep > 0
        ? [
            db.sequenceRun.update({
              where: { id: followUpRun.id },
              data: {
                currentStep: recoveredStep,
                nextRunAt: nextRunAtAfterStep(
                  followUpRun.template.stepsDays,
                  recoveredStep,
                  sentAt,
                ),
                // A corrected-address resend reopens the run atomically with
                // the successful Message receipt. It can never remain stranded
                // behind the leadId unique constraint.
                stoppedAt: null,
                stopReason: null,
              },
            }),
          ]
        : []),
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
          data: {
            status: decidedStatus,
            editedSubject: finalEditedSubject,
            editedBody: finalEditedBody,
            decidedAt: new Date(),
          },
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

  // Voice examples are valuable feedback, but never part of the send receipt's
  // critical transaction. If this optional write fails, the delivered Message
  // and lead state remain correct. Re-read after delivery so a settings edit
  // made while the email was in flight is not overwritten by stale samples.
  if (wantsVoiceExample) {
    try {
      const current = await db.business.findUnique({
        where: { id: lead.businessId },
        select: { voiceSamples: true },
      });
      const nextVoiceSamples = appendVoiceExample(current?.voiceSamples, {
        kind: "reply",
        subject: approvedSubject,
        body: approvedBody,
      });
      if (current && nextVoiceSamples !== current.voiceSamples) {
        await db.$transaction([
          db.business.update({
            where: { id: lead.businessId },
            data: { voiceSamples: nextVoiceSamples },
          }),
          db.draft.update({
            where: { id: draft.id },
            data: { voiceSampleSavedAt: sentAt },
          }),
        ]);
      }
    } catch (err) {
      await reportError(err, {
        kind: "voice-example-save",
        businessId: lead.businessId,
        draftId: draft.id,
        note: "reply sent successfully; optional voice example was not saved",
      });
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
