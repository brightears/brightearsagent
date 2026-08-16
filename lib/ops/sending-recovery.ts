import { db } from "@/lib/db";
import { reportError } from "@/lib/report-error";

export const STUCK_VENUE_PITCH_MS = 10 * 60 * 1000;
const MAX_STUCK_PITCHES_PER_ALERT = 20;

/**
 * Surface venue-pitch claims that did not reach their terminal SENT write.
 *
 * A Gmail send may already have succeeded before the process crashed, so this
 * sweep is intentionally read-only. It must never reopen or resend a pitch;
 * an operator first verifies the tenant mailbox and then resolves the row
 * manually with evidence.
 */
export async function surfaceStuckVenuePitchClaims(now = new Date()): Promise<number> {
  const stuck = await db.venuePitch.findMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: new Date(now.getTime() - STUCK_VENUE_PITCH_MS) },
    },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      businessId: true,
      updatedAt: true,
      business: { select: { slug: true } },
      venue: { select: { id: true, name: true } },
    },
    take: MAX_STUCK_PITCHES_PER_ALERT,
  });

  if (stuck.length === 0) return 0;

  const recoveries = stuck.map((pitch) => ({
    pitchId: pitch.id,
    businessId: pitch.businessId,
    tenant: pitch.business.slug,
    venueId: pitch.venue.id,
    venue: pitch.venue.name.replace(/\s+/g, " ").slice(0, 100),
    stuckSince: pitch.updatedAt.toISOString(),
  }));
  const detail = [
    `Stale pitch claims: ${recoveries
      .map((item) => `${item.pitchId} (${item.tenant} / ${item.venue}, since ${item.stuckSince})`)
      .join("; ")}.`,
    "Gmail may already have delivered these messages. Verify the tenant mailbox and logs before manually marking SENT; return a row to APPROVED only when non-delivery is certain. This sweep never changes or resends a pitch.",
  ].join(" ");

  void reportError(
    new Error("venue pitch stuck in SENDING — delivery is uncertain; manual recovery required"),
    {
      kind: "stuck-sending-venue-pitch",
      count: stuck.length,
      pitchIds: stuck.map((pitch) => pitch.id),
      recoveries,
      detail,
    },
  );

  return stuck.length;
}
