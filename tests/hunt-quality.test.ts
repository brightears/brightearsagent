import { describe, expect, it } from "vitest";
import {
  huntQualityNeedsAttention,
  renderHuntQualityText,
  summarizeBetaConversation,
  summarizeHuntQuality,
  type HuntQualityRow,
} from "@/lib/reports/hunt-quality";

const NOW = new Date("2026-08-16T00:00:00.000Z");
const RECENT = new Date("2026-08-10T00:00:00.000Z");
let venueSequence = 0;

const pitch = (
  status: string,
  overrides: Partial<HuntQualityRow["pitches"][number]> = {},
): HuntQualityRow["pitches"][number] => ({
  status,
  editedSubject: null,
  editedBody: null,
  followUpOfId: null,
  decidedAt: RECENT,
  sentAt: null,
  ...overrides,
});

const venue = (overrides: Partial<HuntQualityRow> = {}): HuntQualityRow => ({
  id: `venue-${++venueSequence}`,
  businessId: "biz1",
  createdAt: RECENT,
  bookingEmail: null,
  bookingContactName: null,
  contactState: null,
  contactLastAttemptAt: null,
  contactExhaustedAt: null,
  suppressedReason: null,
  reviewedAt: overrides.suppressedReason ? RECENT : null,
  repliedAt: null,
  bookedAt: null,
  status: "DISCOVERED",
  pitches: [],
  ...overrides,
});

