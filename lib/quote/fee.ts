// Fee parsing/formatting for the money loop (P11.1). Pure — shared by the
// "Mark booked" fee capture (client) and the value receipts (server).

/**
 * Owner-typed fee → minor units (cents). Accepts "1500", "1,500", "1500.50",
 * "฿1500", "$1,500.00". Null on anything non-positive or unparseable — the
 * fee is OPTIONAL, so garbage degrades to "no value recorded", never an error.
 */
export function parseFeeToMinor(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const major = Number.parseFloat(cleaned);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 100);
}

/** Minor units → "THB 15,000" (no decimals when whole — receipts, not invoices). */
export function formatMinor(minor: number, currency: string): string {
  const major = minor / 100;
  const whole = Number.isInteger(major);
  return `${currency} ${major.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
