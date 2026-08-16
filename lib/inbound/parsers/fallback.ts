import { z } from "zod";
import { llmObject } from "@/lib/llm";
import type { InboundEmail, ParsedLead } from "@/lib/inbound/types";
import { classifyEventType } from "@/lib/inbound/parsers/event-type";
import { extractEventDate } from "@/lib/inbound/parsers/event-date";
import { extractGuestCount } from "@/lib/inbound/parsers/guest-count";

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
const SYSTEM_SENDER_RE =
  /no-?reply|donotreply|notification|mailer|form(submit|spree|s@)|jotform|typeform|wordpress|wix|squarespace/i;

const DIRECT_BOOKING_REQUESTS: RegExp[] = [
  /\b(?:are you|if you are|whether you are|you are)\s+(?:available|free)\b/i,
  /\bcheck(?:ing)?\s+(?:your\s+)?availability\b/i,
  /\b(?:looking for|need|seeking)\s+(?:an?\s+)?(?:wedding\s+|event\s+|party\s+)?(?:dj|band|singer|performer|musician|entertainment)\b/i,
  /\b(?:book|hire)\s+(?:you|your\s+(?:act|band)|an?\s+(?:dj|band|singer|performer|musician))\b/i,
  /\b(?:send|share)\s+(?:me|us)\s+(?:your\s+)?(?:rates|prices|packages|quote)\b/i,
  /\b(?:how much|what (?:would|does|will) (?:it|that) cost|what(?:'s| is) your (?:fee|rate))\b/i,
  /\bdo you\s+(?:do|play|perform at|take bookings? for)\b/i,
];
const BOOKING_CONTEXT =
  /\b(?:dj|band|singer|performer|musician|entertainment|wedding|married|party|event|reception|ceremony|gig|venue|guests?|pax)\b/i;
const OBVIOUS_NON_INQUIRY =
  /\b(?:weekly (?:music |industry )?digest|newsletter|view in browser|email preferences|partnership opportunity)\b|\b(?:seo|web design|lead generation) (?:services?|platform|proposal|audit)\b|\b(?:show you|schedule|book) (?:a |the )?demo\b/i;
const PLACEHOLDER_VENUE =
  /\b(?:tbd|tbc|unknown|undecided|to be (?:determined|decided|confirmed)|not (?:yet )?(?:decided|confirmed|booked|set)|still (?:looking|deciding))\b/i;

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

function cleanVenue(value: string | null | undefined): string | undefined {
  const venue = clean(value);
  if (!venue || PLACEHOLDER_VENUE.test(venue)) return undefined;
  // Descriptions are useful in notes, but they are not venue names. Treating
  // "somewhere in Bangkok" as a venue is the same kind of invention as TBD.
  if (/^(?:a|an|some|somewhere|unnamed)\b/i.test(venue)) return undefined;
  return venue;
}

/**
 * Read only an explicitly named venue with a recognisable venue-type suffix.
 * The proper-name requirement deliberately excludes vague phrases such as
 * "at a hotel ballroom" while retaining copy like "at The Siam Hotel".
 */
function extractNamedVenue(text: string): string | undefined {
  const match = text.match(
    /\b(?:at|venue(?:\s+is)?|location(?:\s+is)?)\s+((?:The\s+)?[A-Z][\p{L}\p{M}'’&.-]*(?:\s+(?:[A-Z][\p{L}\p{M}'’&.-]*|&)){0,5}\s+(?:Hotel|Resort|Club|Hall|Ballroom|Barn|Centre|Center|House|Rooftop|Bar|Restaurant|Theatre|Theater|Gallery|Studio))\b/u,
  );
  return cleanVenue(match?.[1]);
}

const NON_NAME_WORDS = new Set([
  "hello",
  "hi",
  "there",
  "team",
  "thanks",
  "thank",
  "regards",
  "sincerely",
  "cheers",
  "customer",
  "client",
  "unknown",
]);

