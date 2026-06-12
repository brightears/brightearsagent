"use server";

// Venue-opportunity feed actions (Phase 10.4, ADR-004) — tenant-scoped via
// getCurrentBusiness, zod-validated, never trusting the UI: the hunting
// license (profileStrength().canPitch) is re-checked server-side before any
// pitch flips state.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { profileStrength } from "@/lib/profile/strength";
import { isSkipReason, SKIP_REASONS } from "@/lib/venues/feed";

type ActionResult = { ok: true } | { ok: false; error: string };

const venueIdSchema = z.string().trim().min(1, "No venue given").max(64);

/** The venue, only if it belongs to the current tenant. */
async function findTenantVenue(businessId: string, venueId: string) {
  return db.venue.findFirst({ where: { id: venueId, businessId } });
}

/**
 * Queue a pitch for a venue: DISCOVERED/QUALIFIED → PITCH_DRAFTED.
 *
 * TODO(10.4 next item — pitch drafter): this action is the wiring point for
 * the actual LLM pitch drafting. When the drafter exists it should run HERE
 * (per-purpose model map via lib/llm, persist the draft for approve-from-
 * phone, meter LlmUsage) before/with the status flip. For now the flip is the
 * whole behavior — the card shows "Pitch queued".
 */
export async function draftVenuePitch(venueId: string): Promise<ActionResult> {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return { ok: false, error: "No venue given" };

  const business = await getCurrentBusiness();

  // The hunting license, enforced server-side (never trust the UI): a weak
  // pitch burns the venue contact forever, so no license = no pitch.
  const [activePackages, gigs] = await Promise.all([
    db.package.count({ where: { businessId: business.id, active: true } }),
    db.gig.count({ where: { businessId: business.id } }),
  ]);
  const strength = profileStrength(business, { activePackages, gigs });
  if (!strength.canPitch) {
    return { ok: false, error: "Finish your profile before the agent may pitch" };
  }

  const venue = await findTenantVenue(business.id, parsed.data);
  if (!venue) return { ok: false, error: "Venue not found" };
  if (venue.status === "PITCH_DRAFTED") return { ok: true }; // idempotent
  if (venue.status !== "DISCOVERED" && venue.status !== "QUALIFIED") {
    return { ok: false, error: "This venue is past the pitch stage" };
  }

  // Status filter repeated in the WHERE so a double-submit can't regress a
  // venue that moved on between read and write.
  await db.venue.updateMany({
    where: {
      id: venue.id,
      businessId: business.id,
      status: { in: ["DISCOVERED", "QUALIFIED"] },
    },
    data: { status: "PITCH_DRAFTED" },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (form `action` must return void) — same gate inside. */
export async function draftVenuePitchForm(venueId: string): Promise<void> {
  await draftVenuePitch(venueId);
}

/**
 * One-tap skip: SUPPRESSED + reason (feeds the future matching tuner), and if
 * the venue has a published booking email it joins the per-tenant master
 * do-not-contact list (OutreachSuppression). Idempotent — re-skipping a
 * suppressed venue is a no-op success.
 */
export async function skipVenue(venueId: string, reason: string): Promise<ActionResult> {
  const parsed = venueIdSchema.safeParse(venueId);
  if (!parsed.success) return { ok: false, error: "No venue given" };
  if (!isSkipReason(reason)) return { ok: false, error: "Unknown skip reason" };

  const business = await getCurrentBusiness();
  const venue = await findTenantVenue(business.id, parsed.data);
  if (!venue) return { ok: false, error: "Venue not found" };

  if (venue.status !== "SUPPRESSED") {
    await db.venue.update({
      where: { id: venue.id },
      data: { status: "SUPPRESSED", suppressedReason: reason },
    });
  }

  // Master suppression list — email ALWAYS lowercased (schema contract).
  // Upsert keeps this idempotent; an existing entry's original reason wins.
  if (venue.bookingEmail) {
    const email = venue.bookingEmail.toLowerCase();
    await db.outreachSuppression.upsert({
      where: { businessId_email: { businessId: business.id, email } },
      create: {
        businessId: business.id,
        email,
        reason: `owner-skip:${SKIP_REASONS[reason]}`,
      },
      update: {},
    });
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (form `action` must return void). */
export async function skipVenueForm(venueId: string, reason: string): Promise<void> {
  await skipVenue(venueId, reason);
}
