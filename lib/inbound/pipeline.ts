import { db } from "@/lib/db";
import type { InboundEmail, ParsedLead } from "@/lib/inbound/types";
import { sourceParsers } from "@/lib/inbound/registry";
import { parseFallback } from "@/lib/inbound/parsers/fallback";
import { triage, triageHeuristics, SPAM_THRESHOLD } from "@/lib/inbound/triage";

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
    verdict = triageHeuristics(email);
  } else if (!parsed) {
    const [p, v] = await Promise.all([parseFallback(email, business.id), triage(email, business.id)]);
    parsed = p;
    verdict = v;
  } else {
    verdict = await triage(email, business.id);
  }
  if (!parsed) return { outcome: "ignored", reason: "not an inquiry" };
  const isSpam = verdict.spamScore >= SPAM_THRESHOLD;

  const eventDate =
    parsed.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.eventDate)
      ? new Date(`${parsed.eventDate}T12:00:00Z`)
      : undefined;

  const lead = await db.lead.create({
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

  return { outcome: "lead_created", leadId: lead.id, status: isSpam ? "SPAM" : "NEW" };
}
