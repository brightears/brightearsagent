/**
 * Deterministic event-date extraction from the message text.
 *
 * WHY. The model is supposed to return an ISO date and often does — but not
 * reliably: measured across one day, eventDate ranged from 92% down to 44% on
 * the same ten cases with no code change between runs, which is provider
 * variance we do not control. At 44%, more than half of real inquiries land
 * with no date at all, and a lead with no date cannot be checked against the
 * calendar — so the reply cannot say "I'm free that night", which is the one
 * sentence this product exists to send.
 *
 * A written date is far more regular than an occasion, so unlike event type
 * this needs no judgement at all: "6 November 2027" is not ambiguous. The model
 * still goes first (it handles relative phrasing like "next June" that regex
 * would butcher); this is the floor under it.
 *
 * Two rules keep it honest:
 *   - Only real calendar dates. "2027-09-31" matches the shape and is not a
 *     day; new Date() would silently roll it to October 1 and the owner would
 *     promise a date the client never asked for.
 *   - Only FUTURE dates. Inquiries are about upcoming events, and it also
 *     neatly ignores the past dates people mention in passing ("we saw you play
 *     last year", a quoted email footer from 2024).
 */
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).join("|");

/** Valid only if the parts survive a round-trip — catches 31 September. */
function iso(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return undefined;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Candidate { at: number; iso: string }

function collect(text: string): Candidate[] {
  const found: Candidate[] = [];
  const push = (at: number, v: string | undefined) => { if (v) found.push({ at, iso: v }); };

  // 2027-09-12
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    push(m.index!, iso(+m[1], +m[2], +m[3]));
  }
  // 6 November 2027 · 6th Nov 2027
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})\\.?,?\\s+(\\d{4})\\b`, "gi"))) {
    push(m.index!, iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
  }
  // November 6, 2027 · Nov 6th 2027
  for (const m of text.matchAll(new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"))) {
    push(m.index!, iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]));
  }
  // 03/14/2027 — US order, matching the instruction the extractor already
  // carries ("if the format is ambiguous, assume US MM/DD/YYYY"). Where the
  // first number cannot be a month, read it the other way round rather than
  // discard a date the client clearly wrote.
  for (const m of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    push(m.index!, a > 12 ? iso(y, b, a) : iso(y, a, b));
  }
  return found;
}

/**
 * First future date written in the text, ISO yyyy-mm-dd, or undefined.
 * `today` is injected so this is testable and so the tenant's clock decides
 * what "future" means, not the server's.
 */
export function extractEventDate(text: string, today: Date = new Date()): string | undefined {
  if (!text.trim()) return undefined;
  const floor = today.toISOString().slice(0, 10);
  return collect(text)
    .sort((a, b) => a.at - b.at)
    .find((c) => c.iso >= floor)?.iso;
}
