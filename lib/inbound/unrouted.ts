// Mail that arrives for a lead address no tenant owns.
//
// Dropping stray internet mail is correct and must stay silent. The problem is
// that the SAME code path is what happens when a customer typos their
// forwarding address during onboarding: `leads@nobert.in.brightears.io` instead
// of `leads@norbert.in...`. Postmark accepts it — the MX is a WILDCARD
// (*.in.brightears.io), so every possible slug resolves — the pipeline finds no
// tenant, returns "no_tenant", and the inquiry is gone. Neither the artist nor
// we ever find out. For a product whose entire promise is "nothing gets lost",
// that is the worst failure mode available.
//
// This is a VISIBILITY fix, not a rejection fix: the webhook must still answer
// Postmark with a success status for genuinely unroutable mail, or Postmark
// retries it forever.
//
// Two deliberate design choices:
//
// 1. The record function is PURE and in-memory — no DB, no I/O. It runs inside
//    the inbound webhook, on the hot path that real client inquiries share, and
//    must not add latency or a failure mode to it. All the expensive work
//    (resolving near-miss slugs against real tenants) happens once a day in the
//    nightly digest, or on the rare occasion we send an immediate alert.
//
// 2. State is per-process and resets on deploy, exactly like lib/rate-limit.ts.
//    That is an acknowledged limitation, not an oversight: a typo could be lost
//    if a deploy lands before the digest. It is mitigated by the immediate
//    first-sighting alert, and the real fix for onboarding typos is to surface
//    the near-miss on the onboarding step itself, where the artist is sitting
//    right at that moment.

export type UnroutedEntry = {
  /** The full recipient address, lower-cased. */
  to: string;
  /** The slug we extracted, or null when the address didn't even parse. */
  slug: string | null;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
};

const tally = new Map<string, UnroutedEntry>();

/**
 * Cap the map so a spam run against random slugs cannot grow it without bound.
 * Once full we stop TRACKING NEW addresses but keep counting known ones — the
 * addresses already seen are the ones most likely to be a real customer's typo,
 * so they are the ones worth keeping.
 */
const MAX_TRACKED = 500;

/** Record an unroutable recipient. Pure, in-memory, never throws. */
export function noteUnrouted(to: string, slug: string | null, now = new Date()): UnroutedEntry | null {
  const key = (to ?? "").trim().toLowerCase();
  if (!key) return null;
  const existing = tally.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
    return existing;
  }
  if (tally.size >= MAX_TRACKED) return null;
  const entry: UnroutedEntry = { to: key, slug, count: 1, firstSeen: now, lastSeen: now };
  tally.set(key, entry);
  return entry;
}

/** Everything seen since the last clear, worst offenders first. */
export function unroutedEntries(): UnroutedEntry[] {
  return [...tally.values()].sort((a, b) => b.count - a.count);
}

/** Reset the tally — called after the digest reports it, and by tests. */
export function clearUnrouted(): void {
  tally.clear();
}

/** True when this is the first time we have seen this address in this process. */
export function isFirstSighting(entry: UnroutedEntry): boolean {
  return entry.count === 1;
}

/**
 * Levenshtein distance, iterative two-row form.
 *
 * Used only to answer "is this a near-miss of a real tenant slug?", which is
 * what separates a probable customer typo from a spam probe. Slugs are short so
 * the cost is irrelevant, and this runs off the hot path.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * The closest real tenant slug within a small edit distance, or null.
 *
 * The threshold scales with length so short slugs can't match everything: a
 * 3-character slug within distance 2 would be noise, while a 20-character slug
 * missing one letter is almost certainly the typo we are looking for.
 */
export function nearestSlug(
  candidate: string | null,
  slugs: string[],
): { slug: string; distance: number } | null {
  if (!candidate) return null;
  const limit = candidate.length <= 4 ? 1 : 2;
  let best: { slug: string; distance: number } | null = null;
  for (const slug of slugs) {
    const distance = editDistance(candidate, slug);
    if (distance === 0) continue; // an exact match is not a near-miss
    if (distance > limit) continue;
    if (!best || distance < best.distance) best = { slug, distance };
  }
  return best;
}

export type UnroutedReport = {
  entries: UnroutedEntry[];
  /** Entries whose slug is a near-miss of a real tenant — the likely typos. */
  nearMisses: { to: string; slug: string; didYouMean: string; distance: number; count: number }[];
  total: number;
};

/**
 * Resolve the tally against real tenant slugs. Async and DB-touching, so it is
 * called from the nightly digest and the rare immediate alert — never from the
 * webhook path.
 */
export async function buildUnroutedReport(
  loadSlugs: () => Promise<string[]>,
): Promise<UnroutedReport> {
  const entries = unroutedEntries();
  const total = entries.reduce((n, e) => n + e.count, 0);
  if (!entries.length) return { entries, nearMisses: [], total };

  const slugs = await loadSlugs();
  const nearMisses: UnroutedReport["nearMisses"] = [];
  for (const e of entries) {
    const near = nearestSlug(e.slug, slugs);
    if (near) {
      nearMisses.push({
        to: e.to,
        slug: e.slug as string,
        didYouMean: near.slug,
        distance: near.distance,
        count: e.count,
      });
    }
  }
  return { entries, nearMisses, total };
}
