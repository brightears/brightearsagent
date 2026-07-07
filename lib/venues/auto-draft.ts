import { db } from "@/lib/db";
import { isAgentPaused } from "@/lib/billing/metering";
import { draftPitchForVenue } from "@/lib/venues/draft-pitch";
import { contactConfidence } from "@/lib/venues/contact-confidence";
import type { Business } from "@/app/generated/prisma/client";

export type AutoDraftResult = {
  attempted: number;
  created: number;
  /** What ended the run early, if anything ("paused" | "license"). */
  stoppedBy: string | null;
};

/**
 * Nightly auto-draft (P8.1) — the step that turns the Hunt from a silent feed
 * into an agent. After each tenant's scan, draft pitches for the top
 * contactable venues, best-first (HOT before WARM before SEED, then fit),
 * up to the SAME per-temperature daily caps the manual button obeys —
 * draftPitchForVenue enforces every guard identically (pause, license,
 * suppression, dedupe, caps-before-LLM-spend, jurisdiction snapshot).
 *
 * Autonomy-safe on every tier by construction: a draft is not a send. Sends
 * remain behind the owner's approval (and the 10.5 gate ladder) everywhere.
 */
export async function autoDraftPitches(
  business: Business,
  opts: { max?: number } = {},
): Promise<AutoDraftResult> {
  const result: AutoDraftResult = { attempted: 0, created: 0, stoppedBy: null };
  if (isAgentPaused(business.plan)) return { ...result, stoppedBy: "paused" };

  // Candidates: contactable, not yet pitched, no live pitch waiting. Enum
  // declaration order makes temperature asc = HOT → WARM → SEED.
  const venues = await db.venue.findMany({
    where: {
      businessId: business.id,
      status: { in: ["DISCOVERED", "QUALIFIED"] },
      bookingEmail: { not: null },
      pitches: { none: { status: { in: ["PENDING", "APPROVED"] } } },
    },
    orderBy: [{ temperature: "asc" }, { fitScore: "desc" }],
    take: opts.max ?? 18, // ≤ summed daily caps (HOT 10 + WARM 5 + SEED 3)
    select: { id: true, temperature: true, bookingEmail: true, bookingContactName: true },
  });

  const cappedTemps = new Set<string>();
  for (const venue of venues) {
    if (cappedTemps.has(venue.temperature)) continue;
    // Contact-confidence gate (P10.5): autonomy only toward addresses that
    // plausibly reach the booker. Generic info@/hello@ stays MANUAL — the
    // card flags "verify before sending" and the owner decides.
    if (contactConfidence(venue.bookingEmail, venue.bookingContactName) !== "high") continue;
    result.attempted++;
    const r = await draftPitchForVenue(business, venue.id);
    if (r.ok) {
      if (r.created) result.created++;
      continue;
    }
    switch (r.reason) {
      case "cap":
        // This temperature is done for today; others may still have room.
        cappedTemps.add(venue.temperature);
        break;
      case "paused":
      case "license":
        // Tenant-level stops — nothing else will succeed either.
        result.stoppedBy = r.reason;
        return result;
      case "llm":
      case "state":
        // Transient LLM hiccup / venue moved on or suppressed — skip, continue.
        break;
    }
  }
  return result;
}
