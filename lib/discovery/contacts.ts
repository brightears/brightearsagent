// Contact discovery (Phase 10.2b): for promising venues the scanner found
// WITHOUT a booking email, find one on the venue's OWN website. NEVER guessed
// — an email is only stored if it literally appears on a page we fetched
// (mailto: or text). Provenance goes in contactSource (trust signal on card).
//
// Frugal + polite by design:
//   * cap CONTACT_VENUES_PER_SCAN venues per scan, 1 Serper query each
//   * plain fetch, 5s timeout, text/html only, 200KB cap
//   * 403/404 = skip, never retry, never proxy
//   * suppression re-checked at write time (defense in depth vs. ingest)

import { db } from "@/lib/db";
import { scoreVenue, type ScorableSignal, type VenueKind } from "@/lib/venues/score";

export const CONTACT_VENUES_PER_SCAN = 5;
export const CONTACT_MIN_SCORE = 60;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without network/DB)
// ---------------------------------------------------------------------------

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Filename-looking matches the text regex catches in srcsets etc. */
const NOT_AN_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i;

/** All literal emails on a page — mailto: links plus plain-text matches. */
export function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    const e = decodeURIComponent(m[1]).trim().toLowerCase();
    if (EMAIL_RE.test(e) && !NOT_AN_EMAIL.test(e)) found.add(e);
    EMAIL_RE.lastIndex = 0;
  }
  for (const m of html.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase();
    if (!NOT_AN_EMAIL.test(e)) found.add(e);
  }
  return [...found];
}

/**
 * Preference rank. -1 = never use (noreply/careers/...); higher = better.
 * events@/bookings@ beat info@ beat anything else that survives the blocklist.
 */
export function emailRank(email: string): number {
  const local = email.split("@")[0] ?? "";
  if (/(no-?reply|donotreply|career|jobs?|recruit|press|privacy|abuse|unsubscribe|postmaster|webmaster)/.test(local)) {
    return -1;
  }
  if (/(event|booking|privatehire|private-hire|functions?|venuehire|parties)/.test(local)) return 3;
  if (/(info|hello|enquir|inquir|contact|reservations?|bookings)/.test(local)) return 2;
  return 1;
}

/** Best usable email or null — NEVER fabricates. */
export function pickBestEmail(emails: string[]): string | null {
  let best: string | null = null;
  let bestRank = 0;
  for (const e of emails) {
    const r = emailRank(e);
    if (r > bestRank) {
      best = e;
      bestRank = r;
    }
  }
  return best;
}

/** Domains that are never "the venue's own site". */
const AGGREGATOR_DOMAINS = [
  "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com", "linkedin.com",
  "youtube.com", "tripadvisor.", "yelp.", "opentable.", "designmynight.com", "sevenrooms.com",
  "eventbrite.", "tagvenue.com", "hirespace.com", "headbox.com", "wikipedia.org",
  "google.com", "deliveroo.", "ubereats.", "just-eat.", "timeout.com", "secretldn",
  "skiddle.com", "fatsoma.com", "resdiary.com", "squaremeal.co.uk",
];

const slugTokens = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((t) => t.length > 2 && t !== "the" && t !== "and" && t !== "bar");

/**
 * Pick the venue's own site from Serper organic results: skip aggregators,
 * prefer a domain that contains a token of the venue name, else first
 * non-aggregator hit.
 */
