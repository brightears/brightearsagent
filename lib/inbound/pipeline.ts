import { db } from "@/lib/db";
import type { InboundEmail, ParsedLead } from "@/lib/inbound/types";
import { sourceParsers } from "@/lib/inbound/registry";
import { parseFallback } from "@/lib/inbound/parsers/fallback";
import { detectForwardingConfirmation } from "@/lib/inbound/forwarding-confirmation";
import { htmlToText } from "@/lib/inbound/html-to-text";
import { triage, triageHeuristics, SPAM_THRESHOLD } from "@/lib/inbound/triage";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { sendDraftReply } from "@/lib/agent/send-reply";
import { meterState } from "@/lib/billing/metering";
import { canAutoSend } from "@/lib/inbound/auto-send";
import { notifyBusiness } from "@/lib/notify";
import { reportError } from "@/lib/report-error";

export type PipelineResult =
  | { outcome: "duplicate" }
  | { outcome: "no_tenant" }
  | { outcome: "reply_attached"; leadId: string }
  | { outcome: "ignored"; reason: string }
  | { outcome: "forwarding_confirmation"; provider: "gmail" }
  | { outcome: "venue_reply"; leadId: string; venueId: string }
  | { outcome: "lead_created"; leadId: string; status: "NEW" | "SPAM" };

const SLUG_RE = /leads@([a-z0-9-]+)\.in\./i;

export function extractSlug(toAddress: string): string | null {
  const m = toAddress.match(SLUG_RE);
  return m ? m[1].toLowerCase() : null;
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
  if (!slug) return { outcome: "no_tenant" };

  const business = await db.business.findUnique({ where: { slug } });
  if (!business) return { outcome: "no_tenant" };

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

  // Reply-match: a known client writing back attaches to their lead and wakes it up.
  const existing = await db.lead.findFirst({
    where: {
      businessId: business.id,
      clientEmail: { equals: email.from, mode: "insensitive" },
      status: { notIn: ["BOOKED", "DEAD", "SPAM"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
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
        db.lead.update({ where: { id: existing.id }, data: { status: "ENGAGED" } }),
        db.sequenceRun.updateMany({
          where: { leadId: existing.id, stoppedAt: null },
          data: { stoppedAt: new Date(), stopReason: "client_replied" },
        }),
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return { outcome: "duplicate" };
      throw err;
    }
    // A prospect writing back is the closest thing to money in the pipeline —
    // that moment used to be silent (audit 2026-07). Dual-channel, always.
    // (Drafting the mid-thread answer lands with the continue-conversation
    // task mode — P10.8; until then the artist replies from the thread view.)
    void notifyBusiness(business, {
      title: `They wrote back: ${existing.clientName ?? "a lead"}`,
      body: email.subject || "Open the thread to reply while it's hot.",
      url: `/dashboard/leads/${existing.id}`,
      emailBody: `${existing.clientName ?? "A lead"} just replied to you${email.subject ? ` — "${email.subject}"` : ""}.\n\nFollow-ups are paused for this one (they answered). Open the thread and reply while it's hot.`,
    }).catch(() => null);
    return { outcome: "reply_attached", leadId: existing.id };
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
    // The money moment of the whole Hunt — a venue is talking. Dual-channel.
    void notifyBusiness(business, {
      title: `A venue wrote back: ${venue.name}`,
      body: email.subject || "Open the thread and keep it warm.",
      url: `/dashboard/leads/${venueLead.id}`,
      emailBody: `${venue.name} just replied to your pitch${email.subject ? ` — "${email.subject}"` : ""}.\n\nThis is the moment the Hunt exists for. Open the thread and answer while it's hot.`,
    }).catch(() => null);
    return { outcome: "venue_reply", leadId: venueLead.id, venueId: venue.id };
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
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === parsed.eventDate) {
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
    const meter = await meterState(business.id, business.plan, new Date(), business.trialEndsAt);
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
    } else if (canAutoSend(business.plan, business.autoSendSources, parsed.source)) {
      // Auto-send autonomy (Pro+ tier capability): draft AND send without waiting
      // for approval, but ONLY from a source the owner trusts (and never a
      // ToS-ineligible one — guaranteed by canAutoSend). Degrades gracefully: if
      // the send fails or is blocked (no client email, opted-out, etc.) the draft
      // stays PENDING and the owner gets the normal "approve" ping to send it.
      const clientName = lead.clientName;
      const leadId = lead.id;
      void (async () => {
        try {
          const draftId = await generateDraftForLead(leadId, 0, { suppressPush: true });
          if (!draftId) return; // deduped / closed — nothing to send
          // autoAttach: honor the artist's auto-attach toggles + detected intent.
          const res = await sendDraftReply({ draftId, businessId: business.id, autoAttach: true });
          if (res.ok) {
            // Informational receipt — push only. Emailing the owner for every
            // reply the agent sent on its own would defeat the point of
            // autonomy (the weekly report totals these).
            await notifyBusiness(business, {
              title: `Auto-replied: ${clientName ?? "new lead"}`,
              body: "Sent in your voice — tap to view the thread.",
              url: `/dashboard/leads/${leadId}`,
              pushOnly: true,
            }).catch(() => null);
          } else {
            // Blocked send degrades to a normal approval — that's action
            // needed, so it goes dual-channel like every "Reply ready".
            await notifyBusiness(business, {
              title: `Reply ready: ${clientName ?? "new lead"}`,
              body: "Auto-send was blocked for this one — tap to review and send.",
              url: `/dashboard/leads/${leadId}`,
            }).catch(() => null);
          }
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
