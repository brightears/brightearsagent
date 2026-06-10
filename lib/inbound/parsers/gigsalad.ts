import { LeadSource } from "@/app/generated/prisma/enums";
import type { InboundEmail, ParsedLead, SourceParser } from "@/lib/inbound/types";

/**
 * GigSalad lead-notification parser.
 *
 * Format research (2024-2026):
 * - Sender: leads@gigsalad.com (GigSalad's own whitelist guidance lists
 *   leads@/gigs@/yourfriends@/noreply@gigsalad.com — help article 62).
 * - GigSalad DELIBERATELY WITHHOLDS client contact details: no client email
 *   ever; phone only unlocked inside the platform after a response/booking
 *   (help article 64). So clientEmail/clientPhone are never set here, and
 *   confidence stays high — that IS the complete extraction for this source.
 * - The default notification body is minimal ("The email will not have the
 *   lead's details... click the button" — help article 81); richer variants
 *   (additional-details emails) carry a summary sentence plus labeled lines
 *   (Event Type / Event Date / Location / Number of Guests / Budget).
 * - Reminders re-sent at 4/12/24h from the same address (help article 81).
 */

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "Saturday, June 14, 2026" | "June 14, 2026" | "06/14/2026" (US) -> "2026-06-14". */
function toIsoDate(raw: string): string | undefined {
  const s = raw.trim();

  // Written month: optional weekday, "June 14, 2026"
  const written = s.match(
    /(?:[A-Za-z]+,\s*)?([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/,
  );
  if (written) {
    const month = MONTHS[written[1].toLowerCase()];
    const day = parseInt(written[2], 10);
    const year = parseInt(written[3], 10);
    if (month && day >= 1 && day <= 31) return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // US numeric: MM/DD/YYYY (GigSalad is US-centric; assume month-first)
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
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<td[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** First value after a labeled line like "Event Date: ..." (one field per line). */
function labeled(body: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, "im");
    const m = body.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

/** Lowercase event type, normalized to the canonical single words where clear. */
function normalizeEventType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.includes("wedding")) return "wedding";
  if (t.includes("birthday")) return "birthday";
  if (t.includes("corporate") || t.includes("company")) return "corporate";
  return t;
}

const SENDER_RE = /@gigsalad\.com$/i;
const LEAD_HINT_RE = /\blead\b/i;
const BODY_LEAD_RE = /\b(new lead|gig lead|unread lead|view lead|view the (?:full )?event information)\b/i;

// "Marisol G. is looking for a DJ for a Wedding Reception [on DATE] [in LOCATION]"
// "Derrick T. needs a DJ for a Quinceanera on 07/03/2026 in San Antonio, TX."
const SUMMARY_RE =
  /^[ \t]*([A-Z][\w'.-]*(?: [A-Z][\w'.-]*\.?)*) (?:is looking for|needs|is planning|wants) (?:a|an) ([^.\n]+?) for (?:a|an|their) ([^.\n]+?)(?: on ([^.\n]+?))?(?: in ([A-Za-z .'-]+(?:, [A-Z]{2})?))?\.?$/m;

export const gigsaladParser: SourceParser = {
  source: LeadSource.GIGSALAD,

  match(email: InboundEmail): boolean {
    const fromAddress = email.from.trim().toLowerCase();
    if (!SENDER_RE.test(fromAddress)) return false;
    return LEAD_HINT_RE.test(email.subject) || BODY_LEAD_RE.test(email.textBody);
  },

  parse(email: InboundEmail): ParsedLead | null {
    if (!this.match(email)) return null;

    const body =
      email.textBody.trim().length > 0
        ? email.textBody
        : email.htmlBody
          ? stripHtml(email.htmlBody)
          : "";

    const isLeadNotification =
      BODY_LEAD_RE.test(body) || LEAD_HINT_RE.test(email.subject);
    if (!isLeadNotification) return null;

    const lead: ParsedLead = { source: LeadSource.GIGSALAD, confidence: 0.9 };

    // Labeled field lines (richer / additional-details variant).
    const eventTypeRaw = labeled(body, ["Event Type", "Event"]);
    const eventDateRaw = labeled(body, ["Event Date", "Date"]);
    const locationRaw = labeled(body, ["Location", "Event Location", "City"]);
    const guestsRaw = labeled(body, ["Number of Guests", "Guest Count", "Guests"]);
    const budgetRaw = labeled(body, ["Budget", "Budget Range"]);

    // Summary sentence ("X is looking for / needs a CATEGORY for a TYPE on DATE in LOC").
    const summary = body.match(SUMMARY_RE);
    if (summary) {
      lead.clientName = summary[1];
      lead.notes = summary[0].trim();
    }

    const eventType = eventTypeRaw ?? summary?.[3];
    if (eventType) lead.eventType = normalizeEventType(eventType);

    const eventDate = eventDateRaw ?? summary?.[4];
    if (eventDate) {
      const iso = toIsoDate(eventDate);
      if (iso) lead.eventDate = iso;
    }

    // GigSalad gives city/state, not a venue name; it's the only location signal.
    const location = locationRaw ?? summary?.[5];
    if (location) lead.venue = location.trim().replace(/\.+$/, "");

    if (guestsRaw) {
      const n = parseInt(guestsRaw.replace(/[,\s]/g, ""), 10);
      if (Number.isFinite(n) && n > 0) lead.guestCount = n;
    }

    if (budgetRaw) lead.budgetHint = budgetRaw;

    // Subject fallback: "New lead: Wedding Reception in Austin, TX"
    if (!lead.eventType || !lead.venue) {
      const subj = email.subject.match(
        /new lead[:!]?\s+([^,\n]+?)\s+in\s+([A-Za-z .'-]+(?:,\s*[A-Z]{2})?)\s*$/i,
      );
      if (subj) {
        if (!lead.eventType) lead.eventType = normalizeEventType(subj[1]);
        if (!lead.venue) lead.venue = subj[2].trim();
      }
    }

    // Contact details are withheld by GigSalad by design — never set
    // clientEmail/clientPhone. Confidence stays high: a sender-verified
    // GigSalad lead notification IS a real lead even when bodily minimal.
    const fieldsFound = [lead.eventType, lead.eventDate, lead.venue].filter(
      Boolean,
    ).length;
    lead.confidence = fieldsFound >= 3 ? 0.95 : fieldsFound >= 1 ? 0.92 : 0.9;

    return lead;
  },
};
