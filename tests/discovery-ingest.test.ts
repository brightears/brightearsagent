import { describe, expect, it } from "vitest";
import { planIngest, type ExistingVenue, type IngestContext, type PlannedCreate } from "@/lib/discovery/ingest";
import { StubDiscoveryProvider, type Metro, type RawSignal } from "@/lib/discovery/provider";

const NOW = new Date("2026-06-12T12:00:00Z");
const MANCHESTER: Metro = { city: "Manchester", country: "GB" };

const ctx = (over: Partial<IngestContext> = {}): IngestContext => ({
  existingVenues: [],
  suppressedEmails: [],
  profile: {
    genres: ["house", "open format"],
    eventTypes: ["weddings", "corporate"],
    serviceCities: ["Manchester"],
  },
  now: NOW,
  ...over,
});

/** Turn a planned create into the ExistingVenue the DB would now hold. */
const asExisting = (c: PlannedCreate, id: string): ExistingVenue => ({
  id,
  name: c.name,
  city: c.city,
  country: c.country,
  kind: c.kind,
  status: "DISCOVERED",
  website: c.website,
  instagram: c.instagram,
  bookingEmail: c.bookingEmail,
  bookingContactName: c.bookingContactName,
  contactSource: c.contactSource,
  signals: c.signals.map((s) => ({ type: s.type, sourceUrl: s.sourceUrl, observedAt: s.observedAt })),
});

async function stubBatch(metro: Metro): Promise<RawSignal[]> {
  return new StubDiscoveryProvider().searchVenueSignals(metro, { now: NOW });
}

