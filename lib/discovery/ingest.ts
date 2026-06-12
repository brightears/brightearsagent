// Signal ingest (Phase 10.2): raw provider signals → Venue/VenueSignal rows.
//
// Split in two so the interesting logic is unit-testable without a DB:
//   planIngest(ctx, metro, raw)  — PURE planner: dedup, suppression, scoring
//   ingestSignals(businessId, …) — thin executor: loads ctx, applies the plan
//
// Invariants the planner enforces:
//   * (businessId, name, city) is the venue identity — same batch twice = no-op
//   * per-venue sourceUrl dedup — a signal URL is appended at most once
//   * SUPPRESSED venues are never resurrected (no signals, no rescore)
//   * a venue is never CREATED around a suppressed bookingEmail, and a
//     suppressed email is never written onto an existing venue

import { db } from "@/lib/db";
import {
  scoreVenue,
  type MatchProfile,
  type ScorableSignal,
  type SignalType,
  type VenueKind,
} from "@/lib/venues/score";
import type { Metro, RawSignal } from "@/lib/discovery/provider";

export type PlannedSignal = {
  type: SignalType;
  summary: string;
  sourceUrl: string;
  observedAt: Date;
};

export type PlannedScore = {
  fitScore: number;
  fitReasons: string[];
  caution: string | null;
  lastSignalAt: Date;
};

export type PlannedCreate = {
  name: string;
  city: string;
  country: string;
  kind: VenueKind;
  website: string | null;
  instagram: string | null;
  bookingEmail: string | null; // lowercased
  bookingContactName: string | null;
  contactSource: string | null;
  signals: PlannedSignal[];
  score: PlannedScore;
};

export type PlannedUpdate = {
  venueId: string;
  newSignals: PlannedSignal[];
  /** Contact enrichment — only fields the venue is currently missing. */
  enrich: Partial<
    Pick<PlannedCreate, "website" | "instagram" | "bookingEmail" | "bookingContactName" | "contactSource">
  >;
  score: PlannedScore;
};

export type IngestPlan = {
  creates: PlannedCreate[];
  updates: PlannedUpdate[];
  skipped: { venueName: string; city: string; reason: string }[];
};

/** What the planner needs to know about a venue already in the DB. */
export type ExistingVenue = {
  id: string;
  name: string;
  city: string;
  country: string;
  kind: VenueKind;
  status: string; // VenueStatus
  website: string | null;
  instagram: string | null;
  bookingEmail: string | null;
  bookingContactName: string | null;
  contactSource: string | null;
  signals: { type: SignalType; sourceUrl: string; observedAt: Date }[];
};

export type IngestContext = {
  existingVenues: ExistingVenue[];
  /** Lowercased emails from OutreachSuppression. */
  suppressedEmails: string[];
  profile: MatchProfile;
  now: Date;
};

const norm = (s: string) => s.trim().toLowerCase();
const venueKey = (name: string, city: string) => `${norm(name)}|${norm(city)}`;

