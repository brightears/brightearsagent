// Pure helpers for the venue-opportunity feed (Phase 10.4, ADR-004).
// Shared by the dashboard Hunt section and app/actions/venues.ts — kept out
// of the "use server" actions file (which may only export async functions).
// PURE: no DB, no clock — `now` is a parameter so tests are deterministic.

import type { VenueStatus } from "@/app/generated/prisma/enums";

/**
 * The post-send "In play" tracking surface (audit C2). gmail.send is send-only,
 * so a PITCHED venue has no automated reply capture — the owner tracks it by
 * hand here. These are the statuses a sent venue can be in (PITCHED onward,
 * minus SUPPRESSED, which is the skip/never-contact bucket).
 */
export const IN_PLAY_STATUSES = [
  "PITCHED",
  "REPLIED",
  "IN_CONVERSATION",
  "BOOKED",
  "DEAD",
] as const satisfies readonly VenueStatus[];

export type InPlayStatus = (typeof IN_PLAY_STATUSES)[number];

/**
 * Statuses the owner may manually set on an in-play venue. PITCHED is omitted:
 * it's the system-set "we sent it" state, not something you move a venue back
 * to by hand. The owner advances it as the conversation goes.
 */
export const IN_PLAY_TARGET_STATUSES = [
  "REPLIED",
  "IN_CONVERSATION",
  "BOOKED",
  "DEAD",
] as const satisfies readonly VenueStatus[];

export type InPlayTargetStatus = (typeof IN_PLAY_TARGET_STATUSES)[number];

export function isInPlayStatus(value: string): value is InPlayStatus {
  return (IN_PLAY_STATUSES as readonly string[]).includes(value);
}

export function isInPlayTargetStatus(value: string): value is InPlayTargetStatus {
  return (IN_PLAY_TARGET_STATUSES as readonly string[]).includes(value);
}

/**
 * The one-tap skip reasons (ROADMAP 10.4: "Skip asks why → tunes matching").
 * Keys are what we persist in Venue.suppressedReason (machine-readable for the
 * future matching-tuner); labels are what the owner taps.
 */
export const SKIP_REASONS = {
  WRONG_VIBE: "Wrong vibe",
  TOO_FAR: "Too far",
  BELOW_FEE: "Below my fee",
  NOT_INTERESTED: "Not interested",
} as const;

export type SkipReason = keyof typeof SKIP_REASONS;

/**
 * Temperature chip per card (10.2c) — mono, no emoji (v2.1 LAW). Interface
 * voice only: HOT is the one solid-cyan moment (deciding now); WARM/SEED are
 * cream — temperature is timing data, never the show gradient. The label says
 * the truth plainly: a WARM venue "books entertainment", it is NOT looking.
 */
export const TEMPERATURE_CHIP = {
  HOT: { label: "HOT — deciding now", className: "bg-brand-cyan text-ink-stage" },
  WARM: { label: "WARM — books entertainment", className: "bg-cream text-ink-stage" },
  SEED: { label: "INTRO — for their file", className: "bg-cream/40 text-ink-stage/70" },
} as const;

export type FeedTemperature = keyof typeof TEMPERATURE_CHIP;

export function isSkipReason(value: string): value is SkipReason {
  return value in SKIP_REASONS;
}

/**
 * 3-step fit-score temperature for the feed card chip — interface voice
 * (cyan/cream), never the show gradient (DESIGN.md: scores are data, not
 * celebration). ≥70 hot · 40-69 warm · <40 cool.
 */
export type FitTone = "hot" | "warm" | "cool";

export function fitScoreTone(fitScore: number): FitTone {
  if (fitScore >= 70) return "hot";
  if (fitScore >= 40) return "warm";
  return "cool";
}

const DAY_MS = 24 * 3600 * 1000;

/** Freshness line for the feed card: "today" / "yesterday" / "8 days ago". */
export function signalAgeLabel(lastSignalAt: Date, now: Date): string {
  const days = Math.floor((now.getTime() - lastSignalAt.getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
