import { emailRank } from "@/lib/discovery/contacts";

/**
 * Contact confidence (P10.5): how sure we are that a venue address actually
 * reaches the person who books entertainment. Autonomy keys on this — the
 * agent auto-drafts only to HIGH-confidence contacts; LOW ones keep the
 * manual "Draft pitch" button plus a "verify before sending" flag on the
 * card. (A pitch to reservations@ isn't dangerous, it's wasted — and wasted
 * sends burn the artist's own Gmail reputation.)
 *
 * HIGH = a booking-specific local part (events@/bookings@/privatehire@ — the
 * top emailRank tier) or a NAMED contact (a person published next to the
 * address). LOW = generic (info@/hello@/contact@) or unknown locals.
 */
export type ContactConfidence = "high" | "low";

export function contactConfidence(
  email: string | null | undefined,
  contactName?: string | null,
): ContactConfidence | null {
  if (!email) return null;
  if (contactName && contactName.trim().length > 1) return "high";
  return emailRank(email) >= 3 ? "high" : "low";
}
