// The beta verdict for proactive discovery.
//
// Activity counts ("43 venues found") prove that the machine ran, not that it
// found anything an artist would pursue. This report turns decisions the app
// already records into three launch questions:
//   1. Did the artist say the match was useful?
//   2. Did the Hunt find a direct contact?
//   3. Was the drafted pitch good enough to approve?
//
// It deliberately excludes unreviewed cards from useful-match precision and
// keeps low-sample rates in LEARNING. A flattering 100% from one decision must
// never become a launch claim.

import { db } from "@/lib/db";
import { contactConfidence } from "@/lib/venues/contact-confidence";
import { SKIP_REASONS, type SkipReason } from "@/lib/venues/feed";

export const HUNT_QUALITY_WINDOW_DAYS = 30;

export const HUNT_QUALITY_TARGETS = {
  usefulMatch: { targetPct: 70, minSample: 20, direction: "min" },
  directContact: { targetPct: 60, minSample: 20, direction: "min" },
  pitchApproval: { targetPct: 70, minSample: 10, direction: "min" },
  clearMiss: { targetPct: 10, minSample: 20, direction: "max" },
} as const;

/** These are discovery failures, not merely personal taste. */
export const CLEAR_MISS_REASONS = new Set<SkipReason>([
  "NO_ENTERTAINMENT",
  "STALE_OR_CLOSED",
]);

const OWNER_SKIP_REASONS = new Set<string>(Object.keys(SKIP_REASONS));
const POSITIVE_PITCH_STATUSES = new Set(["APPROVED", "SENDING", "SENT"]);
const DECIDED_PITCH_STATUSES = new Set(["APPROVED", "SENDING", "SENT", "DISCARDED"]);

export type QualityState = "learning" | "on_track" | "needs_work";

export type QualityGate = {
  numerator: number;
  denominator: number;
  ratePct: number | null;
  targetPct: number;
  minSample: number;
  direction: "min" | "max";
  state: QualityState;
};

export type HuntQualityRow = {
  businessId: string;
  bookingEmail: string | null;
  bookingContactName: string | null;
  suppressedReason: string | null;
  repliedAt: Date | null;
  status: string;
  pitches: {
    status: string;
    editedSubject: string | null;
    editedBody: string | null;
    followUpOfId: string | null;
    sentAt: Date | null;
  }[];
};

export type HuntQualitySummary = {
  since: Date;
  windowDays: number;
  tenantsRepresented: number;
  venuesFound: number;
  directContacts: number;
  highConfidenceContacts: number;
  reviewedMatches: number;
  pursuedMatches: number;
  skippedMatches: number;
  clearMisses: number;
  pitchDecisions: number;
  pitchesApproved: number;
  pitchesDiscarded: number;
  untouchedApprovals: number;
  venuesPitched: number;
  venueReplies: number;
  venueBookings: number;
  skipReasons: Partial<Record<SkipReason, number>>;
  gates: {
    usefulMatch: QualityGate;
    directContact: QualityGate;
    pitchApproval: QualityGate;
    clearMiss: QualityGate;
  };
};

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function gate(
  numerator: number,
  denominator: number,
  target: { targetPct: number; minSample: number; direction: "min" | "max" },
): QualityGate {
  const ratePct = pct(numerator, denominator);
  const state: QualityState =
    denominator < target.minSample || ratePct === null
      ? "learning"
      : target.direction === "min"
        ? ratePct >= target.targetPct
          ? "on_track"
          : "needs_work"
        : ratePct <= target.targetPct
          ? "on_track"
          : "needs_work";
  return { numerator, denominator, ratePct, ...target, state };
}