describe("planIngest", () => {
  it("creates one venue per (name, city) with scored fields and merged signals", async () => {
    const raw = await stubBatch(MANCHESTER);
    const plan = planIngest(ctx(), MANCHESTER, raw);

    expect(plan.creates).toHaveLength(3); // The Nest (2 signals merged), Lucky Ramen, Freight Island
    expect(plan.updates).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);

    const nest = plan.creates.find((c) => c.name === "The Nest")!;
    expect(nest.signals).toHaveLength(2);
    expect(nest.bookingEmail).toBe("events@thenest-manchester.example");
    expect(nest.score.fitScore).toBeGreaterThan(80);
    expect(nest.score.fitReasons.length).toBeLessThanOrEqual(3);
  });

  it("is idempotent — the same batch twice produces no ops", async () => {
    const raw = await stubBatch(MANCHESTER);
    const first = planIngest(ctx(), MANCHESTER, raw);
    const existing = first.creates.map((c, i) => asExisting(c, `v${i}`));

    const second = planIngest(ctx({ existingVenues: existing }), MANCHESTER, raw);
    expect(second.creates).toHaveLength(0);
    expect(second.updates).toHaveLength(0);
  });

  it("dedups exact sourceUrl repeats inside one batch", async () => {
    const raw = await stubBatch(MANCHESTER);
    const plan = planIngest(ctx(), MANCHESTER, [...raw, ...raw]);
    const nest = plan.creates.find((c) => c.name === "The Nest")!;
    expect(nest.signals).toHaveLength(2);
  });

  it("appends only NEW sourceUrls to an existing venue and re-scores", async () => {
    const raw = await stubBatch(MANCHESTER);
    const first = planIngest(ctx(), MANCHESTER, raw);
    const existing = first.creates.map((c, i) => asExisting(c, `v${i}`));

    const freshPress: RawSignal = {
      venueName: "the nest", // case-insensitive identity
      kindGuess: "ROOFTOP",
      type: "PRESS",
      summary: "Named best new rooftop by Time Out",
      sourceUrl: "https://timeout.example/best-new-rooftops",
      observedAt: NOW,
    };
    const plan = planIngest(ctx({ existingVenues: existing }), MANCHESTER, [...raw, freshPress]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].newSignals).toHaveLength(1);
    expect(plan.updates[0].newSignals[0].sourceUrl).toBe(freshPress.sourceUrl);
    expect(plan.updates[0].score.fitScore).toBeGreaterThan(0);
    expect(plan.updates[0].score.lastSignalAt).toEqual(NOW);
  });

  it("never resurrects a SUPPRESSED venue", async () => {
    const raw = await stubBatch(MANCHESTER);
    const first = planIngest(ctx(), MANCHESTER, raw);
    const existing = first.creates.map((c, i) => asExisting(c, `v${i}`));
    const nest = existing.find((v) => v.name === "The Nest")!;
    nest.status = "SUPPRESSED";
    nest.signals = []; // even with everything "new", it must stay dead

    const plan = planIngest(ctx({ existingVenues: existing }), MANCHESTER, raw);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toHaveLength(0);
    expect(plan.skipped).toEqual([
      { venueName: "The Nest", city: "Manchester", reason: "venue is SUPPRESSED — never resurrected" },
    ]);
  });

  it("never creates a venue whose bookingEmail is suppressed (case-insensitive)", async () => {
    const raw = await stubBatch(MANCHESTER);
    const plan = planIngest(
      ctx({ suppressedEmails: ["EVENTS@thenest-manchester.example"] }),
      MANCHESTER,
      raw,
    );
    expect(plan.creates.map((c) => c.name)).not.toContain("The Nest");
    expect(plan.skipped.some((s) => s.venueName === "The Nest" && s.reason.includes("suppression"))).toBe(true);
  });

  it("never enriches an existing venue with a suppressed email", async () => {
    const existing: ExistingVenue = {
      id: "v1",
      name: "Glow Bar",
      city: "Manchester",
      country: "GB",
      kind: "BAR",
      status: "DISCOVERED",
      website: null,
      instagram: null,
      bookingEmail: null,
      bookingContactName: null,
      contactSource: null,
      signals: [],
    };
    const incoming: RawSignal = {
      venueName: "Glow Bar",
      kindGuess: "BAR",
      type: "PRESS",
      summary: "Glow Bar profiled",
      sourceUrl: "https://press.example/glow-bar",
      observedAt: NOW,
      bookingEmail: "Manager@GlowBar.example",
    };
    const plan = planIngest(
      ctx({ existingVenues: [existing], suppressedEmails: ["manager@glowbar.example"] }),
      MANCHESTER,
      [incoming],
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].enrich.bookingEmail).toBeUndefined();
    expect(plan.updates[0].newSignals).toHaveLength(1); // signal still lands
  });

  it("lowercases booking emails on create", async () => {
    const incoming: RawSignal = {
      venueName: "Caps Bar",
      kindGuess: "BAR",
      type: "MANUAL",
      summary: "Owner added",
      sourceUrl: "manual://caps-bar",
      bookingEmail: "Bookings@CapsBar.Example",
    };
    const plan = planIngest(ctx(), MANCHESTER, [incoming]);
    expect(plan.creates[0].bookingEmail).toBe("bookings@capsbar.example");
  });

  it("defaults observedAt to now when the source has no date", () => {
    const incoming: RawSignal = {
      venueName: "No Date Bar",
      kindGuess: "BAR",
      type: "NEW_SOCIAL",
      summary: "New account",
      sourceUrl: "https://social.example/nodatebar",
    };
    const plan = planIngest(ctx(), MANCHESTER, [incoming]);
    expect(plan.creates[0].signals[0].observedAt).toEqual(NOW);
  });
});

describe("StubDiscoveryProvider", () => {
  it("returns fixtures for known metros and [] otherwise", async () => {
    const provider = new StubDiscoveryProvider();
    expect(await provider.searchVenueSignals(MANCHESTER, { now: NOW })).not.toHaveLength(0);
    expect(
      await provider.searchVenueSignals({ city: "Nashville", country: "US" }, { now: NOW }),
    ).not.toHaveLength(0);
    expect(await provider.searchVenueSignals({ city: "Reykjavik", country: "IS" }, { now: NOW })).toEqual([]);
  });
});
