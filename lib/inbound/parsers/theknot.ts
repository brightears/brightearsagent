import { LeadSource } from "@/app/generated/prisma/enums";
import type { InboundEmail, ParsedLead, SourceParser } from "../types";

/**
 * Parser for The Knot (theknot.com) vendor lead-notification emails.
 *
 * Researched format (June 2026):
 * - Sender domains: member.theknot.com, partner.theknot.com, theknot.com
 *   (The Knot Pro support "Why Am I Not Receiving The Knot Emails?" tells vendors
 *   to whitelist exactly these; Releventful's lead-forwarding help doc lists the
 *   same three as the origin of lead inquiry emails).
 * - Subject: "New Lead" style notifications (Planning Pod help doc) and
 *   "<Name> sent you a message on The Knot" message notifications.
 * - Body: greeting, "<Name> is interested in ..." line, an "Event Details"
 *   section with labeled lines (wedding date, number of guests, location),
 *   the couple's message, and a "Contact Information" section with name,
 *   email and phone (phone confirmed by bookmorebrides.com; date + guest
 *   count confirmed by WeddingPro's own blog; first name + email always
 *   present per Releventful's importer requirements).
 *
 * Exact line labels are not published verbatim anywhere public, and Planning Pod
 * warns the format changes occasionally — so extraction accepts label aliases
 * and falls back to prose patterns ("X sent you a message", quoted message
 * blocks). Values are never invented; missing fields stay undefined.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const LEAD_MARKERS = [
  "new lead",
  "sent you a message",
  "is interested in",
  "quote request",
  "new message",
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function senderDomain(from: string): string | undefined {
  const angled = from.match(/<([^>]+)>/);
  const addr = (angled ? angled[1] : from).trim().toLowerCase();
  const at = addr.lastIndexOf("@");
  if (at === -1) return undefined;
  return addr.slice(at + 1);
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|h[1-6]|li|table|ul|ol)>/gi, "\n")
    .replace(/<\/(?:td|th)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** First "Label: value" line matching any alias (longest alias first). */
function labelValue(text: string, labels: string[]): string | undefined {
  const alts = labels
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const m = text.match(new RegExp(`^[ \\t]*(?:${alts})[ \\t]*:[ \\t]*(.+)$`, "im"));
  return m ? m[1].trim() : undefined;
}

/** Convert to ISO YYYY-MM-DD only when unambiguous. US emails: MM/DD/YYYY. */
function toIsoDate(raw: string): string | undefined {
  const s = raw.trim().replace(/^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+/i, "");
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (y: number, mo: number, d: number) =>
    mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : undefined;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return m[3].length === 3 ? undefined : iso(year, +m[1], +m[2]);
  }

  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mo ? iso(+m[3], mo, +m[2]) : undefined;
  }
  return undefined;
}

function unquote(s: string): string {
  const t = s.trim();
  const first = t[0];
  const last = t[t.length - 1];
  if ((first === '"' || first === "“") && (last === '"' || last === "”")) {
    return t.slice(1, -1).trim();
  }
  return t;
}

const PROSE_NAME = "([A-Z][A-Za-z'’.-]*(?:[ \\t]+[A-Z][A-Za-z'’.-]*){0,3})";

function extractName(text: string, subject: string): string | undefined {
  const labeled = labelValue(text, ["Full name", "Contact name", "Name"]);
  if (labeled) return labeled;

  const first = labelValue(text, ["First name"]);
  const last = labelValue(text, ["Last name"]);
  if (first) return last ? `${first} ${last}` : first;

  const prose =
    text.match(new RegExp(`${PROSE_NAME}[ \\t]+sent you a message`)) ??
    text.match(new RegExp(`${PROSE_NAME}[ \\t]+is interested in`));
  if (prose) return prose[1].trim();

  const subj = subject.match(/^(.+?)\s+sent you a message/i);
  return subj ? subj[1].trim() : undefined;
}

