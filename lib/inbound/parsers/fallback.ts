import { z } from "zod";
import { llmObject } from "@/lib/llm";
import type { InboundEmail, ParsedLead } from "@/lib/inbound/types";

// .nullish(): cheap models return null for empty fields instead of omitting them.
const ExtractionSchema = z.object({
  isInquiry: z
    .boolean()
    .describe("true only if this is a genuine event/booking inquiry from a potential client"),
  clientName: z.string().nullish(),
  clientEmail: z.string().nullish(),
  clientPhone: z.string().nullish(),
  eventType: z.string().nullish().describe("lowercase, e.g. wedding, corporate, birthday"),
  eventDate: z.string().nullish().describe("ISO YYYY-MM-DD, only if clearly determinable"),
  venue: z.string().nullish(),
  guestCount: z.number().nullish(),
  budgetHint: z.string().nullish(),
  notes: z.string().nullish().describe("one-line gist of what they're asking for"),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Single-line sanity for LLM-extracted strings. Cheap models sometimes leak
 * their reasoning INTO a JSON string value (seen on staging 2026-07-10: a
 * "venue" holding a 900-char monologue plus a fenced JSON block) — a newline,
 * backtick, brace, or absurd length is that leak's signature, and such a
 * value must never reach the pipeline as a lead field.
 */
function clean(value: string | null | undefined, cap = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v || v.length > cap || /[\n\r`{}]/.test(v)) return undefined;
  return v;
}

/** First `Label: value` line in the body — form notifications are line-oriented. */
function labeledField(body: string, label: RegExp): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(label);
    if (m?.[1].trim()) return m[1].trim().slice(0, 200);
  }
  return undefined;
}

/**
 * LLM fallback for plain emails and website contact forms — anything no
 * deterministic source parser claimed. Extraction only; never invents values.
 */
export async function parseFallback(
  email: InboundEmail,
  businessId: string | null,
): Promise<ParsedLead | null> {
  const today = new Date().toISOString().slice(0, 10);
  const extracted = await llmObject({
    purpose: "parse",
    businessId,
    system:
      "You extract booking-inquiry details from emails received by an entertainment business (DJ, band, etc.). " +
      "Extract ONLY what is explicitly present — never guess or invent. " +
      "Contact-form notifications put the REAL client's details in labeled body fields (Name:, Email:, Phone:) — " +
      "always extract those; the header sender is often just the form system. " +
      `Today is ${today}. Dates must be returned as ISO YYYY-MM-DD; resolve relative dates ("next June", "this Saturday") against today. ` +
      "Event dates are in the FUTURE — if a resolved date lands in the past, you picked the wrong year. " +
      "If the format is ambiguous, assume US MM/DD/YYYY. " +
      "If the email is not a genuine inquiry from a potential client (newsletter, receipt, vendor pitch, automated notice), set isInquiry=false.",
    prompt: `From: ${email.fromName ?? ""} <${email.from}>\nSubject: ${email.subject}\n\n${email.textBody.slice(0, 6000)}`,
    schema: ExtractionSchema,
  });

  if (!extracted.isInquiry) return null;

  // Never default to a form-system/no-reply sender as the client's address.
  const senderIsSystem =
    /no-?reply|donotreply|notification|mailer|form(submit|spree|s@)|jotform|typeform|wordpress|wix|squarespace/i.test(
      email.from,
    );

  // Form notifications carry the client's details as labeled lines — read
  // those deterministically and let them WIN over the model (staging catch:
  // the model returned clientName=null on a body that literally said
  // "Name: Jessica Park", and the lead landed as "Unknown").
  const body = email.textBody;
  const labeled = senderIsSystem
    ? {
        name: labeledField(body, /^\s*(?:full\s+)?name\s*[:\-]\s*(.+)$/i),
        email: labeledField(body, /^\s*e-?mail(?:\s+address)?\s*[:\-]\s*(.+)$/i),
        phone: labeledField(body, /^\s*(?:phone|tel(?:ephone)?|mobile)(?:\s+number)?\s*[:\-]\s*(.+)$/i),
        eventType: labeledField(body, /^\s*event\s*type\s*[:\-]\s*(.+)$/i),
        eventDate: labeledField(body, /^\s*(?:event\s*)?date\s*[:\-]\s*(.+)$/i),
      }
    : {};

  // First candidate that is actually an email address wins — a garbage
  // extraction must not shadow a perfectly good human sender.
  const clientEmail = [
    labeled.email,
    clean(extracted.clientEmail),
    senderIsSystem ? undefined : email.from,
  ].find((e) => e && EMAIL_RE.test(e));
  const eventDate = [labeled.eventDate, clean(extracted.eventDate)].find(
    (d) => d && ISO_DATE_RE.test(d),
  );

  return {
    // A form-system sender IS the website form (10.11) — before this, every
    // fallback lead was PLAIN_EMAIL, so the auto-send card's "Your website
    // form" checkbox could never match a real lead.
    source: senderIsSystem ? "WEBSITE_FORM" : "PLAIN_EMAIL",
    clientName:
      labeled.name ?? clean(extracted.clientName, 120) ?? (senderIsSystem ? undefined : email.fromName),
    clientEmail,
    clientPhone: labeled.phone ?? clean(extracted.clientPhone, 40),
    eventType: labeled.eventType ?? clean(extracted.eventType, 80),
    eventDate,
    venue: clean(extracted.venue),
    guestCount: extracted.guestCount ?? undefined,
    budgetHint: clean(extracted.budgetHint),
    notes: clean(extracted.notes, 300),
    confidence: 0.6,
  };
}
