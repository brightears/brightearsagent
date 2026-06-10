import { db } from "@/lib/db";
import type { InboundEmail, ParsedLead } from "@/lib/inbound/types";
import { sourceParsers } from "@/lib/inbound/registry";
import { parseFallback } from "@/lib/inbound/parsers/fallback";
import { triage, triageHeuristics, SPAM_THRESHOLD } from "@/lib/inbound/triage";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { meterState } from "@/lib/billing/metering";
import { pushToBusiness } from "@/lib/push";

export type PipelineResult =
  | { outcome: "duplicate" }
  | { outcome: "no_tenant" }
  | { outcome: "reply_attached"; leadId: string }
  | { outcome: "ignored"; reason: string }
  | { outcome: "lead_created"; leadId: string; status: "NEW" | "SPAM" };

const SLUG_RE = /leads@([a-z0-9-]+)\.in\./i;

export function extractSlug(toAddress: string): string | null {
  const m = toAddress.match(SLUG_RE);
  return m ? m[1].toLowerCase() : null;
}

/** The whole inbound path: tenant → idempotency → reply-match → parse → triage → Lead. */
export async function processInbound(email: InboundEmail): Promise<PipelineResult> {
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
    return { outcome: "reply_attached", leadId: existing.id };
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
    const meter = await meterState(business.id, business.plan);
    if (meter.overCap) {
      void pushToBusiness(business.id, {
        title: "Lead cap reached",
        body: `${meter.used}/${meter.cap} leads this month — new inquiries are waiting. Upgrade to keep replies flowing.`,
        url: "/dashboard/settings",
      }).catch(() => null);
    } else {
      void generateDraftForLead(lead.id).catch((err) =>
        console.error(`draft generation failed for lead ${lead.id}`, err),
      );
    }
  }

  return { outcome: "lead_created", leadId: lead.id, status: isSpam ? "SPAM" : "NEW" };
}
