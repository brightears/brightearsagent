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
import type { ContactEnrichmentState } from "@/app/generated/prisma/enums";

export const HUNT_QUALITY_WINDOW_DAYS = 30;
export const HUNT_REVIEW_SAMPLE_REQUIRED = 20;
export const HUNT_BETA_CONVERSATION_DAYS = 14;
export const HUNT_BETA_COHORT_WINDOW_DAYS = 90;
export const HUNT_BETA_MIN_ARTISTS = 10;
export const HUNT_BETA_CONVERSATION_TARGET_PCT = 30;

export const HUNT_QUALITY_TARGETS = {
  usefulMatch: { targetPct: 70, minSample: 20, direction: "min" },
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
  id: string;
  businessId: string;
  createdAt: Date;
  bookingEmail: string | null;
  bookingContactName: string | null;
  contactState: ContactEnrichmentState | null;
  contactLastAttemptAt: Date | null;
  contactExhaustedAt: Date | null;
  suppressedReason: string | null;
  reviewedAt: Date | null;
  repliedAt: Date | null;
  bookedAt: Date | null;
  status: string;
  pitches: {
    status: string;
    editedSubject: string | null;
    editedBody: string | null;
    followUpOfId: string | null;
    decidedAt: Date | null;
    sentAt: Date | null;
  }[];
};

export type HuntBetaBusinessRow = {
  id: string;
  betaStartedAt: Date | null;
  venues: {
    repliedAt: Date | null;
    pitches: { sentAt: Date | null }[];
  }[];
};

export type ReviewCoverage = {
  reviewed: number;
  required: number;
  state: "learning" | "on_track";
};

export type BetaConversationGate = {
  cohortArtists: number;
  maturedArtists: number;
  pendingArtists: number;
  artistsWithConversation: number;
  ratePct: number | null;
  targetPct: number;
  minSample: number;
  state: QualityState;
};

export type ContactAttemptCoverage = {
  numerator: number;
  denominator: null;
  ratePct: null;
  state: "unavailable";
  reason: string;
};

export type HuntContactFunnel = {
  /** Distinct tenant-scoped Venue rows attempted inside the report window. */
  attemptedVenues: number;
  /** Current stored-contact inventory, independent of the latest retry state. */
  inventory: {
    publishedContacts: number;
    actionableContacts: number;
    genericContacts: number;
    suppressedContacts: number;
  };
  /** Mutually exclusive latest-attempt states; these sum to attemptedVenues. */
  latestAttemptOutcomes: {
    foundDirect: number;
    foundGeneric: number;
    notFoundRetryable: number;
    notFoundExhausted: number;
    errors: number;
    inProgress: number;
    suppressed: number;
    unclassified: number;
  };
  attemptCoverage: ContactAttemptCoverage;
};

