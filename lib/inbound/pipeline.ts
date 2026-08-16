import { db } from "@/lib/db";
import type { InboundEmail, ParsedLead } from "@/lib/inbound/types";
import { sourceParsers } from "@/lib/inbound/registry";
import { parseFallback } from "@/lib/inbound/parsers/fallback";
import { detectForwardingConfirmation } from "@/lib/inbound/forwarding-confirmation";
import { htmlToText } from "@/lib/inbound/html-to-text";
import { triage, triageHeuristics, SPAM_THRESHOLD } from "@/lib/inbound/triage";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { scheduleAutonomousSend } from "@/lib/agent/schedule-send";
import { meterState } from "@/lib/billing/metering";
import { canAutoSend, clientEmailGrounded } from "@/lib/inbound/auto-send";
import { notifyBusiness } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { noteUnrouted, isFirstSighting, nearestSlug } from "@/lib/inbound/unrouted";
import { rateLimit } from "@/lib/rate-limit";
import { detectAutoReply } from "@/lib/inbound/auto-reply";
import { detectExplicitOptOut } from "@/lib/inbound/opt-out-intent";
import { assessReplyMatch } from "@/lib/inbound/reply-match";
import {
  globalSuppressionUpsertArgs,
  normalizeOutreachEmail,
  tenantSuppressionUpsertArgs,
} from "@/lib/outreach/suppression";

export type PipelineResult =
  | { outcome: "duplicate" }
  | { outcome: "no_tenant" }
  | { outcome: "reply_attached"; leadId: string }
  | { outcome: "ignored"; reason: string }
  | { outcome: "forwarding_confirmation"; provider: "gmail" }
  | { outcome: "venue_reply"; leadId: string; venueId: string }
  | { outcome: "opted_out"; leadId?: string; venueId?: string }
  | { outcome: "lead_created"; leadId: string; status: "NEW" | "SPAM" };

