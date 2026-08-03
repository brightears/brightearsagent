import { describe, expect, it } from "vitest";
import {
  huntQualityNeedsAttention,
  renderHuntQualityText,
  summarizeHuntQuality,
  type HuntQualityRow,
} from "@/lib/reports/hunt-quality";

const pitch = (
  status: string,
  overrides: Partial<HuntQualityRow["pitches"][number]> = {},
): HuntQualityRow["pitches"][number] => ({
  status,
  editedSubject: null,
  editedBody: null,
  followUpOfId: null,
  sentAt: null,
  ...overrides,
});

const venue = (overrides: Partial<HuntQualityRow> = {}): HuntQualityRow => ({
  businessId: "biz1",
  bookingEmail: null,
  bookingContactName: null,
  suppressedReason: null,
  repliedAt: null,
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
        pitches: [pitch("APPROVED")],
      }),
      venue({
        bookingEmail: "hello@bar.example",
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
    ]);

    expect(summary).toMatchObject({
      venuesFound: 6,
      directContacts: 2,
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
        repliedAt: new Date(),
        pitches: [
          pitch("SENT", { sentAt: new Date() }),
          pitch("SENT", { followUpOfId: "first", sentAt: new Date() }),
        ],
      }),
    ]);

    expect(summary.pursuedMatches).toBe(1);
    expect(summary.skippedMatches).toBe(0);
    expect(summary.venuesPitched).toBe(1);
    expect(summary.venueReplies).toBe(1);
    expect(summary.pitchDecisions).toBe(1);
  });

  it("moves from learning to on-track or needs-work only at the sample floor", () => {
    const good = Array.from({ length: 20 }, (_, index) =>
      index < 14
        ? venue({ pitches: [pitch("APPROVED")], bookingEmail: `events${index}@room.example` })
        : venue({ suppressedReason: "NOT_INTERESTED", status: "SUPPRESSED" }),
    );
    const onTrack = summarizeHuntQuality(good);
    expect(onTrack.gates.usefulMatch).toMatchObject({ ratePct: 70, state: "on_track" });
    expect(onTrack.gates.directContact).toMatchObject({ ratePct: 70, state: "on_track" });
    expect(onTrack.gates.pitchApproval.state).toBe("on_track");
    expect(huntQualityNeedsAttention(onTrack)).toBe(false);

    const bad = summarizeHuntQuality(
      Array.from({ length: 20 }, (_, index) =>
        index < 10
          ? venue({ pitches: [pitch("APPROVED")] })
          : venue({ suppressedReason: "NO_ENTERTAINMENT", status: "SUPPRESSED" }),
      ),
    );
    expect(bad.gates.usefulMatch.state).toBe("needs_work");
    expect(bad.gates.clearMiss.state).toBe("needs_work");
    expect(huntQualityNeedsAttention(bad)).toBe(true);
  });

  it("renders sample sizes and avoids inventing zero-percent rates", () => {
    const text = renderHuntQualityText(summarizeHuntQuality([]));
    expect(text).toContain("Useful matches: —");
    expect(text).toContain("LEARNING 0/20");
    expect(text).toContain("0 pitched · 0 replied");
  });
});
