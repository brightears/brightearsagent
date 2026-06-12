// Timing classifier (Phase 10.2c, ADR-004): 0-100 likelihood of a SHORT-TERM
// booking. PURE and deterministic — no DB, no LLM, no clock: `now` is a
// parameter so tests are deterministic. The LLM classifies temperature (a
// judgment over evidence); timing is computed HERE, never asked of the model —
// a probability invented by a flash model is noise, a rule over dated signals
// is auditable.
//
// FIT (lib/venues/score.ts) and TIMING stay separate by design: fitScore says
// "this room suits the act", timingScore says "they're likely to decide soon".
// The card shows both: "92 fit · 35% short-term".

import type { ScorableSignal } from "@/lib/venues/score";

export type VenueTemperature = "HOT" | "WARM" | "SEED";

export type TimingInput = {
  temperature: VenueTemperature;
  /** All known signals (type + observedAt) — freshness drives the HOT band. */
  signals: ScorableSignal[];
  /** Grounded facts proving the venue buys entertainment (10.2c). */
  entertainmentEvidence: string[];
};

// Bands (founder-approved): HOT 60-90 by signal freshness · WARM 20-40
// (+5 event-calendar evidence, +5 hiring) · SEED 5-15.
export const TIMING_BANDS: Record<VenueTemperature, { min: number; max: number }> = {
  HOT: { min: 60, max: 90 },
  WARM: { min: 20, max: 40 },
  SEED: { min: 5, max: 15 },
};

const DAY_MS = 24 * 3600 * 1000;

/** Opening signals = the "deciding now" clock; the rest don't reset it. */
const OPENING_SIGNALS = new Set(["NEW_OPENING", "OPENING_SOON"]);

/** Event-calendar evidence: a published program means recurring slots to fill. */
const CALENDAR_RE = /what'?s on|event (calendar|page|program|listings)|events (page|calendar|program)|weekly|every (friday|saturday|sunday|monday|tuesday|wednesday|thursday|week(end)?)|residenc|line-?up/i;

/**
 * 1.0 inside 14 days, linear decay to 0 at 90 days (same window discipline as
 * score.ts signalFreshness, duplicated deliberately: timing must not inherit
 * fit-scoring tweaks).
 */
function freshness(observedAt: Date, now: Date): number {
  const ageDays = (now.getTime() - observedAt.getTime()) / DAY_MS;
  if (ageDays <= 14) return 1; // includes future-dated ("opens next month")
  if (ageDays >= 90) return 0;
  return (90 - ageDays) / (90 - 14);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * The deterministic timing score:
 *  - HOT: 60 + 30 × freshness of the freshest OPENING signal (any other
 *    signal counts at half heat) → a venue that opened this week scores 90,
 *    one fading toward the 90-day horizon scores 60.
 *  - WARM: base 30; +5 when the evidence/signals show a published event
 *    calendar (recurring slots), +5 when also hiring (activity); floor 20.
 *    A WARM venue with no calendar and no hiring sits at 30 — they buy
 *    entertainment, but nothing says a slot opens this month.
 *  - SEED: base 10; +5 when a named events contact exists (TEAM_CONTACT —
 *    a person to plant the relationship with); 5 when there's no evidence at
 *    all (pure cold file entry).
 */
export function computeTimingScore(input: TimingInput, now: Date): number {
  const band = TIMING_BANDS[input.temperature];

  if (input.temperature === "HOT") {
    let best = 0;
    for (const s of input.signals) {
      const weight = OPENING_SIGNALS.has(s.type) ? 1 : 0.5;
      best = Math.max(best, weight * freshness(s.observedAt, now));
    }
    return clamp(Math.round(band.min + (band.max - band.min) * best), band.min, band.max);
  }

  if (input.temperature === "WARM") {
    let score = 30;
    const evidenceText = input.entertainmentEvidence.join(" · ");
    const hasCalendar =
      input.signals.some((s) => s.type === "EVENT_PROGRAM") || CALENDAR_RE.test(evidenceText);
    const hasHiring = input.signals.some((s) => s.type === "HIRING");
    if (hasCalendar) score += 5;
    if (hasHiring) score += 5;
    return clamp(score, band.min, band.max);
  }

  // SEED
  const hasAnything = input.signals.length > 0 || input.entertainmentEvidence.length > 0;
  if (!hasAnything) return band.min;
  const hasContact = input.signals.some((s) => s.type === "TEAM_CONTACT");
  return clamp(10 + (hasContact ? 5 : 0), band.min, band.max);
}
