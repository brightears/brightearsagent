import { LeadSource } from "@/app/generated/prisma/enums";
import type { InboundEmail, ParsedLead, SourceParser } from "@/lib/inbound/types";

/**
 * Bark.com lead-notification parser.
 *
 * Format research (2024-2026):
 * - Sender: lead alerts come from team@bark.com — Bark's help article
 *   "Add Bark to your email contact list" tells sellers to safelist exactly
 *   that address / the bark.com domain so lead emails reach the inbox.
 * - Subjects: "{FirstName} is looking for a {service} ..." or generic
 *   "New customer looking for your services" (first-hand seller reports).
 * - Pre-purchase alert body mirrors the on-platform lead card: customer
 *   first name + last initial, town/region, category, the request-form Q&A
 *   ("What type of event is it?", "When is the event?", "Approximately how
 *   many guests will attend?", "What is your budget?", ...), the upfront
 *   credit cost ("Respond to X for N credits") and a bark.com/sellers link.
 *   Client phone/email are deliberately withheld until credits are spent.
 * - Post-purchase ("New Purchased Bark" in Zapier's Bark integration) email
 *   reveals labeled Name / Phone / Email lines plus the lead Q&A recap.
 *
 * team@bark.com also sends marketing/promo mail, so parse() returns null
 * unless a customer name or contact block is actually present, letting the
 * pipeline fall through to the LLM parser.
 */

const BARK_SENDER = /@(?:[a-z0-9-]+\.)*bark\.com$/i;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/** Standalone "Maya R." / "Jordan P." line (Bark shows first name + last initial pre-purchase). */
const NAME_LINE = /^[A-Z][A-Za-z'’-]+(?: [A-Z][A-Za-z'’-]+)* [A-Z]\.$/;

/** Lines that are never Q&A answers (CTAs, footer). */
const ANSWER_STOP = /^(?:respond to\b|view this lead\b|view lead\b|give\b|log in\b|--)/i;

const Q_EVENT_TYPE = /what (?:type|kind) of event/i;
const Q_DATE =
  /when is the (?:event|party|wedding|service)|what(?:'s| is) the date|event date|when do you need/i;
const Q_GUESTS = /how many (?:guests|people|attendees)|number of guests/i;
const Q_BUDGET = /budget/i;
const Q_VENUE = /type of venue|which venue|where (?:is|will) the event/i;

interface QaPair {
  question: string;
  answer: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6]|table|ul|ol)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#8217;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * "11/14/2026" (US MM/DD/YYYY), "Saturday, 14 November 2026",
 * "November 14, 2026" -> ISO YYYY-MM-DD. Vague answers ("I'm not sure yet",
 * "ASAP") -> undefined; never guess.
 */
function toIsoDate(raw: string): string | undefined {
  const s = raw.trim();

  // US numeric: MM/DD/YYYY
  let m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return isoDate(Number(m[3]), Number(m[1]), Number(m[2]));

  // "14 November 2026" (optional weekday prefix / ordinal suffix)
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return isoDate(Number(m[3]), month, Number(m[1]));
  }

  // "November 14, 2026"
  m = s.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return isoDate(Number(m[3]), month, Number(m[2]));
  }

  return undefined;
}

/** Bark guest answers are ranges ("100 - 149") or single numbers; ranges yield the lower bound (minimum). */
function toGuestCount(raw: string): number | undefined {
  const s = raw.replace(/,/g, "").trim();
  const range = s.match(/\b(\d+)\s*(?:-|–|to)\s*\d+\b/);
  if (range) return Number(range[1]);
  const single = s.match(/\b(\d+)\b/);
  if (single) return Number(single[1]);
  return undefined;
}

function normalizeEventType(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v.includes("wedding")) return "wedding";
  if (/corporate|business|company|office/.test(v)) return "corporate";
  if (v.includes("birthday")) return "birthday";
  if (v.includes("anniversary")) return "anniversary";
  return v;
}

/** Question line ending in "?" followed by its answer on the next non-empty line. */
function extractQa(lines: string[]): QaPair[] {
  const pairs: QaPair[] = [];
  for (let i = 0; i < lines.length; i++) {
    const question = (lines[i] ?? "").trim();
    if (!question.endsWith("?") || question.length > 120) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const next = (lines[j] ?? "").trim();
      if (!next) continue;
      if (!next.endsWith("?") && !ANSWER_STOP.test(next)) {
        pairs.push({ question, answer: next });
      }
      break;
    }
  }
  return pairs;
}