function extractEmail(text: string): string | undefined {
  const labeled = labelValue(text, ["Email address", "E-mail", "Email"]);
  if (labeled) {
    const m = labeled.match(EMAIL_RE);
    if (m) return m[0];
  }
  // Fallback: first address in the body that is not The Knot's own or ours.
  for (const m of text.matchAll(new RegExp(EMAIL_RE, "g"))) {
    const domain = m[0].toLowerCase().split("@")[1];
    if (domain === "theknot.com" || domain.endsWith(".theknot.com")) continue;
    if (domain === "brightears.io" || domain.endsWith(".brightears.io")) continue;
    return m[0];
  }
  return undefined;
}

function extractNotes(text: string): string | undefined {
  const block = text.match(
    /(?:^|\n)[ \t]*Message[ \t]*:[ \t]*\n?([\s\S]*?)(?=\n[ \t]*(?:Contact Information|Event Details|Name[ \t]*:|Email[ \t]*:|Phone[ \t]*:|Reply now|View lead|Log in)|$)/i,
  );
  if (block && block[1].trim()) return unquote(block[1]);

  const quoted = text.match(/(?:^|\n)[ \t]*["“]([^\n][\s\S]{9,}?)["”][ \t]*(?=\n|$)/);
  return quoted ? quoted[1].trim() : undefined;
}

export const theKnotParser: SourceParser = {
  source: LeadSource.THE_KNOT,

  match(email: InboundEmail): boolean {
    const domain = senderDomain(email.from);
    if (!domain || (domain !== "theknot.com" && !domain.endsWith(".theknot.com"))) {
      return false;
    }
    const hay = `${email.subject}\n${email.textBody ?? ""}\n${email.htmlBody ?? ""}`
      .slice(0, 6000)
      .toLowerCase();
    return LEAD_MARKERS.some((marker) => hay.includes(marker));
  },

  parse(email: InboundEmail): ParsedLead | null {
    if (!theKnotParser.match(email)) return null;

    const text = email.textBody?.trim()
      ? email.textBody.replace(/\r\n/g, "\n")
      : email.htmlBody
        ? stripHtml(email.htmlBody)
        : "";
    if (!text.trim()) return null;

    const clientName = extractName(text, email.subject);
    const clientEmail = extractEmail(text);

    const phoneRaw = labelValue(text, ["Phone number", "Telephone", "Phone", "Tel"]);
    const clientPhone =
      phoneRaw && (phoneRaw.match(/\d/g) ?? []).length >= 7 ? phoneRaw : undefined;

    const dateRaw = labelValue(text, ["Wedding date", "Event date", "Date of event", "Date"]);
    const eventDate = dateRaw ? toIsoDate(dateRaw) : undefined;

    const guestsRaw = labelValue(text, [
      "Number of guests",
      "Estimated guest count",
      "Estimated guests",
      "Guest count",
      "Guests",
    ]);
    const guestsNum = guestsRaw?.replace(/,/g, "").match(/\d{1,5}/);
    const guestCount = guestsNum ? parseInt(guestsNum[0], 10) : undefined;

    const venue = labelValue(text, ["Event location", "Wedding location", "Location", "Venue"]);
    const notes = extractNotes(text);
    const eventType = /\bwedding\b/i.test(`${email.subject}\n${text}`) ? "wedding" : undefined;

    // A real The Knot lead always identifies the couple (name + email per
    // Releventful's importer contract). Without that, let the LLM fallback try.
    if (!clientName && !clientEmail) return null;
    if (!clientEmail && !eventDate && !notes && !guestCount && !clientPhone) return null;

    let score = 0.5;
    if (clientEmail) score += 0.15;
    if (clientName) score += 0.1;
    if (eventDate) score += 0.1;
    if (clientPhone) score += 0.05;
    if (guestCount !== undefined) score += 0.05;
    if (venue) score += 0.05;
    const confidence = Math.round(Math.min(score, 0.97) * 100) / 100;

    return {
      source: LeadSource.THE_KNOT,
      clientName,
      clientEmail,
      clientPhone,
      eventType,
      eventDate,
      venue,
      guestCount,
      notes,
      confidence,
    };
  },
};

export default theKnotParser;
