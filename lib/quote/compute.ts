// Quote engine (June 2026). PURE — no DB, no LLM, no clock. Computes a price
// quote for an inquiry from the artist's OWN pricing, never an invented number.
//
// Hard guardrails (the whole point of the pricing model):
//   1. GROUNDED — a quote only ever comes from a matching package, the
//      residency rate, or the floor/sweet-spot. No pricing data → no quote.
//   2. NEVER BELOW THE FLOOR — any one-off amount is clamped up to feeFloor.
//   3. FIRM vs ESTIMATE — a package match (or residency rate) is a firm number;
//      otherwise it's a "from X, typically ~Y" estimate, never a fake exact fee.
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
  residencyRate: number | null; // cents — per night
  gigTypes: string[]; // "one-off" / "residency"
  packages: QuotePackage[];
  eventType: string | null; // from the inquiry
};

export type Quote = {
  currency: string;
  basis: QuoteBasis;
  label: string; // line-item label, e.g. "Wedding package", "Residency (per night)"
  minAmount: number; // cents — firm amount, or the "from" floor
  maxAmount: number | null; // cents — upper end of a range (firm), else null
  typicalAmount: number | null; // cents — sweet spot (estimate only)
  isEstimate: boolean; // true = "from / typically", false = a firm figure
  perNight: boolean; // residency rates are per night
  validityDays: number;
};

const VALIDITY_DAYS = 14;

// Inquiry phrasing that signals a recurring/residency booking rather than a one-off.
const RESIDENCY_HINTS = [
  "residen",
  "weekly",
  "every week",
  "recurring",
  "ongoing",
  "monthly",
  "nights a week",
  "regular slot",
  "regular night",
];

function looksLikeResidency(eventType: string | null, gigTypes: string[]): boolean {
  const t = (eventType ?? "").toLowerCase();
  if (RESIDENCY_HINTS.some((h) => t.includes(h))) return true;
  // An artist who ONLY takes residencies (not one-offs) → treat inquiries as such.
  return gigTypes.includes("residency") && !gigTypes.includes("one-off");
}

function matchPackage(eventType: string | null, packages: QuotePackage[]): QuotePackage | null {
  const t = (eventType ?? "").toLowerCase().trim();
  if (!t) return null;
  return (
    packages.find((p) =>
      p.eventTypes.some((et) => {
        const e = et.toLowerCase().trim();
        return e.length > 0 && (t.includes(e) || e.includes(t));
      }),
    ) ?? null
  );
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Returns a grounded quote, or null when there's no pricing to quote from. */
export function computeQuote(input: QuoteInput): Quote | null {
  // 1. Residency — a recurring slot priced at the per-night rate (its own floor).
  if (input.residencyRate != null && looksLikeResidency(input.eventType, input.gigTypes)) {
    return {
      currency: input.currency,
      basis: "residency",
      label: "Residency (per night)",
      minAmount: input.residencyRate,
      maxAmount: null,
      typicalAmount: null,
      isEstimate: false,
      perNight: true,
      validityDays: VALIDITY_DAYS,
    };
  }

  // 2. Package match — a firm price (or range), clamped up to the floor.
  const pkg = matchPackage(input.eventType, input.packages);
  if (pkg) {
    const min = input.feeFloor != null ? Math.max(pkg.priceMin, input.feeFloor) : pkg.priceMin;
    const max = pkg.priceMax != null ? Math.max(pkg.priceMax, min) : null;
    return {
      currency: input.currency,
      basis: "package",
      label: pkg.name,
      minAmount: min,
      maxAmount: max && max > min ? max : null,
      typicalAmount: null,
      isEstimate: false,
      perNight: false,
      validityDays: VALIDITY_DAYS,
    };
  }

  // 3. Estimate — needs at least a floor; the sweet spot gives a "typically ~Y".
  if (input.feeFloor != null) {
    return {
      currency: input.currency,
      basis: "estimate",
      label: input.eventType ? `${titleCase(input.eventType)} performance` : "Performance",
      minAmount: input.feeFloor,
      maxAmount: null,
      typicalAmount:
        input.feeSweetSpot != null && input.feeSweetSpot > input.feeFloor ? input.feeSweetSpot : null,
      isEstimate: true,
      perNight: false,
      validityDays: VALIDITY_DAYS,
    };
  }

  // 4. Nothing to quote from — caller should ask for details instead.
  return null;
}

/** Human-readable headline for the quote, in the artist's currency. */
export function quoteHeadline(q: Quote): string {
  const min = formatMoney(q.minAmount, q.currency);
  if (q.perNight) return `${min} per night`;
  if (q.maxAmount) return `${min}–${formatMoney(q.maxAmount, q.currency)}`;
  if (q.isEstimate) {
    return q.typicalAmount
      ? `From ${min}, typically around ${formatMoney(q.typicalAmount, q.currency)}`
      : `From ${min}`;
  }
  return min;
}