/** A cautious explicit/signature name reader; it never infers from an address. */
function cleanName(value: string | null | undefined): string | undefined {
  const name = clean(value, 120)?.replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/g, "");
  if (!name || /[@<>/\\\d]/u.test(name)) return undefined;
  const words = name.split(/\s+/);
  if (words.length < 1 || words.length > 4) return undefined;
  if (!words.every((word) => /^[\p{L}\p{M}][\p{L}\p{M}'’.\-]*$/u.test(word))) {
    return undefined;
  }
  if (words.every((word) => NON_NAME_WORDS.has(word.toLowerCase().replace(/[.'’-]/g, "")))) {
    return undefined;
  }
  return name;
}

function extractClientName(body: string): string | undefined {
  const patterns: RegExp[] = [
    /\bmy name is\s+([^\n,;.!?]{2,120})/iu,
    /(?:^|[.!?]\s+)\s*(?:full\s+)?name\s*[:\-]\s*([^\n;.!?]{2,120})/imu,
    /\b(?:best|kind|warm)\s+regards\s*[,!:—–-]?\s*([^\n;.!?]{2,120})(?:[.!?]|$)/iu,
    /\b(?:thanks(?:\s+so\s+much)?|thank you)\s*[,!]\s*([^\n;.!?]{2,120})(?:[.!?]|$)/iu,
    /[—–]\s*([^\n;.!?]{2,120})\s*$/u,
  ];
  for (const pattern of patterns) {
    const candidate = cleanName(body.match(pattern)?.[1]);
    if (candidate) return candidate;
  }
  return undefined;
}

function hasHighConfidenceInquiry(opts: {
  email: InboundEmail;
  senderIsSystem: boolean;
  labeled: {
    name?: string;
    email?: string;
    eventType?: string;
    eventDate?: string;
    message?: string;
  };
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
}): boolean {
  const text = `${opts.email.subject}\n${opts.email.textBody}`;
  if (OBVIOUS_NON_INQUIRY.test(text)) return false;

  const structuredBookingForm =
    opts.senderIsSystem &&
    !!opts.labeled.message &&
    !!(opts.labeled.name || opts.labeled.email) &&
    !!(opts.labeled.eventType || opts.labeled.eventDate);
  if (structuredBookingForm) return true;

  const directRequest = DIRECT_BOOKING_REQUESTS.some((pattern) => pattern.test(text));
  const concreteContext =
    !!opts.eventType ||
    !!opts.eventDate ||
    opts.guestCount !== undefined ||
    BOOKING_CONTEXT.test(text);
  return directRequest && concreteContext;
}

/**
 * LLM fallback for plain emails and website contact forms — anything no
 * deterministic source parser claimed. Extraction only; never invents values.
 */
export async function parseFallback(
  email: InboundEmail,
  businessId: string | null,
): Promise<ParsedLead | null> {
  const body = email.textBody;
  const text = `${email.subject}\n${body}`;
  const senderIsSystem = SYSTEM_SENDER_RE.test(email.from);
  // Labels are explicit facts regardless of which mail transport delivered
  // them. They are still sanity-checked below before entering a lead.
  const labeled = {
    name: labeledField(body, /^\s*(?:full\s+)?name\s*[:\-]\s*(.+)$/i),
    email: labeledField(body, /^\s*e-?mail(?:\s+address)?\s*[:\-]\s*(.+)$/i),
    phone: labeledField(body, /^\s*(?:phone|tel(?:ephone)?|mobile)(?:\s+number)?\s*[:\-]\s*(.+)$/i),
    eventType: labeledField(body, /^\s*event\s*type\s*[:\-]\s*(.+)$/i),
    eventDate: labeledField(body, /^\s*(?:event\s*)?date\s*[:\-]\s*(.+)$/i),
    venue: labeledField(body, /^\s*(?:venue|location)\s*[:\-]\s*(.+)$/i),
    message: labeledField(body, /^\s*(?:message|enquiry|inquiry)\s*[:\-]\s*(.+)$/i),
  };
  const deterministicEventType =
    clean(labeled.eventType, 80)?.toLowerCase() ?? classifyEventType(text);
  const deterministicEventDate = extractEventDate(text);
  const deterministicGuestCount = extractGuestCount(text);
  const deterministicVenue = extractNamedVenue(text);
  const highConfidenceInquiry = hasHighConfidenceInquiry({
    email,
    senderIsSystem,
    labeled,
    eventType: deterministicEventType,
    eventDate: deterministicEventDate,
    guestCount: deterministicGuestCount,
  });

  const today = new Date().toISOString().slice(0, 10);
  let extracted: z.infer<typeof ExtractionSchema>;
  try {
    extracted = await llmObject({
      purpose: "parse",
      businessId,
      system:
        "You extract booking-inquiry details from emails received by an entertainment business (DJ, band, etc.). " +
        "Extract ONLY what is explicitly present — never guess or invent. " +
        "Contact-form notifications put the REAL client's details in labeled body fields (Name:, Email:, Phone:) — " +
        "always extract those; the header sender is often just the form system. Copy labeled numbers exactly. " +
        "TBD, TBC, unknown, undecided, and generic descriptions such as 'somewhere in Bangkok' are NOT venues; return venue=null. " +
        `Today is ${today}. Dates must be returned as ISO YYYY-MM-DD; resolve relative dates ("next June", "this Saturday") against today. ` +
        "Event dates are in the FUTURE — if a resolved date lands in the past, you picked the wrong year. " +
        "If the format is ambiguous, assume US MM/DD/YYYY. " +
        "If the email is not a genuine inquiry from a potential client (newsletter, receipt, vendor pitch, automated notice), set isInquiry=false.",
      prompt: `From: ${email.fromName ?? ""} <${email.from}>\nSubject: ${email.subject}\n\n${body.slice(0, 6000)}`,
      schema: ExtractionSchema,
    });
  } catch (error) {
    // A provider timeout must not erase an unmistakable booking request whose
    // useful facts are already readable without AI. Ambiguous mail and obvious
    // junk still throw so the webhook fails closed and Postmark retries it.
    if (!highConfidenceInquiry) throw error;
    extracted = {
      isInquiry: true,
      clientName: null,
      clientEmail: null,
      clientPhone: null,
      eventType: null,
      eventDate: null,
      venue: null,
      guestCount: null,
      budgetHint: null,
      notes: null,
    };
  }

  // The model is supporting evidence, not permission to discard a direct
  // booking request or a structured booking form.
  if (!extracted.isInquiry && !highConfidenceInquiry) return null;

  // First candidate that is actually an email address wins — a garbage
  // extraction must not shadow a perfectly good human sender.
  const clientEmail = [
    labeled.email,
    clean(extracted.clientEmail),
    senderIsSystem ? undefined : email.from,
  ].find((e) => e && EMAIL_RE.test(e));
  // An explicit written date wins. The model remains the fallback for relative
  // phrasing ("next June") that the deterministic reader intentionally avoids.
  const eventDate =
    deterministicEventDate ??
    [clean(extracted.eventDate)].find((d) => d && ISO_DATE_RE.test(d));
  const deterministicName = extractClientName(body);

  return {
    // A form-system sender IS the website form (10.11) — before this, every
    // fallback lead was PLAIN_EMAIL, so the auto-send card's "Your website
    // form" checkbox could never match a real lead.
    source: senderIsSystem ? "WEBSITE_FORM" : "PLAIN_EMAIL",
    clientName:
      cleanName(labeled.name) ??
      (senderIsSystem ? undefined : cleanName(email.fromName)) ??
      (senderIsSystem ? undefined : deterministicName) ??
      cleanName(extracted.clientName),
    clientEmail,
    clientPhone: labeled.phone ?? clean(extracted.clientPhone, 40),
    // Explicit labels/wording outrank the model; categories are deterministic
    // classifications, not invented facts.
    eventType:
      deterministicEventType ?? clean(extracted.eventType, 80)?.toLowerCase(),
    eventDate,
    venue: cleanVenue(labeled.venue) ?? deterministicVenue ?? cleanVenue(extracted.venue),
    guestCount: deterministicGuestCount ?? extracted.guestCount ?? undefined,
    budgetHint: clean(extracted.budgetHint),
    notes: clean(extracted.notes, 300),
    confidence: 0.6,
  };
}