export function planIngest(ctx: IngestContext, metro: Metro, raw: RawSignal[]): IngestPlan {
  const suppressed = new Set(ctx.suppressedEmails.map(norm));
  const existingByKey = new Map(ctx.existingVenues.map((v) => [venueKey(v.name, v.city), v]));

  // Group raw signals per venue (dedup sourceUrls inside the batch too).
  const groups = new Map<string, { first: RawSignal; signals: RawSignal[] }>();
  for (const r of raw) {
    const key = venueKey(r.venueName, metro.city);
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { first: r, signals: [r] });
    } else if (!g.signals.some((s) => s.sourceUrl === r.sourceUrl)) {
      g.signals.push(r);
    }
  }

  const plan: IngestPlan = { creates: [], updates: [], skipped: [] };

  for (const [key, group] of groups) {
    const existing = existingByKey.get(key);
    const toPlanned = (r: RawSignal): PlannedSignal => ({
      type: r.type,
      summary: r.summary,
      sourceUrl: r.sourceUrl,
      observedAt: r.observedAt ?? ctx.now,
    });

    // Best enrichment across the group (first signal that has each field).
    const pick = <K extends keyof RawSignal>(field: K) =>
      (group.signals.find((s) => s[field] != null)?.[field] ?? null) as string | null;
    const rawEmail = pick("bookingEmail");
    const email = rawEmail ? norm(rawEmail) : null;

    if (existing) {
      if (existing.status === "SUPPRESSED") {
        plan.skipped.push({
          venueName: group.first.venueName,
          city: metro.city,
          reason: "venue is SUPPRESSED — never resurrected",
        });
        continue;
      }

      const knownUrls = new Set(existing.signals.map((s) => s.sourceUrl));
      const newSignals = group.signals.filter((s) => !knownUrls.has(s.sourceUrl)).map(toPlanned);

      const enrich: PlannedUpdate["enrich"] = {};
      if (!existing.website && pick("website")) enrich.website = pick("website");
      if (!existing.instagram && pick("instagram")) enrich.instagram = pick("instagram");
      if (!existing.bookingEmail && email && !suppressed.has(email)) {
        enrich.bookingEmail = email;
        if (pick("contactSource")) enrich.contactSource = pick("contactSource");
        if (pick("bookingContactName")) enrich.bookingContactName = pick("bookingContactName");
      }

      if (newSignals.length === 0 && Object.keys(enrich).length === 0) continue; // idempotent no-op

      const allSignals: ScorableSignal[] = [...existing.signals, ...newSignals];
      const score = scoreVenue(
        {
          name: existing.name,
          city: existing.city,
          country: existing.country,
          kind: existing.kind,
          bookingEmail: enrich.bookingEmail ?? existing.bookingEmail,
        },
        allSignals,
        ctx.profile,
        ctx.now,
      );
      plan.updates.push({
        venueId: existing.id,
        newSignals,
        enrich,
        score: {
          fitScore: score.fitScore,
          fitReasons: score.reasons,
          caution: score.caution ?? null,
          lastSignalAt: maxDate(allSignals.map((s) => s.observedAt)),
        },
      });
      continue;
    }

    // New venue.
    if (email && suppressed.has(email)) {
      plan.skipped.push({
        venueName: group.first.venueName,
        city: metro.city,
        reason: `booking email ${email} is on the suppression list`,
      });
      continue;
    }

    const signals = group.signals.map(toPlanned);
    const kind = group.first.kindGuess;
    const score = scoreVenue(
      { name: group.first.venueName, city: metro.city, country: metro.country, kind, bookingEmail: email },
      signals,
      ctx.profile,
      ctx.now,
    );
    plan.creates.push({
      name: group.first.venueName.trim(),
      city: metro.city.trim(),
      country: metro.country.trim().toUpperCase(),
      kind,
      website: pick("website"),
      instagram: pick("instagram"),
      bookingEmail: email,
      bookingContactName: pick("bookingContactName"),
      contactSource: pick("contactSource"),
      signals,
      score: {
        fitScore: score.fitScore,
        fitReasons: score.reasons,
        caution: score.caution ?? null,
        lastSignalAt: maxDate(signals.map((s) => s.observedAt)),
      },
    });
  }

  return plan;
}

function maxDate(dates: Date[]): Date {
  return dates.reduce((a, b) => (b > a ? b : a));
}

// ---------------------------------------------------------------------------
// DB executor.
// ---------------------------------------------------------------------------

export async function ingestSignals(
  businessId: string,
  metro: Metro,
  rawSignals: RawSignal[],
  now: Date = new Date(),
): Promise<IngestPlan> {
  const [business, existingVenues, suppressions] = await Promise.all([
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { genres: true, eventTypes: true, serviceCities: true },
    }),
    db.venue.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        kind: true,
        status: true,
        website: true,
        instagram: true,
        bookingEmail: true,
        bookingContactName: true,
        contactSource: true,
        signals: { select: { type: true, sourceUrl: true, observedAt: true } },
      },
    }),
    db.outreachSuppression.findMany({ where: { businessId }, select: { email: true } }),
  ]);

  const plan = planIngest(
    {
      existingVenues,
      suppressedEmails: suppressions.map((s) => s.email),
      profile: business,
      now,
    },
    metro,
    rawSignals,
  );

  await db.$transaction(async (tx) => {
    for (const c of plan.creates) {
      await tx.venue.create({
        data: {
          businessId,
          name: c.name,
          city: c.city,
          country: c.country,
          kind: c.kind,
          website: c.website,
          instagram: c.instagram,
          bookingEmail: c.bookingEmail,
          bookingContactName: c.bookingContactName,
          contactSource: c.contactSource,
          fitScore: c.score.fitScore,
          fitReasons: c.score.fitReasons,
          caution: c.score.caution,
          lastSignalAt: c.score.lastSignalAt,
          signals: { create: c.signals },
        },
      });
    }
    for (const u of plan.updates) {
      await tx.venue.update({
        where: { id: u.venueId },
        data: {
          ...u.enrich,
          fitScore: u.score.fitScore,
          fitReasons: u.score.fitReasons,
          caution: u.score.caution,
          lastSignalAt: u.score.lastSignalAt,
          signals: { create: u.newSignals },
        },
      });
    }
  });

  return plan;
}