describe("summarizeHuntQuality", () => {
  it("separates unreviewed cards, pursued matches, owner skips and pitch quality", () => {
    const summary = summarizeHuntQuality([
      venue(), // unreviewed — must not dilute useful-match precision
      venue({
        bookingEmail: "events@room.example",
        contactLastAttemptAt: RECENT,
        contactState: "FOUND_DIRECT",
        pitches: [pitch("APPROVED")],
      }),
      venue({
        bookingEmail: "hello@bar.example",
        contactLastAttemptAt: RECENT,
        contactState: "FOUND_GENERIC",
        pitches: [pitch("DISCARDED", { editedBody: "Tried another angle" })],
      }),
      venue({ suppressedReason: "WRONG_VIBE", status: "SUPPRESSED" }),
      venue({
        suppressedReason: "STALE_OR_CLOSED",
        status: "SUPPRESSED",
        pitches: [pitch("DISCARDED")],
      }),
      venue({
        suppressedReason: "unsubscribe", // compliance suppression, not artist feedback
        status: "SUPPRESSED",
      }),
    ], NOW);

    expect(summary).toMatchObject({
      venuesFound: 6,
      contactFunnel: {
        inventory: {
          publishedContacts: 2,
          actionableContacts: 1,
          genericContacts: 1,
        },
      },
      reviewedMatches: 3,
      pursuedMatches: 1,
      skippedMatches: 2,
      clearMisses: 1,
      pitchDecisions: 2,
      pitchesApproved: 1,
      pitchesDiscarded: 1,
      untouchedApprovals: 1,
    });
    expect(summary.gates.usefulMatch.ratePct).toBe(33);
    expect(summary.gates.pitchApproval.ratePct).toBe(50);
    expect(summary.gates.usefulMatch.state).toBe("learning");
  });

  it("counts one venue once when it has an approved pitch plus later history", () => {
    const summary = summarizeHuntQuality([
      venue({
        suppressedReason: "NOT_INTERESTED",
        status: "SUPPRESSED",
        repliedAt: RECENT,
        pitches: [
          pitch("SENT", { sentAt: RECENT }),
          pitch("SENT", { followUpOfId: "first", sentAt: RECENT }),
        ],
      }),
    ], NOW);

    expect(summary.pursuedMatches).toBe(1);
    expect(summary.skippedMatches).toBe(0);
    expect(summary.venuesPitched).toBe(1);
    expect(summary.venueReplies).toBe(1);
    expect(summary.pitchDecisions).toBe(1);
  });

  it("counts FOUND_DIRECT venue-bound addresses as actionable contacts", () => {
    const summary = summarizeHuntQuality(
      [
        venue({
          bookingEmail: "baryard.kimptonmaalai@ihg.com",
          contactState: "FOUND_DIRECT",
          contactLastAttemptAt: RECENT,
        }),
        venue({
          bookingEmail: "events@publisher.example",
          contactState: "FOUND_GENERIC",
          contactLastAttemptAt: RECENT,
        }),
      ],
      NOW,
    );

    expect(summary.contactFunnel).toMatchObject({
      attemptedVenues: 2,
      inventory: {
        publishedContacts: 2,
        actionableContacts: 1,
        genericContacts: 1,
      },
      latestAttemptOutcomes: {
        foundDirect: 1,
        foundGeneric: 1,
      },
    });
  });

  it("reconciles the 25-venue live sample against persisted outcomes", () => {
    const oldCreatedAt = new Date("2026-06-12T00:00:00.000Z");
    const direct = Array.from({ length: 3 }, (_, index) =>
      venue({
        id: `live-direct-${index}`,
        createdAt: oldCreatedAt,
        bookingEmail: `venue${index}@published.example`,
        contactState: "FOUND_DIRECT",
        contactLastAttemptAt: RECENT,
      }),
    );
    const generic = Array.from({ length: 4 }, (_, index) =>
      venue({
        id: `live-generic-${index}`,
        createdAt: oldCreatedAt,
        bookingEmail: `info${index}@published.example`,
        contactState: "FOUND_GENERIC",
        contactLastAttemptAt: RECENT,
      }),
    );
    const notFound = Array.from({ length: 18 }, (_, index) =>
      venue({
        id: `live-miss-${index}`,
        createdAt: oldCreatedAt,
        contactState: "NOT_FOUND",
        contactLastAttemptAt: RECENT,
      }),
    );

    const summary = summarizeHuntQuality([...direct, ...generic, ...notFound], NOW);

    expect(summary.venuesFound).toBe(0);
    expect(summary.contactFunnel).toMatchObject({
      attemptedVenues: 25,
      inventory: {
        publishedContacts: 7,
        actionableContacts: 3,
        genericContacts: 4,
      },
      latestAttemptOutcomes: {
        foundDirect: 3,
        foundGeneric: 4,
        notFoundRetryable: 18,
        notFoundExhausted: 0,
        errors: 0,
        inProgress: 0,
      },
      attemptCoverage: {
        denominator: null,
        ratePct: null,
        state: "unavailable",
      },
    });
    expect(huntQualityNeedsAttention(summary)).toBe(false);
    const text = renderHuntQualityText(summary);
    expect(text).toContain("7/25 published (28%)");
    expect(text).toContain("3/25 persisted actionable (12%)");
    expect(text).toContain("descriptive, no verdict");
    expect(text).not.toContain("100% (3/3)");
    expect(text).not.toContain("60%");
  });

  it("counts an attempted tenant venue once and keeps every persisted outcome visible", () => {
    const direct = venue({
      id: "same-id",
      bookingEmail: "events@room.example",
      contactState: "FOUND_DIRECT",
      contactLastAttemptAt: RECENT,
    });
    const summary = summarizeHuntQuality(
      [
        direct,
        { ...direct },
        { ...direct, businessId: "biz2" },
        venue({
          bookingEmail: "events@stale-error.example",
          contactState: "ERROR",
          contactLastAttemptAt: RECENT,
        }),
        venue({
          bookingEmail: "bookings@stale-progress.example",
          contactState: "IN_PROGRESS",
          contactLastAttemptAt: RECENT,
        }),
        venue({
          bookingEmail: "events@suppressed.example",
          contactState: "SUPPRESSED",
          contactLastAttemptAt: RECENT,
        }),
        venue({ contactState: "NOT_FOUND", contactLastAttemptAt: RECENT }),
        venue({
          contactState: "NOT_FOUND",
          contactLastAttemptAt: RECENT,
          contactExhaustedAt: RECENT,
        }),
        venue({ contactState: null, contactLastAttemptAt: RECENT }),
      ],
      NOW,
    );

    expect(summary.contactFunnel).toMatchObject({
      attemptedVenues: 8,
      inventory: {
        publishedContacts: 5,
        actionableContacts: 2,
        genericContacts: 2,
        suppressedContacts: 1,
      },
      latestAttemptOutcomes: {
        foundDirect: 2,
        foundGeneric: 0,
        notFoundRetryable: 1,
        notFoundExhausted: 1,
        errors: 1,
        inProgress: 1,
        suppressed: 1,
        unclassified: 1,
      },
    });
    const outcomes = summary.contactFunnel.latestAttemptOutcomes;
    expect(
      outcomes.foundDirect +
        outcomes.foundGeneric +
        outcomes.notFoundRetryable +
        outcomes.notFoundExhausted +
        outcomes.errors +
        outcomes.inProgress +
        outcomes.suppressed +
        outcomes.unclassified,
    ).toBe(summary.contactFunnel.attemptedVenues);
    const inventory = summary.contactFunnel.inventory;
    expect(inventory.publishedContacts).toBe(
      inventory.actionableContacts +
        inventory.genericContacts +
        inventory.suppressedContacts,
    );
  });

  it("preserves an approved decision after a later opt-out expires the unsent pitch", () => {
    const summary = summarizeHuntQuality(
      [
        venue({
          reviewedAt: RECENT,
          suppressedReason: "unsubscribe",
          status: "SUPPRESSED",
          pitches: [
            pitch("EXPIRED", {
              // Opt-out handling can replace this timestamp; reviewedAt is the
              // durable owner-decision clock used by the summary.
              decidedAt: new Date("2026-08-12"),
            }),
          ],
        }),
      ],
      NOW,
    );

    expect(summary.pursuedMatches).toBe(1);
    expect(summary.pitchesApproved).toBe(1);
    expect(summary.skippedMatches).toBe(0);
  });

  it("moves from learning to on-track or needs-work only at the sample floor", () => {
    const good = Array.from({ length: 20 }, (_, index) =>
      index < 14
        ? venue({ pitches: [pitch("APPROVED")], bookingEmail: `events${index}@room.example` })
        : venue({ suppressedReason: "NOT_INTERESTED", status: "SUPPRESSED" }),
    );
    const onTrack = summarizeHuntQuality(good, NOW);
    expect(onTrack.gates.usefulMatch).toMatchObject({ ratePct: 70, state: "on_track" });
    expect(onTrack.gates.pitchApproval.state).toBe("on_track");
    expect(huntQualityNeedsAttention(onTrack)).toBe(false);

    const bad = summarizeHuntQuality(
      Array.from({ length: 20 }, (_, index) =>
        index < 10
          ? venue({ pitches: [pitch("APPROVED")] })
          : venue({ suppressedReason: "NO_ENTERTAINMENT", status: "SUPPRESSED" }),
      ),
      NOW,
    );
    expect(bad.gates.usefulMatch.state).toBe("needs_work");
    expect(bad.gates.clearMiss.state).toBe("needs_work");
    expect(huntQualityNeedsAttention(bad)).toBe(true);
  });

  it("keeps contact yield descriptive even with a large attempted sample", () => {
    const misses = Array.from({ length: 100 }, (_, index) =>
      venue({
        id: `attempted-miss-${index}`,
        contactState: "NOT_FOUND",
        contactLastAttemptAt: RECENT,
      }),
    );
    const summary = summarizeHuntQuality(misses, NOW);
    expect(summary.contactFunnel).toMatchObject({
      attemptedVenues: 100,
      inventory: {
        publishedContacts: 0,
        actionableContacts: 0,
      },
      latestAttemptOutcomes: {
        notFoundRetryable: 100,
        notFoundExhausted: 0,
      },
    });
    expect(huntQualityNeedsAttention(summary)).toBe(false);
    expect(renderHuntQualityText(summary)).toContain(
      "Contact inventory (descriptive, no verdict): 0/100 published (0%)",
    );
  });

  it("renders sample sizes and avoids inventing zero-percent rates", () => {
    const text = renderHuntQualityText(summarizeHuntQuality([], NOW));
    expect(text).toContain("Useful matches: —");
    expect(text).toContain("LEARNING 0/20");
    expect(text).toContain("0 pitched · 0 replied");
    expect(text).toContain("reviewed decisions");
    expect(text).toContain("Contact inventory (descriptive, no verdict): 0/0 published");
    expect(text).toContain("Attempt coverage: unavailable");
    expect(text).not.toContain("60%");
    expect(text).not.toContain("consecutive decisions");
  });

  it("counts a recent owner decision on an older venue without inflating venues found", () => {
    const summary = summarizeHuntQuality(
      [
        venue({
          createdAt: new Date("2026-01-01"),
          reviewedAt: RECENT,
          suppressedReason: "WRONG_VIBE",
          status: "SUPPRESSED",
        }),
      ],
      NOW,
    );

    expect(summary.venuesFound).toBe(0);
    expect(summary.reviewedMatches).toBe(1);
    expect(summary.skippedMatches).toBe(1);
  });

  it("does not attribute a historical reply to a newer measured pitch", () => {
    const summary = summarizeHuntQuality(
      [
        venue({
          repliedAt: new Date("2026-08-01T00:00:00.000Z"),
          bookedAt: new Date("2026-08-02T00:00:00.000Z"),
          pitches: [pitch("SENT", { sentAt: RECENT })],
        }),
      ],
      NOW,
    );

    expect(summary.venuesPitched).toBe(1);
    expect(summary.venueReplies).toBe(0);
    expect(summary.venueBookings).toBe(0);
  });
});

