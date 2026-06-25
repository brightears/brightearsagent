// Locale-aware money formatting in the ARTIST's own currency (never our USD
// billing). Whole-unit rounding (artists price in round numbers); narrow symbol
// so THB reads "฿15,000"; ISO-code fallback for an unknown/invalid code.
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      currencyDisplay: "narrowSymbol",
    }).format(cents / 100);
  } catch {
    return `${Math.round(cents / 100).toLocaleString("en-US")} ${currency}`;
  }
}
