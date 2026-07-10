// Quote engine (June 2026). PURE — no DB, no LLM, no clock. Computes a price
// quote for an inquiry from the artist's OWN pricing, never an invented number.
//
// Hard guardrails (the whole point of the pricing model):
//   1. GROUNDED — a quote only comes from a package that genuinely matches the
//      event, the residency rate (for a clearly-residency inquiry), or the
//      floor/sweet-spot. No pricing → no quote.
//   2. NEVER BELOW THE FLOOR — every one-off amount is clamped up to feeFloor;
//      a residency is priced at its own per-night rate (its own floor).
//   3. FIRM vs ESTIMATE — a real package/residency match is firm; otherwise a
//      "from X, typically ~Y" estimate, never a fabricated exact fee.
//   4. POSITIVE — a non-positive amount is treated as "no price" (falls through).
//
// Order matters: package match FIRST (the strongest grounding), then an
// EXPLICIT residency inquiry, then the floor estimate. Residency detection is
// phrase/word-boundary based so ordinary one-off events ("presidential gala",
// "monthly company gala") are never mistaken for a recurring slot.
import { formatMoney } from "@/lib/money";

export type QuoteBasis = "package" | "residency" | "estimate";

export type QuotePackage = {
  name: string;
  description: string | null;
  priceMin: number; // cents
  priceMax: number | null; // cents
  eventTypes: string[];
};

export type QuoteInput = {
  currency: string;
  feeFloor: number | null; // cents — the one-off floor
  feeSweetSpot: number | null; // cents
  residencyRate: number | null; // cents — per night OR per hour (see unit)
  /** "night" (default) or "hour" — how the residency rate is quoted. */
  residencyRateUnit?: string | null;
  /** How many hours the one-off floor covers (null = unspecified). */
  oneOffHours?: number | null;
  packages: QuotePackage[];
  eventType: string | null; // from the inquiry
};

export type Quote = {
  currency: string;
  basis: QuoteBasis;
  label: string;
  minAmount: number; // cents — firm amount, or the "from" floor
  maxAmount: number | null; // cents — upper end of a range (firm), else null
  typicalAmount: number | null; // cents — sweet spot (estimate only)
  isEstimate: boolean;
  perNight: boolean; // residency rate quoted per night
  perHour: boolean; // residency rate quoted per hour (unit "hour")
  /** One-off quotes: how many hours the price covers (null = unstated). */
  coversHours: number | null;
  validityDays: number;
};

const VALIDITY_DAYS = 14;

// Explicit residency signals — word-boundary / phrase based so a one-off event
// that merely CONTAINS these letters ("presidential", "residential estate",
// "monthly gala") is NOT mistaken for a recurring slot.
const RESIDENCY_PATTERNS: RegExp[] = [
  /\bresidenc(y|ies)\b/,
  /\bresident\s+(dj|set|slot|night|performer|musician|band|singer)\b/,
  /\brecurring\b/,
  /\bongoing\b/,
  /\bregular\s+(slot|night|gig|set|booking|spot)\b/,
  /\bevery\s+(week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  /\b(weekly|monthly|fortnightly|biweekly|bi-weekly)\s+(slot|night|gig|set|booking|residency|spot)\b/,
];

function looksLikeResidency(eventType: string | null): boolean {
  const t = (eventType ?? "").toLowerCase();
  return RESIDENCY_PATTERNS.some((re) => re.test(t));
}

/** Meaningful (>=3 char) word tokens, for package matching. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

/**
 * Match a package to the inquiry by whole-word overlap (not raw substring, which
 * let "al" match "gala"). Exact match wins; otherwise the package and the
 * inquiry must share a real word. No match → fall through to a floor estimate
 * (always floor-safe) rather than grounding a FIRM quote on a guess.
 */
function matchPackage(eventType: string | null, packages: QuotePackage[]): QuotePackage | null {
  const t = (eventType ?? "").toLowerCase().trim();
  if (!t) return null;
  const tTokens = new Set(tokens(t));
  return (
    packages.find((p) =>
      p.eventTypes.some((et) => {
        const e = et.toLowerCase().trim();
        if (!e) return false;
        if (e === t) return true;
        return tokens(e).some((w) => tTokens.has(w));
      }),
    ) ?? null
  );
}

/** Capitalize the first letter of each word (apostrophe-safe). */
export function titleCaseEvent(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}

const pos = (n: number | null): n is number => n != null && n > 0;

/** Returns a grounded quote, or null when there's no pricing to quote from. */
export function computeQuote(input: QuoteInput): Quote | null {
  const floor = pos(input.feeFloor) ? input.feeFloor : null;

  // 1. Package match FIRST — the strongest, most specific grounding. Clamped up
  //    to the floor and positivity-guarded.
  const pkg = matchPackage(input.eventType, input.packages);
  if (pkg && pos(pkg.priceMin)) {
    const min = floor != null ? Math.max(pkg.priceMin, floor) : pkg.priceMin;
    if (pos(min)) {
      const max = pkg.priceMax != null && pkg.priceMax > min ? pkg.priceMax : null;
      return {
        currency: input.currency,
        basis: "package",
        label: pkg.name,
        minAmount: min,
        maxAmount: max,
        typicalAmount: null,
        isEstimate: false,
        perNight: false,
      perHour: false,
      coversHours: input.oneOffHours ?? null,
        validityDays: VALIDITY_DAYS,
      };
    }
  }

  // 2. EXPLICIT residency inquiry — priced at the per-night residency rate (its
  //    own floor; a residency deliberately trades per-night rate for recurrence,
  //    so it is NOT clamped to the one-off floor).
  if (pos(input.residencyRate) && looksLikeResidency(input.eventType)) {
    const perHour = input.residencyRateUnit === "hour";
    return {
      currency: input.currency,
      basis: "residency",
      label: perHour ? "Residency (per hour)" : "Residency (per night)",
      minAmount: input.residencyRate,
      maxAmount: null,
      typicalAmount: null,
      isEstimate: false,
      perNight: !perHour,
      perHour,
      coversHours: null,
      validityDays: VALIDITY_DAYS,
    };
  }

  // 3. Estimate — needs a positive floor; the sweet spot gives a "typically ~Y".
  if (floor != null) {
    return {
      currency: input.currency,
      basis: "estimate",
      label: input.eventType ? `${titleCaseEvent(input.eventType)} performance` : "Performance",
      minAmount: floor,
      maxAmount: null,
      typicalAmount: pos(input.feeSweetSpot) && input.feeSweetSpot > floor ? input.feeSweetSpot : null,
      isEstimate: true,
      perNight: false,
      perHour: false,
      coversHours: input.oneOffHours ?? null,
      validityDays: VALIDITY_DAYS,
    };
  }

  // 4. Nothing to quote from — caller should ask for details instead.
  return null;
}

/** Human-readable headline for the quote, in the artist's currency. */
export function quoteHeadline(q: Quote): string {
  const min = formatMoney(q.minAmount, q.currency);
  if (q.perHour) return `${min} per hour`;
  if (q.perNight) return `${min} per night`;
  if (q.maxAmount) return `${min}–${formatMoney(q.maxAmount, q.currency)}`;
  if (q.isEstimate) {
    return q.typicalAmount
      ? `From ${min}, typically around ${formatMoney(q.typicalAmount, q.currency)}`
      : `From ${min}`;
  }
  return min;
}