export type HuntQualitySummary = {
  since: Date;
  windowDays: number;
  tenantsRepresented: number;
  venuesFound: number;
  contactFunnel: HuntContactFunnel;
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
  reviewCoverage: ReviewCoverage;
  betaConversation: BetaConversationGate;
  gates: {
    usefulMatch: QualityGate;
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

export function summarizeBetaConversation(
  businesses: HuntBetaBusinessRow[],
  now = new Date(),
): BetaConversationGate {
  const horizonMs = HUNT_BETA_CONVERSATION_DAYS * 24 * 3600 * 1_000;
  const cohort = businesses.filter((business) => business.betaStartedAt);
  const matured = cohort.filter(
    (business) => now.getTime() - business.betaStartedAt!.getTime() >= horizonMs,
  );
  const artistsWithConversation = matured.filter((business) => {
    const startedAt = business.betaStartedAt!.getTime();
    const closesAt = startedAt + horizonMs;
    return business.venues.some((venue) => {
      const repliedAt = venue.repliedAt?.getTime();
      if (repliedAt === undefined || repliedAt < startedAt || repliedAt > closesAt) return false;
      // A historical/manual reply is not proof the beta Hunt created a
      // conversation. Require a primary pitch sent inside the cohort window
      // and before this reply.
      return venue.pitches.some((pitch) => {
        const sentAt = pitch.sentAt?.getTime();
        return sentAt !== undefined && sentAt >= startedAt && sentAt <= repliedAt;
      });
    });
  }).length;
  const ratePct = pct(artistsWithConversation, matured.length);
  const state: QualityState =
    matured.length < HUNT_BETA_MIN_ARTISTS || ratePct === null
      ? "learning"
      : ratePct >= HUNT_BETA_CONVERSATION_TARGET_PCT
        ? "on_track"
        : "needs_work";
  return {
    cohortArtists: cohort.length,
    maturedArtists: matured.length,
    pendingArtists: cohort.length - matured.length,
    artistsWithConversation,
    ratePct,
    targetPct: HUNT_BETA_CONVERSATION_TARGET_PCT,
    minSample: HUNT_BETA_MIN_ARTISTS,
    state,
  };
}

export function summarizeHuntQuality(
  rows: HuntQualityRow[],
  now = new Date(),
  windowDays = HUNT_QUALITY_WINDOW_DAYS,
  betaBusinesses: HuntBetaBusinessRow[] = [],
): HuntQualitySummary {
  const since = new Date(now.getTime() - windowDays * 24 * 3600 * 1_000);
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
  const representedBusinesses = new Set<string>();
  let venuesFound = 0;
  const attemptedContacts = new Map<string, HuntQualityRow>();

  for (const venue of rows) {
    if (venue.contactLastAttemptAt && venue.contactLastAttemptAt >= since) {
      const key = `${venue.businessId}:${venue.id}`;
      const existing = attemptedContacts.get(key);
      if (
        !existing?.contactLastAttemptAt ||
        existing.contactLastAttemptAt < venue.contactLastAttemptAt
      ) {
        attemptedContacts.set(key, venue);
      }
    }
    const discoveredInWindow = venue.createdAt >= since;
    if (discoveredInWindow) {
      representedBusinesses.add(venue.businessId);
      venuesFound++;
    }

    const primaryPitches = venue.pitches.filter((pitch) => !pitch.followUpOfId);
    const ownerSkip =
      venue.reviewedAt &&
      venue.reviewedAt >= since &&
      venue.suppressedReason &&
      OWNER_SKIP_REASONS.has(venue.suppressedReason)
        ? (venue.suppressedReason as SkipReason)
        : null;
    // Opt-out handling may expire an already-approved unsent pitch. The venue
    // keeps the owner's reviewedAt timestamp, whereas a never-reviewed pending
    // pitch has none. Preserve that historical pursue decision without
    // misclassifying an automatically expired pending draft as an approval.
    const historicalExpiredApproval =
      !ownerSkip && venue.reviewedAt && venue.reviewedAt >= since
        ? primaryPitches.find((pitch) => pitch.status === "EXPIRED") ?? null
        : null;
    const positive =
      primaryPitches.some(
        (pitch) =>
          POSITIVE_PITCH_STATUSES.has(pitch.status) &&
          !!pitch.decidedAt &&
          pitch.decidedAt >= since,
      ) || !!historicalExpiredApproval;

    // A later opt-out/suppression must not rewrite an earlier explicit pursue
    // decision as a discovery miss. Positive wins if historical states overlap.
    if (positive) {
      representedBusinesses.add(venue.businessId);
      pursuedMatches++;
    } else if (ownerSkip) {
      representedBusinesses.add(venue.businessId);
      skippedMatches++;
      skipReasons[ownerSkip] = (skipReasons[ownerSkip] ?? 0) + 1;
      if (CLEAR_MISS_REASONS.has(ownerSkip)) clearMisses++;
    }

    for (const pitch of primaryPitches) {
      const isHistoricalExpiredApproval = pitch === historicalExpiredApproval;
      if (
        (!DECIDED_PITCH_STATUSES.has(pitch.status) && !isHistoricalExpiredApproval) ||
        (!isHistoricalExpiredApproval && (!pitch.decidedAt || pitch.decidedAt < since))
      ) {
        continue;
      }
      representedBusinesses.add(venue.businessId);
      // "Not a fit" settles the auto-draft as DISCARDED too, but that is a
      // lead-quality rejection, not a writing-quality vote. Only a standalone
      // "Discard draft" belongs in pitch-approval precision.
      if (pitch.status === "DISCARDED" && ownerSkip) continue;
      pitchDecisions++;
      if (POSITIVE_PITCH_STATUSES.has(pitch.status) || isHistoricalExpiredApproval) {
        pitchesApproved++;
        if (!pitch.editedSubject && !pitch.editedBody) untouchedApprovals++;
      } else {
        pitchesDiscarded++;
      }
    }

    const recentSentTimes = primaryPitches
      .map((pitch) => pitch.sentAt)
      .filter((sentAt): sentAt is Date => !!sentAt && sentAt >= since);
    if (recentSentTimes.length > 0) {
      const firstRecentSendAt = new Date(
        Math.min(...recentSentTimes.map((sentAt) => sentAt.getTime())),
      );
      representedBusinesses.add(venue.businessId);
      venuesPitched++;
      // A reply/booking predating the measured outreach is historical context,
      // not an outcome caused by this cohort's pitch.
      if (venue.repliedAt && venue.repliedAt >= firstRecentSendAt) venueReplies++;
      if (venue.bookedAt && venue.bookedAt >= firstRecentSendAt) venueBookings++;
    }
  }

  let publishedContacts = 0;
  let actionableContacts = 0;
  let genericContacts = 0;
  let suppressedContacts = 0;
  let foundDirect = 0;
  let foundGeneric = 0;
  let notFoundRetryable = 0;
  let notFoundExhausted = 0;
  let errors = 0;
  let inProgress = 0;
  let suppressed = 0;
  let unclassified = 0;
  for (const venue of attemptedContacts.values()) {
    representedBusinesses.add(venue.businessId);
    const actionable =
      venue.contactState !== "SUPPRESSED" &&
      contactConfidence(
        venue.bookingEmail,
        venue.bookingContactName,
        venue.contactState,
      ) === "high";
    // Inventory and attempt state are intentionally orthogonal. A retry may
    // leave an older published email on the row while its current state is
    // ERROR or IN_PROGRESS; that contact must not vanish from inventory.
    if (venue.bookingEmail) {
      publishedContacts++;
      if (venue.contactState === "SUPPRESSED") suppressedContacts++;
      else {
        if (actionable) actionableContacts++;
        else genericContacts++;
      }
    }

    // Every attempted venue contributes to exactly one latest-state bucket.
    if (venue.contactState === "FOUND_DIRECT") foundDirect++;
    else if (venue.contactState === "FOUND_GENERIC") foundGeneric++;
    else if (venue.contactState === "SUPPRESSED") suppressed++;
    else if (venue.contactState === "NOT_FOUND") {
      if (venue.contactExhaustedAt) notFoundExhausted++;
      else notFoundRetryable++;
    }
    else if (venue.contactState === "ERROR") errors++;
    else if (venue.contactState === "IN_PROGRESS") inProgress++;
    else unclassified++;
  }
  const contactFunnel: HuntContactFunnel = {
    attemptedVenues: attemptedContacts.size,
    inventory: {
      publishedContacts,
      actionableContacts,
      genericContacts,
      suppressedContacts,
    },
    latestAttemptOutcomes: {
      foundDirect,
      foundGeneric,
      notFoundRetryable,
      notFoundExhausted,
      errors,
      inProgress,
      suppressed,
      unclassified,
    },
    attemptCoverage: {
      numerator: attemptedContacts.size,
      denominator: null,
      ratePct: null,
      state: "unavailable",
      reason: "historical eligible/due cohort is not stored",
    },
  };

  const reviewedMatches = pursuedMatches + skippedMatches;
  const reviewCoverage: ReviewCoverage = {
    reviewed: reviewedMatches,
    required: HUNT_REVIEW_SAMPLE_REQUIRED,
    state: reviewedMatches >= HUNT_REVIEW_SAMPLE_REQUIRED ? "on_track" : "learning",
  };
  return {
    since,
    windowDays,
    tenantsRepresented: representedBusinesses.size,
    venuesFound,
    contactFunnel,
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
    reviewCoverage,
    betaConversation: summarizeBetaConversation(betaBusinesses, now),
    gates: {
      usefulMatch: gate(
        pursuedMatches,
        reviewedMatches,
        HUNT_QUALITY_TARGETS.usefulMatch,
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
  const cohortSince = new Date(
    now.getTime() - HUNT_BETA_COHORT_WINDOW_DAYS * 24 * 3600 * 1000,
  );
  const [rows, betaBusinesses] = await Promise.all([
    db.venue.findMany({
      where: {
        ...(opts.businessId ? { businessId: opts.businessId } : {}),
        OR: [
          { createdAt: { gte: since } },
          { contactLastAttemptAt: { gte: since } },
          { reviewedAt: { gte: since } },
          { repliedAt: { gte: since } },
          { bookedAt: { gte: since } },
          { pitches: { some: { decidedAt: { gte: since } } } },
          { pitches: { some: { sentAt: { gte: since } } } },
        ],
      },
      select: {
        id: true,
        businessId: true,
        createdAt: true,
        bookingEmail: true,
        bookingContactName: true,
        contactState: true,
        contactLastAttemptAt: true,
        contactExhaustedAt: true,
        suppressedReason: true,
        reviewedAt: true,
        repliedAt: true,
        bookedAt: true,
        status: true,
        pitches: {
          select: {
            status: true,
            editedSubject: true,
            editedBody: true,
            followUpOfId: true,
            decidedAt: true,
            sentAt: true,
          },
        },
      },
    }),
    db.business.findMany({
      where: {
        ...(opts.businessId ? { id: opts.businessId } : {}),
        betaStartedAt: { gte: cohortSince, lte: now },
      },
      select: {
        id: true,
        betaStartedAt: true,
        venues: {
          where: { repliedAt: { not: null } },
          select: {
            repliedAt: true,
            pitches: {
              where: { followUpOfId: null, sentAt: { not: null } },
              select: { sentAt: true },
            },
          },
        },
      },
    }),
  ]);
  return summarizeHuntQuality(rows, now, windowDays, betaBusinesses);
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
  const replyPct = pct(summary.venueReplies, summary.venuesPitched);
  const beta = summary.betaConversation;
  const contacts = summary.contactFunnel;
  const inventory = contacts.inventory;
  const outcomes = contacts.latestAttemptOutcomes;
  const publishedYield = pct(inventory.publishedContacts, contacts.attemptedVenues);
  const actionableYield = pct(inventory.actionableContacts, contacts.attemptedVenues);
  const betaState =
    beta.state === "learning"
      ? `LEARNING ${beta.maturedArtists}/${beta.minSample}`
      : beta.state === "on_track"
        ? "ON TRACK"
        : "NEEDS WORK";
  return [
    `HUNT QUALITY · rolling ${summary.windowDays}d · ${summary.tenantsRepresented} tenant${summary.tenantsRepresented === 1 ? "" : "s"}`,
    `• Useful matches: ${rateLabel(summary.gates.usefulMatch)} · ${stateLabel(summary.gates.usefulMatch)} · target ≥${summary.gates.usefulMatch.targetPct}%`,
    `• Contact inventory (descriptive, no verdict): ${inventory.publishedContacts}/${contacts.attemptedVenues} published${publishedYield === null ? "" : ` (${publishedYield}%)`} · ${inventory.actionableContacts}/${contacts.attemptedVenues} persisted actionable${actionableYield === null ? "" : ` (${actionableYield}%)`} · ${inventory.genericContacts} generic${inventory.suppressedContacts ? ` · ${inventory.suppressedContacts} suppressed` : ""}`,
    `• Latest attempt outcomes (mutually exclusive): ${outcomes.foundDirect} direct · ${outcomes.foundGeneric} generic · ${outcomes.notFoundRetryable} not found yet · ${outcomes.notFoundExhausted} not found exhausted · ${outcomes.errors} error · ${outcomes.inProgress} in progress · ${outcomes.suppressed} suppressed${outcomes.unclassified ? ` · ${outcomes.unclassified} unclassified` : ""}`,
    `• Attempt coverage: unavailable · ${contacts.attemptCoverage.reason}`,
    `• Review sample: ${summary.reviewCoverage.reviewed}/${summary.reviewCoverage.required} reviewed decisions · ${summary.reviewCoverage.state === "on_track" ? "ON TRACK" : "LEARNING"}`,
    `• Pitch approval: ${rateLabel(summary.gates.pitchApproval)} · ${stateLabel(summary.gates.pitchApproval)} · target ≥${summary.gates.pitchApproval.targetPct}%`,
    `• Clear discovery misses: ${rateLabel(summary.gates.clearMiss)} · ${stateLabel(summary.gates.clearMiss)} · guardrail ≤${summary.gates.clearMiss.targetPct}%`,
    `• Outcomes: ${summary.venuesPitched} pitched · ${summary.venueReplies} replied${replyPct === null ? "" : ` (${replyPct}%)`} · ${summary.venueBookings} booked`,
    `• 14-day beta conversations: ${beta.ratePct === null ? "—" : `${beta.ratePct}% (${beta.artistsWithConversation}/${beta.maturedArtists})`} · ${betaState} · target ≥${beta.targetPct}%${beta.pendingArtists ? ` · ${beta.pendingArtists} still inside day 14` : ""}`,
  ].join("\n");
}

export function huntQualityNeedsAttention(summary: HuntQualitySummary): boolean {
  return (
    summary.gates.usefulMatch.state === "needs_work" ||
    summary.gates.pitchApproval.state === "needs_work" ||
    summary.gates.clearMiss.state === "needs_work" ||
    summary.betaConversation.state === "needs_work"
  );
}