// Anchored local part: only exactly "leads@" (at the start or after a
// delimiter like "<", whitespace, or a list comma) claims the tenant inlet —
// an unanchored match would let "djleads@slug.in..." impersonate a tenant.
const SLUG_RE = /(?:^|[\s<,;:"'])leads@([a-z0-9-]+)\.in\./i;

/**
 * The EPK availability form's synthetic system sender (app/actions/epk.ts).
 * Leads from this sender carry an ATTACKER-SUPPLIED reply address (public,
 * unauthenticated form) and are excluded from auto-send below.
 */
export const EPK_FORM_SENDER = "notification@forms.brightears.io";

export function extractSlug(toAddress: string): string | null {
  const m = toAddress.match(SLUG_RE);
  return m ? m[1].toLowerCase() : null;
}

/**
 * How long a quiet conversation keeps claiming new mail from the same address.
 * Long enough for a client chasing their own unanswered inquiry, short enough
 * that next season's booking is recognised as the new lead it is.
 */
const REPLY_MATCH_WINDOW_DAYS = 45;

function withinReplyWindow(lastActivity: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastActivity.getTime() <= REPLY_MATCH_WINDOW_DAYS * 86_400_000;
}


/**
 * Record mail addressed to a lead address no tenant owns, and alert on a first
 * sighting.
 *
 * Stray internet mail hitting a random slug is normal and must not page anyone.
 * The case worth catching is a customer who typo'd their forwarding address in
 * onboarding: the wildcard MX means Postmark accepts `leads@nobert.in...` just
 * as happily as `leads@norbert.in...`, no tenant matches, and their real
 * inquiries vanish with nobody the wiser. Naming the near-miss tenant is what
 * turns a shrug into an action.
 *
 * Rate limited GLOBALLY rather than per address: a spam run against invented
 * slugs would otherwise send one email per address, since reportError dedupes on
 * a signature that includes the address. The nightly digest carries the full
 * tally, so this only needs to be a nudge.
 *
 * Awaited, not fire-and-forget: nothing is waiting on this path (no real client
 * inquiry is being delayed), and a voided promise can be cut short when the
 * request ends, which would lose exactly the alert we came for.
 */
async function noteUnroutedRecipient(to: string, slug: string | null): Promise<void> {
  try {
    const entry = noteUnrouted(to, slug);
    if (!entry || !isFirstSighting(entry)) return;
    if (!rateLimit("unrouted-alert", 3, 3600_000).ok) return;

    const slugs = slug ? (await db.business.findMany({ select: { slug: true } })).map((b) => b.slug) : [];
    const near = nearestSlug(slug, slugs);
    await reportError(new Error(`inbound mail for an address no tenant owns: ${to}`), {
      kind: "inbound_unrouted",
      detail: near
        ? `LIKELY FORWARDING TYPO: slug "${slug}" is ${near.distance} character(s) from the real tenant "${near.slug}". If that artist set up forwarding recently, their inquiries are going nowhere — check their lead address.`
        : `Slug ${slug ? `"${slug}"` : "(unparseable address)"} matches no tenant and is not close to one. Most likely stray mail or a probe; no action needed unless it repeats.`,
    });
  } catch {
    // Visibility must never break the inlet. A dropped alert is bad; a webhook
    // that 500s because alerting failed would make Postmark retry real mail.
  }
}

/** The whole inbound path: tenant → idempotency → reply-match → parse → triage → Lead. */
export async function processInbound(email: InboundEmail): Promise<PipelineResult> {
  // HTML-only senders give Postmark no TextBody (10.9): strip the markup to
  // text ONCE at the door, so parsers, triage, the thread view, and the
  // drafter all see the words instead of an empty string.
  if (!email.textBody.trim() && email.htmlBody) {
    email = { ...email, textBody: htmlToText(email.htmlBody) };
  }

  const slug = extractSlug(email.to);
  if (!slug) {
    await noteUnroutedRecipient(email.to, null);
    return { outcome: "no_tenant" };
  }

  const business = await db.business.findUnique({ where: { slug } });
  if (!business) {
    await noteUnroutedRecipient(email.to, slug);
    return { outcome: "no_tenant" };
  }

  // Idempotency: providers redeliver webhooks.
  if (email.providerMessageId) {
    const dupe = await db.message.findFirst({
      where: { providerMessageId: email.providerMessageId },
      select: { id: true },
    });
    if (dupe) return { outcome: "duplicate" };
  }

  // Provider forwarding confirmations (Gmail's verification email) are the
  // step the whole inlet hangs on — intercept BEFORE parse/triage, which
  // would read them as automated notices and drop them. Store the approval
  // link + code for onboarding step 5 and ping the owner on both channels.
  const confirmation = detectForwardingConfirmation(email);
  if (confirmation) {
    const isNew = business.forwardingConfirmUrl !== confirmation.url;
    await db.business.update({
      where: { id: business.id },
      data: {
        forwardingConfirmUrl: confirmation.url,
        forwardingConfirmCode: confirmation.code,
        forwardingConfirmAt: new Date(),
      },
    });
    // Redeliveries of the same confirmation don't re-ping.
    if (isNew) {
      await notifyBusiness(business, {
        title: "One click left — approve Gmail forwarding",
        body: "Gmail sent its confirmation. Approve it and every inquiry starts flowing to your assistant.",
        url: "/onboarding",
        emailBody:
          "Gmail just sent the forwarding confirmation for your lead address.\n\nOpen your setup and click the approval link (it's waiting on the 'Connect your leads' step) — that's the last step before every inquiry starts answering itself.",
      });
    }
    return { outcome: "forwarding_confirmation", provider: confirmation.provider };
  }

  // Is this a machine's auto-reply rather than a human answering? Computed ONCE
  // here and consulted in exactly two places below — the reply-match branch and
  // the venue branch — because those are the only two that treat an inbound
  // message as "they responded to us". Everything else (parse, triage, the new
  // lead path) is unaffected by design.
  const autoReply = detectAutoReply(email);
  // Consent detection runs only on the sender's NEW, de-quoted words. Our own
  // quoted compliance footer contains opt-out language, and an auto-responder
  // can contain an unsubscribe footer too; neither may suppress a real person.
  const optOutReason = autoReply ? null : detectExplicitOptOut(email.textBody);

  // Reply-match: a known client writing back attaches to their lead and wakes
  // it up — but only while that conversation is still plausibly ALIVE and the
  // message carries positive continuity evidence. Sender address is a candidate
  // lookup, never proof that two inquiries concern the same event.
  //
  // The window is not optional (found live on the apex, 2026-07-27). Matching
  // on address alone, forever, turns any lead that never got a first reply into
  // a permanent capture trap for that address: every later email from that
  // person — a different event, a year later — is filed as a reply to the old
  // lead instead of becoming a new one. Nothing errors, no counter moves, the
  // owner simply never learns the inquiry arrived. And it is not a rare corner:
  // a lead only reaches DEAD through sequence exhaustion, sequences only start
  // once a first reply is SENT, and the whole engine is gated on isAgentPaused
  // — so for an unsubscribed tenant EVERY lead they own is such a trap.
  //
  // Measured from the lead's most recent message, so the window slides: an
  // active back-and-forth never falls out however long it runs, while a lead
  // nobody has touched in REPLY_MATCH_WINDOW_DAYS stops swallowing mail. The
  // "client double-emails before our first reply" case the code below cares
  // about happens in minutes, and is comfortably inside it.
  // A high-confidence opt-out belongs on the latest historical conversation
  // even when it is old or terminal. Keep that compliance path exactly as it
  // was; compatibility scoring must never divert a stop request into a fresh
  // sales lead.
  const optOutCandidate = optOutReason
    ? await db.lead.findFirst({
        where: {
          businessId: business.id,
          clientEmail: { equals: email.from, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      })
    : null;

  const now = new Date();
  const replyWindowStart = new Date(now.getTime() - REPLY_MATCH_WINDOW_DAYS * 86_400_000);
  const replyCandidates = optOutReason
    ? []
    : await db.lead.findMany({
        where: {
          businessId: business.id,
          clientEmail: { equals: email.from, mode: "insensitive" },
          status: { notIn: ["BOOKED", "DEAD", "SPAM"] },
          // A lead may be older than the window while its conversation is not.
          OR: [
            { createdAt: { gte: replyWindowStart } },
            { messages: { some: { createdAt: { gte: replyWindowStart } } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              createdAt: true,
              subject: true,
              providerMessageId: true,
            },
          },
        },
      });

  // Score every plausible conversation instead of blindly picking the newest.
  // This matters after a repeat client has two live events: an In-Reply-To or
  // matching subject can still route a later response to the older one.
  const liveReplyCandidates = replyCandidates.filter((candidate) =>
    withinReplyWindow(candidate.messages[0]?.createdAt ?? candidate.createdAt, now),
  );
  const bestReply = liveReplyCandidates
    .map((candidate) => ({
      candidate,
      assessment: assessReplyMatch(email, candidate, now),
    }))
    .filter(({ assessment }) => assessment.attach)
    .sort((a, b) => b.assessment.score - a.assessment.score)[0]?.candidate;
  // Machine replies never mutate commercial state (the branch below only
  // records them), so preserve the old safe fallback: if an OOO mangled its
  // subject or mentions a return date that looks like an event conflict, file
  // it on the newest live conversation instead of manufacturing a new lead.
  const existing = optOutCandidate ?? bestReply ?? (autoReply ? liveReplyCandidates[0] : null);
  if (existing) {
    // AUTO-REPLY: record it so the thread is complete, then change NOTHING else.
    //
    // Specifically: do not flip to ENGAGED, do not stop the SequenceRun, do not
    // expire a PENDING draft, do not draft a mid-thread answer, and do not fire
    // the "they wrote back" push. Every one of those is the right response to a
    // human and the wrong response to a mail server. Stopping the run is the
    // unrecoverable one — prisma/schema.prisma documents stoppedAt as "never
    // resumes", and the sequence engine re-stops any ENGAGED lead anyway, so a
    // single OOO used to end the follow-up permanently.
    //
    // The Message is still written: it keeps the thread honest for the owner
    // reading it, and it preserves the providerMessageId idempotency backstop so
    // a webhook redelivery is recognised as a duplicate rather than replayed.
    if (autoReply) {
      try {
        await db.message.create({
          data: {
            leadId: existing.id,
            direction: "INBOUND",
            subject: email.subject,
            body: email.textBody,
            fromEmail: email.from,
            toEmail: email.to,
            providerMessageId: email.providerMessageId,
            autoReply: true,
          },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") return { outcome: "duplicate" };
        throw err;
      }
      console.warn(
        JSON.stringify({
          level: "warn",
          kind: "inbound_auto_reply",
          leadId: existing.id,
          businessId: business.id,
          signal: autoReply,
          message:
            "Auto-reply recorded on the thread; lead status and follow-up sequence left untouched.",
          ts: new Date().toISOString(),
        }),
      );
      return { outcome: "ignored", reason: "auto_reply" };
    }

    // A direct stop request is a compliance event, not a sales objection. Keep
    // the inbound Message for the audit trail, then atomically close the lead,
    // stop every queued reply/follow-up and suppress the lowercase address. A
    // Hunt-backed lead also closes its Venue and any unsent follow-up pitch.
    // Nothing below this branch (LLM draft + money-moment notification) runs.
    if (optOutReason) {
      const at = new Date();
      const suppressionEmail = email.from.trim().toLowerCase();
      const stopReason = optOutReason === "cease-and-desist" ? "cease_and_desist" : "opted_out";
      try {
        await db.$transaction([
          db.message.create({
            data: {
              leadId: existing.id,
              direction: "INBOUND",
              subject: email.subject,
              body: email.textBody,
              fromEmail: email.from,
              toEmail: email.to,
              providerMessageId: email.providerMessageId,
            },
          }),
          db.lead.update({
            where: { id: existing.id },
            data:
              existing.status === "BOOKED"
                ? { optedOut: true }
                : { status: "DEAD", optedOut: true, deadAt: existing.deadAt ?? at },
          }),
          db.sequenceRun.updateMany({
            where: { leadId: existing.id, stoppedAt: null },
            data: { stoppedAt: at, stopReason },
          }),
          db.draft.updateMany({
            where: { leadId: existing.id, status: "PENDING" },
            data: { status: "EXPIRED", decidedAt: at, scheduledSendAt: null },
          }),
          db.outreachSuppression.upsert(
            tenantSuppressionUpsertArgs({
              businessId: business.id,
              email: suppressionEmail,
              reason: optOutReason,
            }),
          ),
          db.globalOutreachSuppression.upsert(
            globalSuppressionUpsertArgs({
              email: suppressionEmail,
              reason: optOutReason,
              business,
            }),
          ),
          ...(existing.venueId
            ? [
                db.venue.updateMany({
                  where: {
                    id: existing.venueId,
                    businessId: business.id,
                    // BOOKED is already a hard stop and remains the commercial
                    // outcome; the master suppression still prevents contact.
                    status: { not: "BOOKED" },
                  },
                  data: {
                    status: "SUPPRESSED",
                    suppressedReason: optOutReason,
                    contactState: "SUPPRESSED",
                    contactRetryAfter: null,
                  },
                }),
                db.venuePitch.updateMany({
                  where: {
                    venueId: existing.venueId,
                    businessId: business.id,
                    status: { in: ["PENDING", "APPROVED"] },
                  },
                  data: { status: "EXPIRED", decidedAt: at },
                }),
              ]
            : []),
        ]);
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") return { outcome: "duplicate" };
        throw err;
      }
      void notifyBusiness(business, {
        title: `Do-not-contact saved: ${existing.clientName ?? email.from}`,
        body: "Their request is on your suppression list. Nothing was drafted or sent.",
        url: `/dashboard/leads/${existing.id}`,
      }).catch(() => null);
      return {
        outcome: "opted_out",
        leadId: existing.id,
        ...(existing.venueId ? { venueId: existing.venueId } : {}),
      };
    }

    // ENGAGED means "they answered US" — it only applies once the thread has
    // at least one OUTBOUND message. A client double-emailing before our first
    // reply must NOT flip to ENGAGED: sendDraftReply skips sequence creation
    // for ENGAGED leads, so a premature flip would kill every follow-up for
    // that lead. Without an outbound, keep the current status (NEW/DRAFTED) —
    // the fresh draft below answers both messages.
    const hasOutbound =
      (await db.message.count({
        where: { leadId: existing.id, direction: "OUTBOUND" },
      })) > 0;
    try {
      await db.$transaction([
        db.message.create({
          data: {
            leadId: existing.id,
            direction: "INBOUND",
            subject: email.subject,
            body: email.textBody,
            fromEmail: email.from,
            toEmail: email.to,
            providerMessageId: email.providerMessageId,
          },
        }),
        ...(hasOutbound
          ? [db.lead.update({ where: { id: existing.id }, data: { status: "ENGAGED" } })]
          : []),
        db.sequenceRun.updateMany({
          where: { leadId: existing.id, stoppedAt: null },
          data: { stoppedAt: new Date(), stopReason: "client_replied" },
        }),
        // Supersede any PENDING draft (P15 review): the client just changed
        // the conversation, so a draft that answered the OLD message must not
        // auto-fire on its buffer AND must not block the fresh mid-thread
        // draft (generateDraftForLead dedupes on PENDING). Expiring it clears
        // both — the new answer is written against the full thread below.
        db.draft.updateMany({
          where: { leadId: existing.id, status: "PENDING" },
          data: { status: "EXPIRED", decidedAt: new Date(), scheduledSendAt: null },
        }),
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { outcome: "duplicate" };
      throw err;
    }
    // Mid-thread draft (P10.8): the continue-conversation task mode answers
    // them in the artist's voice — no re-introduction — and waits as a
    // PENDING draft. Fire-and-forget like the NEW-lead path; the cap gate
    // keeps drafting paused for unsubscribed/over-cap tenants (the copy
    // promise: pause, never a surprise bill). suppressPush: the "they wrote
    // back" ping below is THE ping — two pushes seconds apart is noise.
    const meter = await meterState(
      business.id,
      business.plan,
      new Date(),
      business.trialEndsAt,
      business.timezone,
    );
    const drafting = !meter.overCap;
    if (drafting) {
      const leadId = existing.id;
      void generateDraftForLead(leadId, 0, { suppressPush: true }).catch((err) =>
        reportError(err, { kind: "mid-thread-draft", businessId: business.id, leadId }),
      );
    }
    // A prospect writing back is the closest thing to money in the pipeline —
    // that moment used to be silent (audit 2026-07). Dual-channel, always.
    void notifyBusiness(business, {
      title: `They wrote back: ${existing.clientName ?? "a lead"}`,
      body: email.subject || "Open the thread to reply while it's hot.",
      url: `/dashboard/leads/${existing.id}`,
      emailBody: `${existing.clientName ?? "A lead"} just replied to you${email.subject ? ` — "${email.subject}"` : ""}.\n\nFollow-ups are paused for this one (they answered).${drafting ? " Your assistant is drafting the answer in your voice — it'll be waiting in the thread." : ""} Open the thread and reply while it's hot.`,
    }).catch(() => null);
    return { outcome: "reply_attached", leadId: existing.id };
  }

  // An auto-reply that matched no existing conversation must go no further.
  //
  // Reaching the venue branch would flip venue.status PITCHED → REPLIED, and
  // lib/venues/follow-up.ts requires PITCHED to send the single polite +6-day
  // bump — so a mail server's holiday notice would cancel the follow-up on a
  // pitch no human has read. Reaching the new-lead path would manufacture a
  // "lead" out of an OOO, with no inquiry behind it.
  //
  // Leaving the venue on PITCHED is not merely safe, it is CORRECT: the venue
  // genuinely has not replied, so the bump should still go.
  if (autoReply) {
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "inbound_auto_reply_unmatched",
        businessId: business.id,
        from: email.from,
        signal: autoReply,
        message:
          "Auto-reply matched no open conversation — dropped before venue capture and lead creation so the pitch bump survives.",
        ts: new Date().toISOString(),
      }),
    );
    return { outcome: "ignored", reason: "auto_reply" };
  }

  // Venue reply capture (P8.3): a venue answering a Hunt pitch — pitches set
  // Reply-To to this parse address — becomes a Lead in the EXISTING close
  // pipeline (ADR-004: replies merge into the close flow). Only the FIRST
  // reply lands here: the Lead it creates carries the venue's email as
  // clientEmail, so every later message matches the reply-match branch above
  // like any other conversation. repliedAt is the 10.9 reply-rate stamp.
  const venue = await db.venue.findFirst({
    where: {
      businessId: business.id,
      bookingEmail: { equals: email.from, mode: "insensitive" },
      status: { in: ["PITCHED", "REPLIED", "IN_CONVERSATION"] },
    },
    orderBy: { pitchedAt: "desc" },
  });
  if (venue) {
    // Seed the thread with the pitch we actually sent (10.8): it went out via
    // the artist's own Gmail, so it only exists on VenuePitch — without it the
    // lead thread starts mid-air, the owner can't see what the venue is
    // answering, and the continue-conversation drafter would re-introduce.
    const sentPitch = await db.venuePitch.findFirst({
      where: { venueId: venue.id, businessId: business.id, status: "SENT" },
      orderBy: { sentAt: "desc" },
      select: { subject: true, editedSubject: true, body: true, editedBody: true, sentAt: true },
    });

    // The first reply to a Hunt pitch can itself be the stop request. Preserve
    // both the sent pitch and the inbound words on a terminal Lead, while the
    // same transaction suppresses the target and cancels any queued bump.
    // An opt-out is not stamped as repliedAt: it must not masquerade as a
    // successful beta conversation.
    if (optOutReason) {
      const at = new Date();
      const suppressionEmail = email.from.trim().toLowerCase();
      let optedOutLead;
      try {
        [optedOutLead] = await db.$transaction([
          db.lead.create({
            data: {
              businessId: business.id,
              source: "VENUE_OUTREACH",
              status: "DEAD",
              optedOut: true,
              deadAt: at,
              venueId: venue.id,
              clientName: venue.bookingContactName ?? venue.name,
              clientEmail: email.from,
              eventType: "venue booking",
              venue: venue.name,
              rawSubject: email.subject,
              rawBody: email.textBody,
              messages: {
                create: [
                  ...(sentPitch
                    ? [
                        {
                          direction: "OUTBOUND" as const,
                          subject: sentPitch.editedSubject ?? sentPitch.subject,
                          body: sentPitch.editedBody ?? sentPitch.body,
                          ...(sentPitch.sentAt ? { createdAt: sentPitch.sentAt } : {}),
                        },
                      ]
                    : []),
                  {
                    direction: "INBOUND" as const,
                    subject: email.subject,
                    body: email.textBody,
                    fromEmail: email.from,
                    toEmail: email.to,
                    providerMessageId: email.providerMessageId,
                  },
                ],
              },
            },
          }),
          db.venue.updateMany({
            where: { id: venue.id, businessId: business.id, status: { not: "BOOKED" } },
            data: {
              status: "SUPPRESSED",
              suppressedReason: optOutReason,
              contactState: "SUPPRESSED",
              contactRetryAfter: null,
            },
          }),
          db.outreachSuppression.upsert(
            tenantSuppressionUpsertArgs({
              businessId: business.id,
              email: suppressionEmail,
              reason: optOutReason,
            }),
          ),
          db.globalOutreachSuppression.upsert(
            globalSuppressionUpsertArgs({
              email: suppressionEmail,
              reason: optOutReason,
              business,
            }),
          ),
          db.venuePitch.updateMany({
            where: {
              venueId: venue.id,
              businessId: business.id,
              status: { in: ["PENDING", "APPROVED"] },
            },
            data: { status: "EXPIRED", decidedAt: at },
          }),
        ]);
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") return { outcome: "duplicate" };
        throw err;
      }
      void notifyBusiness(business, {
        title: `Do-not-contact saved: ${venue.name}`,
        body: "Their request is on your suppression list. Nothing was drafted or sent.",
        url: `/dashboard/leads/${optedOutLead.id}`,
      }).catch(() => null);
      return { outcome: "opted_out", leadId: optedOutLead.id, venueId: venue.id };
    }

    let venueLead;
    try {
      venueLead = await db.lead.create({
        data: {
          businessId: business.id,
          source: "VENUE_OUTREACH",
          status: "ENGAGED", // they replied to OUR outreach — already a conversation
          venueId: venue.id,
          clientName: venue.bookingContactName ?? venue.name,
          clientEmail: email.from,
          eventType: "venue booking",
          venue: venue.name,
          rawSubject: email.subject,
          rawBody: email.textBody,
          messages: {
            create: [
              ...(sentPitch
                ? [
                    {
                      direction: "OUTBOUND" as const,
                      subject: sentPitch.editedSubject ?? sentPitch.subject,
                      body: sentPitch.editedBody ?? sentPitch.body,
                      // Backdate to the real send moment so the thread reads
                      // in order (pitch → their reply).
                      ...(sentPitch.sentAt ? { createdAt: sentPitch.sentAt } : {}),
                    },
                  ]
                : []),
              {
                direction: "INBOUND" as const,
                subject: email.subject,
                body: email.textBody,
                fromEmail: email.from,
                toEmail: email.to,
                providerMessageId: email.providerMessageId,
              },
            ],
          },
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { outcome: "duplicate" };
      throw err;
    }
    await db.venue.update({
      where: { id: venue.id },
      data: {
        status: venue.status === "PITCHED" ? "REPLIED" : "IN_CONVERSATION",
        ...(venue.repliedAt ? {} : { repliedAt: new Date() }),
      },
    });
    // Mid-thread draft (P10.8) — same continue-conversation mode as client
    // replies; the seeded pitch above gives the drafter the real thread.
    const venueMeter = await meterState(
      business.id,
      business.plan,
      new Date(),
      business.trialEndsAt,
      business.timezone,
    );
    const draftingVenueReply = !venueMeter.overCap;
    if (draftingVenueReply) {
      const leadId = venueLead.id;
      void generateDraftForLead(leadId, 0, { suppressPush: true }).catch((err) =>
        reportError(err, { kind: "mid-thread-draft", businessId: business.id, leadId }),
      );
    }
    // The money moment of the whole Hunt — a venue is talking. Dual-channel.
    void notifyBusiness(business, {
      title: `A venue wrote back: ${venue.name}`,
      body: email.subject || "Open the thread and keep it warm.",
      url: `/dashboard/leads/${venueLead.id}`,
      emailBody: `${venue.name} just replied to your pitch${email.subject ? ` — "${email.subject}"` : ""}.\n\nThis is the moment the Hunt exists for.${draftingVenueReply ? " Your assistant is drafting the answer in your voice — it'll be waiting in the thread." : ""} Open the thread and answer while it's hot.`,
    }).catch(() => null);
    return { outcome: "venue_reply", leadId: venueLead.id, venueId: venue.id };
  }

  // A direct stop request is still authoritative when no historical lead or
  // Hunt venue can be matched. Persist both scopes atomically and stop here:
  // manufacturing a fresh sales lead from an unsubscribe would invite a later
  // draft and misreport the compliance event as a new inquiry.
  if (optOutReason) {
    const suppressionEmail = normalizeOutreachEmail(email.from);
    await db.$transaction([
      db.outreachSuppression.upsert(
        tenantSuppressionUpsertArgs({
          businessId: business.id,
          email: suppressionEmail,
          reason: optOutReason,
        }),
      ),
      db.globalOutreachSuppression.upsert(
        globalSuppressionUpsertArgs({
          email: suppressionEmail,
          reason: optOutReason,
          business,
        }),
      ),
    ]);
    return { outcome: "opted_out" };
  }

  // Parse: deterministic source parsers first, LLM fallback for the rest.
  let parsed: ParsedLead | null = null;
  let fromSourceParser = false;
  for (const parser of sourceParsers) {
    if (parser.match(email)) {
      parsed = parser.parse(email);
      if (parsed) {
        fromSourceParser = true;
        break;
      }
    }
  }
  // Platform lead notifications (The Knot/WW/Bark/GigSalad) are pre-vetted by the
  // platform and full of newsletter-ish boilerplate that fools generic triage —
  // run only the scam heuristics on them, never the LLM/bulk-mail classifier.
  // Fallback path: parse and triage are independent LLM calls — run them concurrently.
  let verdict;
  if (fromSourceParser && parsed && parsed.confidence >= 0.8) {
    verdict = triageHeuristics(email, /* scamOnly */ true);
  } else if (!parsed) {
    const [p, v] = await Promise.all([parseFallback(email, business.id), triage(email, business.id)]);
    parsed = p;
    verdict = v;
  } else {
    verdict = await triage(email, business.id);
  }
  if (!parsed) return { outcome: "ignored", reason: "not an inquiry" };
  const isSpam = verdict.spamScore >= SPAM_THRESHOLD;

  // Validate the parsed date is a REAL calendar date — "2026-09-31" matches the
  // shape regex but new Date() rolls it to Oct 1 (or yields Invalid Date),
  // which would crash lead.create on a webhook Postmark keeps redelivering.
  let eventDate: Date | undefined;
  if (parsed.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.eventDate)) {
    const d = new Date(`${parsed.eventDate}T12:00:00Z`);
    if (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === parsed.eventDate &&
      // A date already in the past is a mis-resolved year ("next year" → last
      // year, staging catch 2026-07-10) — drop it so the draft asks for the
      // date instead of confidently affirming a wrong one. 48h grace keeps
      // timezone-straddling "yesterday/today" inquiries intact.
      d.getTime() > Date.now() - 48 * 60 * 60 * 1000
    ) {
      eventDate = d;
    }
    // else: drop the unparseable date; the draft just asks them to confirm it.
  }

  let lead;
  try {
    lead = await db.lead.create({
      data: {
        businessId: business.id,
        source: parsed.source,
        status: isSpam ? "SPAM" : "NEW",
        clientName: parsed.clientName,
        clientEmail: parsed.clientEmail,
        clientPhone: parsed.clientPhone,
        eventType: parsed.eventType?.toLowerCase(),
        eventDate,
        venue: parsed.venue,
        guestCount: parsed.guestCount,
        budgetHint: parsed.budgetHint,
        rawSubject: email.subject,
        rawBody: email.textBody,
        spamScore: verdict.spamScore,
        spamReason: verdict.reason,
        messages: {
          create: {
            direction: "INBOUND",
            subject: email.subject,
            body: email.textBody,
            fromEmail: email.from,
            toEmail: email.to,
            providerMessageId: email.providerMessageId,
          },
        },
      },
    });
  } catch (err) {
    // Concurrent redelivery lost the race on the providerMessageId unique index.
    if ((err as { code?: string }).code === "P2002") return { outcome: "duplicate" };
    throw err;
  }

  // Draft generation runs in the background (persistent server) so the webhook
  // answers Postmark fast; failures are logged and retried by the sequence cron.
  // Lead-cap metering: at cap we still INGEST (never lose a lead) but pause
  // drafting and nudge the owner — never a surprise bill (CLAUDE.md pricing).
  if (!isSpam) {
    const meter = await meterState(
      business.id,
      business.plan,
      new Date(),
      business.trialEndsAt,
      business.timezone,
    );
    if (meter.overCap) {
      // Transition-triggered only (audit 2026-07: this fired on EVERY lead) —
      // and the copy tells the truth per state. For a subscribed tenant the
      // cap-crossing lead is the strongest possible upgrade evidence; for an
      // unsubscribed one, the first inquiry of the month is the activation
      // nudge. Both dual-channel; repeats stay silent (the dashboard banner
      // and checklist carry the standing state).
      const subscribed = !!business.stripeSubscriptionId;
      const justCrossed = subscribed ? meter.used === meter.cap + 1 : meter.used === 1;
      if (justCrossed) {
        void notifyBusiness(business, {
          title: subscribed ? "Your agent hit this month's cap" : "A new inquiry is waiting",
          body: subscribed
            ? `It answered ${meter.cap} inquiries this month — new ones are waiting. Upgrade to keep replies flowing.`
            : "Subscribe and your agent answers it in your voice — usually within minutes.",
          url: "/dashboard/settings#billing",
          emailBody: subscribed
            ? `Your agent answered ${meter.cap} inquiries this month — and more are arriving. Drafting is paused (never a surprise bill); one tap and the next tier keeps replies flowing.`
            : "An inquiry just arrived at your lead address. Your agent is set up and paused — subscribe and it answers this one, and every one after, in your voice.",
        }).catch(() => null);
      }
    } else if (
      // EPK-origin inquiries NEVER auto-send their first outbound: the EPK
      // form is public and unauthenticated, so the "client" email is whatever
      // an attacker typed — and it appears verbatim in the synthetic body, so
      // clientEmailGrounded alone would pass it. Auto-sending would turn the
      // form into a spam relay to any unverified address (even with the
      // tenant's WEBSITE_FORM autonomy on). Drafting stays intact — only the
      // autonomous send is gated to the manual-approve path.
      email.from.toLowerCase() !== EPK_FORM_SENDER &&
      canAutoSend(business.plan, business.autoSendSources, parsed.source) &&
      // P10.5: autonomy only toward a grounded reply address — an ungrounded
      // (possibly hallucinated) clientEmail drops to the normal approve flow.
      clientEmailGrounded({
        clientEmail: parsed.clientEmail,
        from: email.from,
        textBody: email.textBody,
        fromSourceParser,
      })
    ) {
      // Auto-send autonomy (Pro+ tier capability): draft, then SCHEDULE the
      // send behind the 15-minute "sending soon" buffer (P10.4) — never fire
      // instantly. The owner gets a holding-state ping with a Hold path;
      // approving early sends immediately; the sequence tick fires whatever
      // elapsed (lib/agent/schedule-send.ts owns blocked/failure degrades).
      const clientName = lead.clientName;
      const leadId = lead.id;
      void (async () => {
        try {
          const draftId = await generateDraftForLead(leadId, 0, { suppressPush: true });
          if (!draftId) return; // deduped / closed — nothing to send
          const at = await scheduleAutonomousSend(draftId);
          if (!at) return; // draft already moved — its own flow notified
          await notifyBusiness(business, {
            title: `Sending soon: ${clientName ?? "new lead"}`,
            body: "The reply goes out in 15 minutes — open it to read, hold, or send now.",
            url: `/dashboard/leads/${leadId}`,
            pushOnly: true,
          }).catch(() => null);
        } catch (err) {
          // Background failure used to vanish into console.error (audit
          // 2026-07): now the founder hears about it (rate-limited ops alert)
          // AND the owner gets the normal action ping — the draft, if it was
          // created, is sitting in PENDING either way.
          void reportError(err, { kind: "auto-send", businessId: business.id, leadId });
          await notifyBusiness(business, {
            title: `New inquiry needs you: ${clientName ?? "new lead"}`,
            body: "The automatic reply didn't go out — tap to review.",
            url: `/dashboard/leads/${leadId}`,
          }).catch(() => null);
        }
      })();
    } else {
      void generateDraftForLead(lead.id).catch((err) =>
        reportError(err, { kind: "draft-generation", businessId: business.id, leadId: lead.id }),
      );
    }
  }

  return { outcome: "lead_created", leadId: lead.id, status: isSpam ? "SPAM" : "NEW" };
}
