/**
 * Deterministic event-type classification from the message text.
 *
 * WHY THIS IS NOT LEFT TO THE MODEL. The extractor is instructed to take only
 * what is explicitly present and never guess — correct for facts like dates,
 * names and venues, where a guess becomes a lie the owner sends to a client.
 * But the occasion is a category, not a quotable value: "we're getting married"
 * never contains the word "wedding". So the model obediently returns null, and
 * the lead lands as a bare "event" (measured at 50% on eval:parse, and visible
 * on the founder's first live lead, which read "event · Sat, Nov 6, 2027").
 *
 * Loosening that instruction was tried first and made things WORSE — eventType
 * fell to 25% and overall extraction from 81% to 69% — so the rule stays, and
 * the classification happens here instead, where it is free, instant, and
 * identical on every run.
 *
 * Only ever a FALLBACK: a labelled form field wins, then the model, then this.
 * Rules are ordered most-specific-first because the phrases overlap — an
 * engagement party is not a wedding, and a company Christmas party is corporate
 * rather than a party.
 */
const RULES: [RegExp, string][] = [
  // Specific occasions that would otherwise be swallowed by a broader rule.
  // "got engaged" is how people actually write it, past tense — an earlier
  // get(ting)? missed it and the message fell through to "private party".
  [/\bengagement\s+(party|do|drinks)\b|\b(get|getting|got|just\s+got)\s+engaged\b/i, "engagement"],
  [/\b(hen|stag|bachelor(ette)?)\b/i, "bachelor party"],
  [/\b(wedding|marriage|nuptials)\b|\bget(ting)?\s+married\b|\bour\s+big\s+day\b|\b(bride|groom)\b|\breception\s+and\s+ceremony\b/i, "wedding"],
  [/\b(corporate|company|office|staff|team[- ]?building|conference|gala\s+dinner|product\s+launch|client\s+event|year[- ]?end\s+(party|do)|christmas\s+party)\b/i, "corporate"],
  [/\b(\d{1,3}(st|nd|rd|th)\s+birthday|birthday|bday|turning\s+\d{1,3})\b/i, "birthday"],
  [/\b(anniversary)\b/i, "anniversary"],
  [/\b(graduation|prom)\b/i, "graduation"],
  [/\b(festival|street\s+party)\b/i, "festival"],
  [/\b(residency|weekly\s+slot|every\s+(friday|saturday|sunday))\b/i, "residency"],
  // Deliberately last: "party" alone is the weakest signal in the set.
  [/\b(private\s+party|house\s+party|party)\b/i, "private party"],
];

/** Lowercase event type, or undefined when the text genuinely does not say. */
export function classifyEventType(text: string): string | undefined {
  if (!text.trim()) return undefined;
  for (const [pattern, type] of RULES) {
    if (pattern.test(text)) return type;
  }
  return undefined;
}