export function pickVenueSiteUrl(results: { link: string }[], venueName: string): string | null {
  const tokens = slugTokens(venueName);
  const candidates: string[] = [];
  for (const r of results) {
    let host: string;
    try {
      host = new URL(r.link).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (AGGREGATOR_DOMAINS.some((d) => host.includes(d))) continue;
    candidates.push(r.link);
    if (tokens.some((t) => host.replace(/[^a-z0-9]/g, "").includes(t))) return r.link;
  }
  return candidates[0] ?? null;
}

/** Paths worth trying on a venue site, most-likely-contact first. */
export const CONTACT_PATHS = ["/contact", "/contact-us", "/private-hire", "/events"] as const;

export type ContactHit = { email: string; source: string };

export type ContactDeps = {
  /** 1 Serper /search query — returns organic results. */
  serperSearch: (q: string) => Promise<{ link: string }[]>;
  /** Fetch a page; null on any failure (403/404/timeout/non-HTML). Never retries. */
  fetchPage: (url: string) => Promise<string | null>;
};

export function contactQueryFor(name: string, city: string): string {
  return `${name} ${city} contact OR "private hire" OR events email`;
}

/**
 * The per-venue hunt, DB-free for tests: 1 search query → venue's own site →
 * fetch the hit page + homepage + contact-ish paths, stop at the first
 * top-rank email; otherwise keep the best seen across pages.
 */
export async function discoverVenueContact(
  venue: { name: string; city: string },
  deps: ContactDeps,
): Promise<ContactHit | null> {
  const results = await deps.serperSearch(contactQueryFor(venue.name, venue.city));
  const siteUrl = pickVenueSiteUrl(results, venue.name);
  if (!siteUrl) return null;

  let origin: string;
  let hitPath: string;
  try {
    const u = new URL(siteUrl);
    origin = u.origin;
    hitPath = u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }

  // The search hit itself first (often already the contact page), then the
  // homepage, then conventional paths — each fetched at most once.
  const pages = new Map<string, string>(); // url -> label
  pages.set(siteUrl, hitPath === "/" ? "homepage" : hitPath);
  pages.set(`${origin}/`, "homepage");
  for (const p of CONTACT_PATHS) pages.set(`${origin}${p}`, p);

  let best: ContactHit | null = null;
  let bestRank = 0;
  for (const [url, label] of pages) {
    const html = await deps.fetchPage(url);
    if (!html) continue;
    const email = pickBestEmail(extractEmails(html));
    if (!email) continue;
    const rank = emailRank(email);
    if (rank > bestRank) {
      best = { email, source: `venue site ${label}` };
      bestRank = rank;
    }
    if (bestRank >= 3) break; // events@/bookings@ found — stop fetching
  }
  return best;
}

// ---------------------------------------------------------------------------
// Real-world deps + DB pass
// ---------------------------------------------------------------------------

const PAGE_BYTE_CAP = 200_000;
const PAGE_TIMEOUT_MS = 5_000;

export function makeLiveDeps(opts: { apiKey?: string; fetchFn?: typeof fetch; gl?: string } = {}): ContactDeps & {
  queries: () => number;
} {
  const apiKey = opts.apiKey ?? process.env.SERPER_API_KEY ?? "";
  const fetchFn = opts.fetchFn ?? fetch;
  let queries = 0;
  return {
    queries: () => queries,
    async serperSearch(q) {
      queries++;
      const res = await fetchFn("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 10, ...(opts.gl ? { gl: opts.gl } : {}) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { organic?: { link?: string }[] };
      return (data.organic ?? []).filter((r): r is { link: string } => !!r.link);
    },
    async fetchPage(url) {
      try {
        const res = await fetchFn(url, {
          headers: { Accept: "text/html" },
          signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
          redirect: "follow",
        });
        if (!res.ok) return null; // 403/404/5xx — skip, never retry
        const type = res.headers.get("content-type") ?? "";
        if (!type.includes("text/html")) return null;
        const text = await res.text();
        return text.slice(0, PAGE_BYTE_CAP);
      } catch {
        return null; // timeout/DNS/abort — skip
      }
    },
  };
}

export type ContactPassResult = {
  eligible: number;
  attempted: number;
  serperQueries: number;
  found: { venueId: string; name: string; email: string; source: string }[];
  suppressed: { venueId: string; name: string; email: string }[];
};

/**
 * The scan's contact pass: venues without a bookingEmail, score >= 60, status
 * DISCOVERED — top CONTACT_VENUES_PER_SCAN by score. Writes bookingEmail +
 * contactSource and re-scores (pitchability points) on success.
 */
export async function runContactPass(
  businessId: string,
  opts: { now?: Date; deps?: ContactDeps; gl?: string } = {},
): Promise<ContactPassResult> {
  const now = opts.now ?? new Date();
  const live = opts.deps ? null : makeLiveDeps({ gl: opts.gl });
  const deps = opts.deps ?? live!;

  const [business, venues] = await Promise.all([
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { genres: true, eventTypes: true, serviceCities: true },
    }),
    db.venue.findMany({
      where: {
        businessId,
        bookingEmail: null,
        status: "DISCOVERED",
        fitScore: { gte: CONTACT_MIN_SCORE },
      },
      orderBy: { fitScore: "desc" },
      take: CONTACT_VENUES_PER_SCAN,
      include: { signals: { select: { type: true, observedAt: true } } },
    }),
  ]);

  const result: ContactPassResult = {
    eligible: venues.length,
    attempted: 0,
    serperQueries: 0,
    found: [],
    suppressed: [],
  };

  for (const venue of venues) {
    result.attempted++;
    let hit: ContactHit | null = null;
    try {
      hit = await discoverVenueContact(venue, deps);
    } catch (err) {
      console.error(`contact discovery failed for venue ${venue.id} (${venue.name})`, err);
    }
    if (!hit) continue;

    const email = hit.email.toLowerCase();
    // Re-check suppression at write time — the list may have grown since ingest.
    const suppressedRow = await db.outreachSuppression.findUnique({
      where: { businessId_email: { businessId, email } },
    });
    if (suppressedRow) {
      result.suppressed.push({ venueId: venue.id, name: venue.name, email });
      continue;
    }

    // Re-score with the email present (pitchability points).
    const signals: ScorableSignal[] = venue.signals;
    const score = scoreVenue(
      {
        name: venue.name,
        city: venue.city,
        country: venue.country,
        kind: venue.kind as VenueKind,
        bookingEmail: email,
      },
      signals,
      business,
      now,
    );
    await db.venue.update({
      where: { id: venue.id },
      data: {
        bookingEmail: email,
        contactSource: hit.source,
        fitScore: score.fitScore,
        fitReasons: score.reasons,
        caution: score.caution ?? null,
      },
    });
    result.found.push({ venueId: venue.id, name: venue.name, email, source: hit.source });
  }

  result.serperQueries = live ? live.queries() : result.attempted;
  return result;
}