export function summarizeHuntQuality(
  rows: HuntQualityRow[],
  now = new Date(),
  windowDays = HUNT_QUALITY_WINDOW_DAYS,
): HuntQualitySummary {
  let directContacts = 0;
  let highConfidenceContacts = 0;
  let pursuedMatches = 0;
  let skippedMatches = 0;
  let clearMisses = 0;
  let pitchDecisions = 0;
  let pitchesApproved = 0;
  let pitchesDiscarded = 0;
  let untouchedApprovals = 0;
  let venuesPitched = 0;
  let venueReplies = 0;
  let venueBookings = 0;
  const skipReasons: Partial<Record<SkipReason, number>> = {};

  for (const venue of rows) {
    if (venue.bookingEmail) {
      directContacts++;
      if (contactConfidence(venue.bookingEmail, venue.bookingContactName) === "high") {
        highConfidenceContacts++;
      }
    }

    const primaryPitches = venue.pitches.filter((pitch) => !pitch.followUpOfId);
    const positive = primaryPitches.some((pitch) => POSITIVE_PITCH_STATUSES.has(pitch.status));
    const ownerSkip =
      venue.suppressedReason && OWNER_SKIP_REASONS.has(venue.suppressedReason)
        ? (venue.suppressedReason as SkipReason)
        : null;

    // A later opt-out/suppression must not rewrite an earlier explicit pursue
    // decision as a discovery miss. Positive wins if historical states overlap.
    if (positive) {
      pursuedMatches++;
    } else if (ownerSkip) {
      skippedMatches++;
      skipReasons[ownerSkip] = (skipReasons[ownerSkip] ?? 0) + 1;
      if (CLEAR_MISS_REASONS.has(ownerSkip)) clearMisses++;
    }

    for (const pitch of primaryPitches) {
      if (!DECIDED_PITCH_STATUSES.has(pitch.status)) continue;
      // "Not a fit" settles the auto-draft as DISCARDED too, but that is a
      // lead-quality rejection, not a writing-quality vote. Only a standalone
      // "Discard draft" belongs in pitch-approval precision.
      if (pitch.status === "DISCARDED" && ownerSkip) continue;
      pitchDecisions++;
      if (POSITIVE_PITCH_STATUSES.has(pitch.status)) {
        pitchesApproved++;
        if (!pitch.editedSubject && !pitch.editedBody) untouchedApprovals++;
      } else {
        pitchesDiscarded++;
      }
    }

    const pitched = primaryPitches.some((pitch) => pitch.sentAt);
    if (pitched) {
      venuesPitched++;
      if (venue.repliedAt) venueReplies++;
      if (venue.status === "BOOKED") venueBookings++;
    }
  }

  const reviewedMatches = pursuedMatches + skippedMatches;
  return {
    since: new Date(now.getTime() - windowDays * 24 * 3600 * 1000),
    windowDays,
    tenantsRepresented: new Set(rows.map((row) => row.businessId)).size,
    venuesFound: rows.length,
    directContacts,
    highConfidenceContacts,
    reviewedMatches,
    pursuedMatches,
    skippedMatches,
    clearMisses,
    pitchDecisions,
    pitchesApproved,
    pitchesDiscarded,
    untouchedApprovals,
    venuesPitched,
    venueReplies,
    venueBookings,
    skipReasons,
    gates: {
      usefulMatch: gate(
        pursuedMatches,
        reviewedMatches,
        HUNT_QUALITY_TARGETS.usefulMatch,
      ),
      directContact: gate(
        directContacts,
        rows.length,
        HUNT_QUALITY_TARGETS.directContact,
      ),
      pitchApproval: gate(
        pitchesApproved,
        pitchDecisions,
        HUNT_QUALITY_TARGETS.pitchApproval,
      ),
      clearMiss: gate(
        clearMisses,
        reviewedMatches,
        HUNT_QUALITY_TARGETS.clearMiss,
      ),
    },
  };
}

export async function computeHuntQuality(
  opts: { businessId?: string; now?: Date; windowDays?: number } = {},
): Promise<HuntQualitySummary> {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? HUNT_QUALITY_WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * 24 * 3600 * 1000);
  const rows = await db.venue.findMany({
    where: {
      createdAt: { gte: since },
      ...(opts.businessId ? { businessId: opts.businessId } : {}),
    },
    select: {
      businessId: true,
      bookingEmail: true,
      bookingContactName: true,
      suppressedReason: true,
      repliedAt: true,
      status: true,
      pitches: {
        select: {
          status: true,
          editedSubject: true,
          editedBody: true,
          followUpOfId: true,
          sentAt: true,
        },
      },
    },
  });
  return summarizeHuntQuality(rows, now, windowDays);
}

function stateLabel(gate: QualityGate): string {
  if (gate.state === "learning") {
    return `LEARNING ${gate.denominator}/${gate.minSample}`;
  }
  return gate.state === "on_track" ? "ON TRACK" : "NEEDS WORK";
}

function rateLabel(gate: QualityGate): string {
  return gate.ratePct === null
    ? "—"
    : `${gate.ratePct}% (${gate.numerator}/${gate.denominator})`;
}

export function renderHuntQualityText(summary: HuntQualitySummary): string {
  const highContactPct = pct(summary.highConfidenceContacts, summary.venuesFound);
  const replyPct = pct(summary.venueReplies, summary.venuesPitched);
  return [
    `HUNT QUALITY · rolling ${summary.windowDays}d · ${summary.tenantsRepresented} tenant${summary.tenantsRepresented === 1 ? "" : "s"}`,
    `• Useful matches: ${rateLabel(summary.gates.usefulMatch)} · ${stateLabel(summary.gates.usefulMatch)} · target ≥${summary.gates.usefulMatch.targetPct}%`,
    `• Direct contacts: ${rateLabel(summary.gates.directContact)} · ${stateLabel(summary.gates.directContact)} · target ≥${summary.gates.directContact.targetPct}%`,
    `• Pitch approval: ${rateLabel(summary.gates.pitchApproval)} · ${stateLabel(summary.gates.pitchApproval)} · target ≥${summary.gates.pitchApproval.targetPct}%`,
    `• Clear discovery misses: ${rateLabel(summary.gates.clearMiss)} · ${stateLabel(summary.gates.clearMiss)} · guardrail ≤${summary.gates.clearMiss.targetPct}%`,
    `• Contact confidence: ${highContactPct === null ? "—" : `${highContactPct}%`} high-confidence · outcomes: ${summary.venuesPitched} pitched · ${summary.venueReplies} replied${replyPct === null ? "" : ` (${replyPct}%)`} · ${summary.venueBookings} booked`,
  ].join("\n");
}

export function huntQualityNeedsAttention(summary: HuntQualitySummary): boolean {
  return Object.values(summary.gates).some((metric) => metric.state === "needs_work");
}
