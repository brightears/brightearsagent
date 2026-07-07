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

/**
 * LLM fallback for plain emails and website contact forms — anything no
 * deterministic source parser claimed. Extraction only; never invents values.
 */
export async function parseFallback(
  email: InboundEmail,
  businessId: string | null,
): Promise<ParsedLead | null> {
  const extracted = await llmObject({
    purpose: "parse",
    businessId,
    system:
      "You extract booking-inquiry details from emails received by an entertainment business (DJ, band, etc.). " +
      "Extract ONLY what is explicitly present — never guess or invent. " +
      "Contact-form notifications put the REAL client's details in labeled body fields (Name:, Email:, Phone:) — " +
      "always extract those; the header sender is often just the form system. " +
      "Dates must be returned as ISO YYYY-MM-DD; if the format is ambiguous, assume US MM/DD/YYYY. " +
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

  return {
    // A form-system sender IS the website form (10.11) — before this, every
    // fallback lead was PLAIN_EMAIL, so the auto-send card's "Your website
    // form" checkbox could never match a real lead.
    source: senderIsSystem ? "WEBSITE_FORM" : "PLAIN_EMAIL",
    clientName: extracted.clientName ?? (senderIsSystem ? undefined : email.fromName),
    clientEmail: extracted.clientEmail ?? (senderIsSystem ? undefined : email.from),
    clientPhone: extracted.clientPhone ?? undefined,
    eventType: extracted.eventType ?? undefined,
    eventDate: extracted.eventDate ?? undefined,
    venue: extracted.venue ?? undefined,
    guestCount: extracted.guestCount ?? undefined,
    budgetHint: extracted.budgetHint ?? undefined,
    notes: extracted.notes ?? undefined,
    confidence: 0.6,
  };
}
