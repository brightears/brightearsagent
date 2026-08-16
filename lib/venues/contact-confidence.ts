import { emailRank } from "@/lib/discovery/contacts";
import type { ContactEnrichmentState } from "@/app/generated/prisma/enums";

/**
 * Contact confidence (P10.5): how sure we are that a venue address actually
 * reaches the person who books entertainment. Autonomy keys on this — the
 * agent auto-drafts only to HIGH-confidence contacts; LOW ones keep the
 * manual "Draft pitch" button plus a "verify before sending" flag on the
 * card. (A pitch to reservations@ isn't dangerous, it's wasted — and wasted
 * sends burn the artist's own Gmail reputation.)
 *
 * HIGH = an enrichment result whose strict first-party proof was persisted as
 * FOUND_DIRECT, or (only for legacy/manual rows with no enrichment state) a
 * named/booking-specific contact. Any other persisted state is authoritative
 * LOW: a stale snippet name or role words from a publisher must not bypass the
 * autonomy gate.
 */
export type ContactConfidence = "high" | "low";

export function contactConfidence(
  email: string | null | undefined,
  contactName?: string | null,
  contactState?: ContactEnrichmentState | null,
): ContactConfidence | null {
  if (!email) return null;
  if (contactState === "FOUND_DIRECT") return "high";
  if (contactState != null) return "low";
  if (contactName && contactName.trim().length > 1) return "high";
  return emailRank(email) >= 3 ? "high" : "low";
}