describe("summarizeBetaConversation", () => {
  it("measures only conversations inside each artist's first 14 days", () => {
    const businesses = Array.from({ length: 10 }, (_, index) => {
      const betaStartedAt = new Date("2026-07-20T00:00:00.000Z");
      return {
        id: `biz${index}`,
        betaStartedAt,
        venues:
          index < 3
            ? [
                {
                  repliedAt: new Date("2026-07-25T00:00:00.000Z"),
                  pitches: [{ sentAt: new Date("2026-07-22T00:00:00.000Z") }],
                },
              ]
            : index === 3
              ? [
                  {
                    repliedAt: new Date("2026-08-10T00:00:00.000Z"),
                    pitches: [{ sentAt: new Date("2026-07-22T00:00:00.000Z") }],
                  },
                ]
              : [],
      };
    });

    expect(summarizeBetaConversation(businesses, NOW)).toMatchObject({
      cohortArtists: 10,
      maturedArtists: 10,
      artistsWithConversation: 3,
      ratePct: 30,
      state: "on_track",
    });
  });

  it("keeps artists inside day 14 pending instead of counting them as failures", () => {
    const summary = summarizeBetaConversation(
      [{ id: "new", betaStartedAt: new Date("2026-08-10"), venues: [] }],
      NOW,
    );
    expect(summary).toMatchObject({
      maturedArtists: 0,
      pendingArtists: 1,
      ratePct: null,
      state: "learning",
    });
  });

  it("does not credit a historical reply without a cohort pitch sent first", () => {
    const summary = summarizeBetaConversation(
      [
        {
          id: "historical",
          betaStartedAt: new Date("2026-07-20"),
          venues: [
            {
              repliedAt: new Date("2026-07-25"),
              pitches: [],
            },
          ],
        },
      ],
      NOW,
    );
    expect(summary.artistsWithConversation).toBe(0);
  });
});
