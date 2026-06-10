import { LeadSource } from "@/app/generated/prisma/enums";
import type { InboundEmail, ParsedLead, SourceParser } from "@/lib/inbound/types";

/**
 * WeddingWire (The Knot Worldwide / WeddingPro) lead-notification parser.
 *
 * Format research (2024-2026), all via WeddingWire's own Vendor Support
 * Zendesk Help Center API (vendorsupport.weddingwire.com/api/v2/help_center):
 * - Subject lines (OFFICIAL examples, article 115003720143): new lead =
 *   "New lead from John Doe"; follow-up = "New message from John Doe".
 * - Senders to whitelist (article 115003741366): pros@weddingwire.com,
 *   promotions@weddingwire.com, email@emailsweddingwire.com — so we match
 *   the weddingwire.com and emailsweddingwire.com domains.
 * - Unlike GigSalad, WeddingWire EXPOSES the couple's contact details:
 *   vendors can "Respond directly to the client by clicking the reply
 *   button" and the response "will always be sent to the client's email
 *   address" (article 115003720143) — so the client address shows up in
 *   the body and/or Reply-To. Inquiry details "may include their name, the
 *   event date set in their account, phone number, and email address"
 *   (article 360027979832); couples also provide wedding date + guest
 *   count (WeddingPro docs).
 * - Every lead email ends with a blue "within your account" link
 *   (article 115003720143).
 * - Exact body label wording is NOT published verbatim; we parse the
 *   storefront-contact-form field set with tolerant label variants.
 */

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "Saturday, October 17, 2026" | "October 17, 2026" | "10/17/2026" (US) -> "2026-10-17". */
function toIsoDate(raw: string): string | undefined {
  const s = raw.trim();

  const written = s.match(
    /(?:[A-Za-z]+,\s*)?([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/,
  );
  if (written) {
    const month = MONTHS[written[1].toLowerCase()];
    const day = parseInt(written[2], 10);
    const year = parseInt(written[3], 10);
    if (month && day >= 1 && day <= 31) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // US numeric: WeddingWire is US-centric; assume MM/DD/YYYY.
  const numeric = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numeric) {
    const month = parseInt(numeric[1], 10);
    const day = parseInt(numeric[2], 10);
    const year = parseInt(numeric[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  return undefined;
}

/** Minimal HTML-to-text: drop script/style, break on block tags, strip the rest. */
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, "\n")
    .replace(/<td[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

/** First value found for any of the given line labels ("Label: value"). */
function labeled(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, "im");
    const m = body.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

/** Address from a header value like `Jane <jane@x.com>` or bare `jane@x.com`. */
function extractAddress(headerValue: string): string | undefined {
  const m = headerValue.match(EMAIL_RE);
  return m?.[0];
}

// pros@weddingwire.com / *@email.weddingwire.com / email@emailsweddingwire.com
const SENDER_RE = /@(?:[a-z0-9-]+\.)*(?:weddingwire|emailsweddingwire)\.com$/i;

// Official subject examples, with tolerance for Re:/Fwd: threading prefixes.
const SUBJECT_RE = /^\s*(?:(?:re|fwd?)\s*:\s*)*new (lead|message) from\s+(.+?)\s*$/i;

const BODY_LEAD_RE = /\byou have a new (lead|message)\b|\bwithin your account\b/i;

// Footer/boilerplate lines that end the free-text "Message:" block.
const FOOTER_RE =
  /^\s*(reply directly to this email|reply within your account|the weddingwire team|view this lead|log ?in to your account|unsubscribe|©)/im;

export const weddingwireParser: SourceParser = {
  source: LeadSource.WEDDINGWIRE,

  match(email: InboundEmail): boolean {
    const fromAddress = email.from.trim().toLowerCase();
    if (!SENDER_RE.test(fromAddress)) return false;
    return SUBJECT_RE.test(email.subject) || BODY_LEAD_RE.test(email.textBody);
  },

  parse(email: InboundEmail): ParsedLead | null {
    if (!this.match(email)) return null;

    const body =
      email.textBody.trim().length > 0
        ? email.textBody
        : email.htmlBody
          ? stripHtml(email.htmlBody)
          : "";
    if (!body) return null;

    const lead: ParsedLead = { source: LeadSource.WEDDINGWIRE, confidence: 0.9 };

    // Client name: official subject shape first, "Name:" label as fallback.
    const subjectMatch = email.subject.match(SUBJECT_RE);
    const name = subjectMatch?.[2] ?? labeled(body, ["Name", "Full Name"]);
    if (name) lead.clientName = name.trim();

    // Client email: labeled body line, else the Reply-To relay (WeddingWire
    // routes direct replies to the couple's address — article 115003720143).
    const emailRaw = labeled(body, ["Email", "Email Address", "E-mail"]);
    const emailFromBody = emailRaw ? emailRaw.match(EMAIL_RE)?.[0] : undefined;
    let clientEmail = emailFromBody;
    if (!clientEmail && email.headers) {
      for (const [key, value] of Object.entries(email.headers)) {
        if (key.toLowerCase() !== "reply-to") continue;
        const addr = extractAddress(value);
        if (addr && !SENDER_RE.test(addr)) clientEmail = addr;
      }
    }
    if (clientEmail) lead.clientEmail = clientEmail;

    const phone = labeled(body, ["Phone", "Phone Number", "Tel"]);
    if (phone && /\d{3}/.test(phone)) lead.clientPhone = phone;

    // Event date: only when unambiguous — "Flexible" etc. stays unset.
    const dateRaw = labeled(body, [
      "Wedding Date",
      "Event Date",
      "Date of Event",
      "Date",
    ]);
    if (dateRaw) {
      const iso = toIsoDate(dateRaw);
      if (iso) lead.eventDate = iso;
    }

    // Guest count: exact integers only. Range buckets ("100-150") are kept
    // verbatim in notes instead of being collapsed into an invented number.
    const guestsRaw = labeled(body, [
      "Number of Guests",
      "Guest Count",
      "Estimated Guest Count",
      "Guests",
    ]);
    let guestRange: string | undefined;
    if (guestsRaw) {
      const exact = guestsRaw.match(/^\s*([\d,]+)\s*$/);
      if (exact) {
        const n = parseInt(exact[1].replace(/,/g, ""), 10);
        if (Number.isFinite(n) && n > 0) lead.guestCount = n;
      } else if (/\d/.test(guestsRaw)) {
        guestRange = guestsRaw;
      }
    }

    const budget = labeled(body, ["Budget", "Estimated Budget", "Budget Range"]);
    if (budget) lead.budgetHint = budget;

    // WeddingWire is a wedding marketplace; only set the type when the email
    // itself says so (it always does via the Wedding Date label / message).
    if (/\bwedding\b/i.test(`${email.subject}\n${body}`)) {
      lead.eventType = "wedding";
    }

    // Free-text message block: everything after "Message:" up to the footer.
    const messageMatch = body.match(/^\s*Message\s*:?\s*$([\s\S]*)/im)
      ?? body.match(/^\s*Message\s*:\s*(.+[\s\S]*)/im);
    if (messageMatch) {
      let text = messageMatch[1];
      const footer = text.match(FOOTER_RE);
      if (footer && footer.index !== undefined) text = text.slice(0, footer.index);
      const cleaned = text.replace(/\s+/g, " ").trim();
      if (cleaned) lead.notes = cleaned.slice(0, 500);
    }
    if (guestRange) {
      lead.notes = lead.notes
        ? `${lead.notes} [Guests: ${guestRange}]`
        : `Guests: ${guestRange}`;
    }

    const isClean =
      Boolean(lead.clientName) &&
      Boolean(lead.clientEmail) &&
      Boolean(lead.eventDate);
    const fieldsFound = [
      lead.clientEmail,
      lead.clientPhone,
      lead.eventDate,
      lead.guestCount,
      lead.notes,
    ].filter(Boolean).length;
    lead.confidence = isClean ? 0.95 : fieldsFound >= 2 ? 0.92 : 0.85;

    return lead;
  },
};
