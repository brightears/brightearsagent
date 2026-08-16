/**
 * Deterministic guest-count extraction.
 *
 * Same reasoning as the date: the number is written plainly in the message
 * ("around 140 guests"), yet the model returned it on barely a third of cases
 * in the worst run. Guest count picks the package and shapes the quote, so a
 * missing one costs a round-trip with the client on almost every inquiry.
 *
 * Deliberately narrow. The number must sit immediately beside a word that
 * means people — a message is full of other numbers (a budget, a year, a phone
 * number, "8pm till 1am") and inventing a headcount is worse than having none,
 * because the owner would quote against it.
 */
const PATTERNS: RegExp[] = [
  // "140 guests", "about 110 people", "150 pax", "60 heads", "80+ guests"
  /\b(\d{1,4})[ \t]*\+?[ \t]*(?:guests?|people|persons?|pax|attendees|heads|adults)\b/i,
  // "guests: 140", "headcount 110", "number of guests - 90"
  /\b(?:guests?|headcount|head[ \t]*count|number[ \t]+of[ \t]+guests)[ \t]*[:\-]?[ \t]*(\d{1,4})\b/i,
  // "a party of 90", "group of 60"
  /\b(?:party|group)[ \t]+of[ \t]+(\d{1,4})\b/i,
];

/** Plausible headcount, or undefined when the text does not clearly state one. */
export function extractGuestCount(text: string): number | undefined {
  if (!text.trim()) return undefined;
  for (const pattern of PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    const n = Number(m[1]);
    // A private party of 3 and a stadium of 40,000 are both far likelier to be
    // a misread than a real booking for this product.
    if (Number.isFinite(n) && n >= 5 && n <= 5000) return n;
  }
  return undefined;
}