function matchBark(email: InboundEmail): boolean {
  return BARK_SENDER.test(email.from.trim());
}

function parseBark(email: InboundEmail): ParsedLead | null {
  if (!matchBark(email)) return null;

  const text =
    email.textBody && email.textBody.trim().length > 0
      ? email.textBody
      : email.htmlBody
        ? htmlToText(email.htmlBody)
        : "";
  if (!text.trim()) return null;

  const lines = text.split(/\r?\n/).map((line) => line.trim());

  // Post-purchase contact block (only present once credits were spent).
  const nameLabel = text.match(/^name:\s*(.+)$/im)?.[1]?.trim();
  const phoneLabel = text
    .match(/^(?:phone|phone number|tel|telephone):\s*(.+)$/im)?.[1]
    ?.trim();
  const clientPhone =
    phoneLabel && phoneLabel.replace(/\D/g, "").length >= 7 ? phoneLabel : undefined;
  const clientEmail = text
    .match(/^(?:email|e-mail|email address):\s*(\S+@\S+\.[A-Za-z]{2,})$/im)?.[1]
    ?.trim();

  // Pre-purchase: standalone "Maya R." line, with the town/region on the next line.
  let nameFromBody: string | undefined;
  let location: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!NAME_LINE.test(line)) continue;
    nameFromBody = line;
    for (let j = i + 1; j < lines.length; j++) {
      const next = (lines[j] ?? "").trim();
      if (!next) continue;
      if (!next.endsWith("?") && next.includes(",")) location = next;
      break;
    }
    break;
  }

  // Subject: "Maya is looking for a Wedding DJ near Austin, TX"
  const subjectName = email.subject
    .match(/^(?:(?:fwd|fw|re):\s*)*(.+?) is looking for/i)?.[1]
    ?.trim();

  const clientName = nameLabel ?? nameFromBody ?? subjectName;

  // A real Bark lead always names the customer; promo mail from team@bark.com does not.
  if (!clientName && !clientEmail && !clientPhone) return null;

  let eventType: string | undefined;
  let eventDate: string | undefined;
  let guestCount: number | undefined;
  let budgetHint: string | undefined;
  let venue: string | undefined;
  const leftovers: QaPair[] = [];

  for (const pair of extractQa(lines)) {
    if (!eventType && Q_EVENT_TYPE.test(pair.question)) {
      eventType = normalizeEventType(pair.answer);
    } else if (!eventDate && Q_DATE.test(pair.question)) {
      eventDate = toIsoDate(pair.answer);
      // Vague date ("I'm not sure yet"): never invent — keep the raw answer in notes.
      if (!eventDate) leftovers.push(pair);
    } else if (!guestCount && Q_GUESTS.test(pair.question)) {
      guestCount = toGuestCount(pair.answer);
    } else if (!budgetHint && Q_BUDGET.test(pair.question)) {
      budgetHint = pair.answer;
    } else if (!venue && Q_VENUE.test(pair.question)) {
      venue = pair.answer;
    } else {
      leftovers.push(pair);
    }
  }

  const credits = text.match(/\bfor\s+(\d+)\s+credits?\b/i)?.[1];

  const noteParts: string[] = [];
  if (location) noteParts.push(`Location: ${location}`);
  for (const pair of leftovers) noteParts.push(`${pair.question} ${pair.answer}`);
  if (credits) noteParts.push(`Lead price: ${credits} credits`);
  const notes = noteParts.length > 0 ? noteParts.join("\n") : undefined;

  let confidence: number;
  if (clientEmail || clientPhone) {
    confidence = 0.95; // unlocked lead with real contact details
  } else if (clientName && eventType && eventDate) {
    confidence = 0.92; // clean pre-purchase alert
  } else {
    confidence = 0.75; // matched but sparse/partial
  }

  return {
    source: LeadSource.BARK,
    clientName,
    clientEmail,
    clientPhone,
    eventType,
    eventDate,
    venue,
    guestCount,
    budgetHint,
    notes,
    confidence,
  };
}

export const barkParser: SourceParser = {
  source: LeadSource.BARK,
  match: matchBark,
  parse: parseBark,
};
