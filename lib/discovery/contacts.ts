// Contact discovery (Phase 10.2b): for promising venues the scanner found
// WITHOUT a booking email, find one on the venue's OWN website. NEVER guessed
// — an email is only stored if it literally appears on a page we fetched
// (mailto: or text). Provenance goes in contactSource (trust signal on card).
//
// Frugal + polite by design:
//   * cap CONTACT_VENUES_PER_SCAN venues per scan, 1 Serper query each
//   * plain fetch, 5s timeout, text/html only, 200KB cap
//   * 403/404 = skip, never retry, never proxy
//   * SSRF-guarded: private/loopback/metadata hosts (and names resolving to
//     them) are refused, redirects are never followed (a public host could
//     302 to an internal target)
//   * suppression re-checked at write time (defense in depth vs. ingest)

import { db } from "@/lib/db";
import { isBlockedHost, resolvesToBlockedIp } from "@/lib/pdf/images";
import { scoreVenue, type ScorableSignal, type VenueKind } from "@/lib/venues/score";
import { outreachSuppressionScope } from "@/lib/outreach/suppression";

export const CONTACT_VENUES_PER_SCAN = 5;
export const CONTACT_MIN_SCORE = 60;
export const CONTACT_MAX_ATTEMPTS = 4;
const DAY_MS = 24 * 60 * 60 * 1_000;
export const CONTACT_CLAIM_LEASE_MS = 15 * 60 * 1_000;
export const CONTACT_NOT_FOUND_RETRY_MS = [7 * DAY_MS, 30 * DAY_MS, 90 * DAY_MS] as const;
export const CONTACT_GENERIC_RETRY_MS = [30 * DAY_MS, 90 * DAY_MS, 180 * DAY_MS] as const;
export const CONTACT_ERROR_RETRY_MS = DAY_MS;

export type ContactEnrichmentState =
  | "IN_PROGRESS"
  | "NOT_FOUND"
  | "ERROR"
  | "FOUND_GENERIC"
  | "FOUND_DIRECT"
  | "SUPPRESSED";

export type ContactAttemptState = {
  contactAttemptCount: number;
  contactLastAttemptAt: Date;
  contactRetryAfter: Date | null;
  contactExhaustedAt: Date | null;
  contactState: ContactEnrichmentState;
};

/** A short atomic lease acquired before spending a Serper query. */
export function contactClaimState(
  previousAttempts: number,
  now: Date,
): ContactAttemptState {
  return {
    contactAttemptCount: previousAttempts + 1,
    contactLastAttemptAt: now,
    contactRetryAfter: new Date(now.getTime() + CONTACT_CLAIM_LEASE_MS),
    contactExhaustedAt: null,
    contactState: "IN_PROGRESS",
  };
}

/** Settle a claimed attempt with bounded, outcome-specific retry policy. */
export function contactAttemptState(
  attemptCount: number,
  outcome: Exclude<ContactEnrichmentState, "IN_PROGRESS">,
  now: Date,
): ContactAttemptState {
  const terminal = outcome === "FOUND_DIRECT" || outcome === "SUPPRESSED";
  const exhausted = !terminal && attemptCount >= CONTACT_MAX_ATTEMPTS;
  const delay =
    outcome === "ERROR"
      ? CONTACT_ERROR_RETRY_MS
      : outcome === "FOUND_GENERIC"
        ? CONTACT_GENERIC_RETRY_MS[attemptCount - 1]
        : CONTACT_NOT_FOUND_RETRY_MS[attemptCount - 1];
  return {
    contactAttemptCount: attemptCount,
    contactLastAttemptAt: now,
    contactRetryAfter:
      terminal || exhausted || delay === undefined ? null : new Date(now.getTime() + delay),
    contactExhaustedAt: outcome === "SUPPRESSED" || exhausted ? now : null,
    contactState: outcome,
  };
}

/** Pure mirror of the DB queue predicate, used by the backfill preview. */
export function isContactAttemptDue(
  venue: {
    contactAttemptCount: number;
    contactRetryAfter: Date | null;
    contactExhaustedAt: Date | null;
    contactState?: ContactEnrichmentState | null;
  },
  now: Date,
): boolean {
  if (venue.contactState === "FOUND_DIRECT" || venue.contactState === "SUPPRESSED") return false;
  if (venue.contactExhaustedAt || venue.contactAttemptCount >= CONTACT_MAX_ATTEMPTS) return false;
  if (venue.contactAttemptCount === 0) return true;
  return !!venue.contactRetryAfter && venue.contactRetryAfter.getTime() <= now.getTime();
}

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
 * Pick the venue's own site from Serper organic results: skip aggregators and
 * require positive name evidence in the hostname. A random non-aggregator hit
 * may be a newspaper, PR agency or tourism guide; fetching its contact page
 * would turn a publisher's address into a dangerously mislabeled venue lead.
 */
export function pickVenueSiteUrl(results: { link: string }[], venueName: string): string | null {
  const tokens = slugTokens(venueName);
  if (tokens.length === 0) return null;
  for (const r of results) {
    let host: string;
    try {
      host = new URL(r.link).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (isAggregatorHost(host)) continue;
    if (tokens.some((t) => host.replace(/[^a-z0-9]/g, "").includes(t))) return r.link;
  }
  return null;
}

/** Paths worth trying on a venue site — events/booking pages FIRST (12.8):
 *  an events@ found on /events is the booker; info@ on /contact is a lottery. */
export const CONTACT_PATHS = [
  "/events",
  "/private-hire",
  "/functions",
  "/weddings",
  "/contact",
  "/contact-us",
] as const;

export type ContactHit = {
  email: string;
  source: string;
  /** Exact venue identity, independent of role words in the local-part. */
  direct?: boolean;
};

/** Normalized host ("www." stripped, lowercased) — for domain comparisons. */
function normHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/**
 * Promoter-vs-venue detection (12.8, bounded): an email whose domain isn't
 * the venue site's domain usually belongs to an external promoter/agency
 * running their bookings — worth KNOWING (the label says so on the card),
 * not worth rejecting (that promoter IS the right contact).
 */
export function isExternalDomain(email: string, siteHost: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const host = normHost(siteHost);
  // Free mail (gmail etc.) is a personal inbox, not an agency — the venue
  // often genuinely books through it. Never flag it external.
  if (/^(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton(mail)?)\./.test(domain)) return false;
  return !(host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`));
}

/** Role label stored in contactSource (12.8) — trust signage on the card. */
export function roleLabelFor(email: string, siteHost: string): string {
  const rank = emailRank(email);
  const role =
    rank >= 3 ? "events/bookings contact" : rank === 2 ? "general contact" : "listed contact";
  return isExternalDomain(email, siteHost)
    ? `${role} — external promoter/agency (${email.split("@")[1]})`
    : role;
}

export type ContactDeps = {
  /** 1 Serper /search query — returns organic results. */
  serperSearch: (q: string) => Promise<{ link: string; title?: string }[]>;
  /** Fetch a page; null on any failure (403/404/timeout/non-HTML). Never retries. */
  fetchPage: (url: string) => Promise<string | null>;
};

export function contactQueryFor(name: string, city: string): string {
  // Keep this a single, plain search clause. Serper returned no organic
  // results for the former OR-heavy shape in production, while an exact venue
  // name plus city reliably surfaced the official site. Contact-page paths are
  // still explored after that one grounded result, so broader search operators
  // add query/ranking risk without improving the fetch pass.
  return `"${name}" ${city} contact email`;
}

const WEAK_SITE_CANDIDATE_CAP = 3;

/**
 * Compact identity form for exact phrase checks across punctuation-heavy
 * venue names, URL paths and email addresses ("Bar.Yard" -> "baryard").
 * This is intentionally stricter than slugTokens: the weak parent-brand path
 * may not succeed from one generic token such as "bar" or "hotel".
 */
function identityPhrase(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isAggregatorHost(host: string): boolean {
  return AGGREGATOR_DOMAINS.some((domain) => host.includes(domain));
}

/**
 * A venue can legitimately live below its hotel's or hospitality group's
 * hostname. Admit that weaker shape only with exact, redundant identity
 * evidence: full venue phrase in BOTH path and title, plus city in title.
 * Very short acronyms are too ambiguous for this fallback.
 */
function isWeakParentBrandResult(
  result: { link: string; title?: string },
  venue: { name: string; city: string },
): boolean {
  const venuePhrase = identityPhrase(venue.name);
  const cityPhrase = identityPhrase(venue.city);
  if (venuePhrase.length < 4 || cityPhrase.length === 0 || !result.title) return false;

  try {
    const url = new URL(result.link);
    const host = url.hostname.toLowerCase();
    if (isAggregatorHost(host)) return false;
    const pathPhrase = identityPhrase(decodeURIComponent(url.pathname));
    const titlePhrase = identityPhrase(result.title);
    return (
      pathPhrase.includes(venuePhrase) &&
      titlePhrase.includes(venuePhrase) &&
      titlePhrase.includes(cityPhrase)
    );
  } catch {
    return false;
  }
}

/** A weak parent-brand page may supply only an address bound to the venue. */
function emailBoundToVenue(email: string, venueName: string): boolean {
  const venuePhrase = identityPhrase(venueName);
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  return (
    venuePhrase.length >= 4 &&
    (identityPhrase(local).includes(venuePhrase) || identityPhrase(domain).includes(venuePhrase))
  );
}

async function discoverFromWeakParentBrandResults(
  venue: { name: string; city: string },
  results: { link: string; title?: string }[],
  deps: ContactDeps,
  excludeLink?: string,
): Promise<ContactHit | null> {
  const candidates = results
    .filter(
      (result) => result.link !== excludeLink && isWeakParentBrandResult(result, venue),
    )
    .slice(0, WEAK_SITE_CANDIDATE_CAP);

  for (const candidate of candidates) {
    // Weak identity means weak fetch authority: fetch ONLY the indexed hit.
    // Never fan out to its origin or guessed contact paths as strong, hostname-
    // grounded venue sites do below.
    const html = await deps.fetchPage(candidate.link);
    if (!html) continue;
    const email = pickBestEmail(
      extractEmails(html).filter((value) => emailBoundToVenue(value, venue.name)),
    );
    if (!email) continue;

    const url = new URL(candidate.link);
    const label = url.pathname.replace(/\/$/, "") || "/";
    return {
      email,
      source: `venue-branded search page ${label} — exact venue-bound contact (${email.split("@")[1]})`,
      direct: true,
    };
  }
  return null;
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
  // A strong hostname-grounded result always wins, even if an earlier result
  // happens to qualify for the weaker parent-brand fallback.
  if (!siteUrl) return discoverFromWeakParentBrandResults(venue, results, deps);

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
      best = { email, source: `venue site ${label} — ${roleLabelFor(email, new URL(url).hostname)}` };
      bestRank = rank;
    }
    if (bestRank >= 3) break; // events@/bookings@ found — stop fetching
  }
  if (best) return best;
  // A trusted hostname is preferred and exhausted first, but a WAF/empty
  // response must not starve a later, independently-qualified parent-brand
  // page from the same already-paid search result set.
  return discoverFromWeakParentBrandResults(venue, results, deps, siteUrl);
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
      if (!res.ok) {
        throw new Error(`Serper contact search failed with HTTP ${res.status}`);
      }
      const data = (await res.json()) as { organic?: { link?: string; title?: string }[] };
      return (data.organic ?? []).filter(
        (r): r is { link: string; title?: string } => !!r.link,
      );
    },
    async fetchPage(url) {
      try {
        // SSRF guard: the URL comes from Serper results (attacker-influencable
        // web content), and this fetch runs inside the trust boundary — same
        // discipline as lib/pdf/images.ts: http(s) only, no private/loopback/
        // metadata hosts, re-check what the NAME actually resolves to, and
        // never follow a redirect (a public host could 302 internal).
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
        if (isBlockedHost(parsed.hostname)) return null;
        if (await resolvesToBlockedIp(parsed.hostname)) return null;
        const res = await fetchFn(url, {
          headers: { Accept: "text/html" },
          signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
          redirect: "manual",
        });
        if (res.status >= 300 && res.status < 400) return null; // redirect — skip, never follow
        if (!res.ok) return null; // 403/404/5xx — skip, never retry
        const type = res.headers.get("content-type") ?? "";
        if (!type.includes("text/html")) return null;
        const text = await res.text();
        return text.slice(0, PAGE_BYTE_CAP);
      } catch {
        return null; // timeout/DNS/abort/bad URL — skip
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
 * The scan's contact pass: fair, leased queue over promising DISCOVERED
 * venues. Never-attempted rows go first; due retries fill spare slots. Direct
 * contacts settle, generic contacts remain usable for manual review while a
 * slow upgrade retry stays scheduled.
 */
export async function runContactPass(
  businessId: string,
  opts: { now?: Date; deps?: ContactDeps; gl?: string; limit?: number } = {},
): Promise<ContactPassResult> {
  const now = opts.now ?? new Date();
  const live = opts.deps ? null : makeLiveDeps({ gl: opts.gl });
  const deps = opts.deps ?? live!;
  let serperQueries = 0;
  const countedDeps: ContactDeps = {
    ...deps,
    serperSearch: async (query) => {
      serperQueries++;
      return deps.serperSearch(query);
    },
  };
  const limit = Math.max(1, Math.min(CONTACT_VENUES_PER_SCAN, opts.limit ?? CONTACT_VENUES_PER_SCAN));

  const commonWhere = {
    businessId,
    status: "DISCOVERED" as const,
    fitScore: { gte: CONTACT_MIN_SCORE },
  };
  const include = { signals: { select: { type: true, observedAt: true } } } as const;

  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { genres: true, eventTypes: true, serviceCities: true, acceptsTravel: true },
  });

  // Read both fair queues. When any retry/upgrade is due, reserve one slot for
  // it even if a continuous fresh backlog could otherwise consume all five;
  // fresh venues still lead the batch, and retries fill every remaining gap.
  const [freshQueue, retryQueue] = await Promise.all([
    db.venue.findMany({
      where: {
        ...commonWhere,
        bookingEmail: null,
        contactAttemptCount: 0,
        contactExhaustedAt: null,
      },
      orderBy: [{ fitScore: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      take: limit,
      include,
    }),
    db.venue.findMany({
      where: {
        ...commonWhere,
        contactAttemptCount: { gt: 0, lt: CONTACT_MAX_ATTEMPTS },
        contactRetryAfter: { lte: now },
        contactExhaustedAt: null,
        contactState: { in: ["IN_PROGRESS", "NOT_FOUND", "ERROR", "FOUND_GENERIC"] },
      },
      orderBy: [
        { contactRetryAfter: "asc" },
        { contactAttemptCount: "asc" },
        { fitScore: "desc" },
        { id: "asc" },
      ],
      take: limit,
      include,
    }),
  ]);
  const reservedRetries = retryQueue.length > 0 ? 1 : 0;
  const fresh = freshQueue.slice(0, limit - reservedRetries);
  const retries = retryQueue.slice(0, limit - fresh.length);
  const venues = [...fresh, ...retries];

  const result: ContactPassResult = {
    eligible: venues.length,
    attempted: 0,
    serperQueries: 0,
    found: [],
    suppressed: [],
  };

  for (const venue of venues) {
    // A cron and a manual backfill may overlap. Claim against the exact queue
    // version we selected; only one worker may spend the external query.
    const claimState = contactClaimState(venue.contactAttemptCount, now);
    const claim = await db.venue.updateMany({
      where: {
        id: venue.id,
        businessId,
        status: "DISCOVERED",
        bookingEmail: venue.bookingEmail,
        contactAttemptCount: venue.contactAttemptCount,
        contactRetryAfter: venue.contactRetryAfter,
        contactExhaustedAt: null,
        contactState: venue.contactState,
      },
      data: claimState,
    });
    if (claim.count !== 1) continue;

    result.attempted++;
    let hit: ContactHit | null = null;
    let errored = false;
    try {
      hit = await discoverVenueContact(venue, countedDeps);
    } catch (err) {
      errored = true;
      console.error(`contact discovery failed for venue ${venue.id} (${venue.name})`, err);
    }
    if (!hit) {
      const outcome: Exclude<ContactEnrichmentState, "IN_PROGRESS"> = errored
        ? "ERROR"
        : venue.bookingEmail
          ? "FOUND_GENERIC"
          : "NOT_FOUND";
      await db.venue.updateMany({
        where: {
          id: venue.id,
          businessId,
          status: "DISCOVERED",
          bookingEmail: venue.bookingEmail,
          contactAttemptCount: claimState.contactAttemptCount,
          contactState: "IN_PROGRESS",
        },
        data: contactAttemptState(claimState.contactAttemptCount, outcome, now),
      });
      continue;
    }

    const email = hit.email.toLowerCase();
    const existingDirect =
      venue.contactState === "FOUND_DIRECT" ||
      (!!venue.bookingEmail && emailRank(venue.bookingEmail) >= 3);
    const foundDirect = hit.direct === true || emailRank(email) >= 3;
    const existingRank = existingDirect
      ? 3
      : venue.bookingEmail
        ? emailRank(venue.bookingEmail)
        : -1;
    const foundRank = foundDirect ? 3 : emailRank(email);
    const useFound = foundRank > existingRank;
    const chosenEmail = useFound ? email : venue.bookingEmail ?? email;
    const chosenSource = useFound ? hit.source : venue.contactSource;
    const chosenDirect = useFound ? foundDirect : existingDirect;
    const outcome = chosenDirect ? "FOUND_DIRECT" : "FOUND_GENERIC";

    // Re-check the address that would actually be persisted, at write time —
    // the list may have grown since ingest or since a generic contact was
    // first stored. This also closes the generic→direct upgrade path.
    const suppressedRow = await outreachSuppressionScope(businessId, chosenEmail);
    if (suppressedRow) {
      await db.venue.updateMany({
        where: {
          id: venue.id,
          businessId,
          status: "DISCOVERED",
          bookingEmail: venue.bookingEmail,
          contactAttemptCount: claimState.contactAttemptCount,
          contactState: "IN_PROGRESS",
        },
        data: {
          ...contactAttemptState(claimState.contactAttemptCount, "SUPPRESSED", now),
          status: "SUPPRESSED",
          suppressedReason: "CONTACT_SUPPRESSED",
        },
      });
      result.suppressed.push({ venueId: venue.id, name: venue.name, email: chosenEmail });
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
        bookingEmail: chosenEmail,
        travelWindowId: venue.travelWindowId,
      },
      signals,
      business,
      now,
    );
    const saved = await db.venue.updateMany({
      where: {
        id: venue.id,
        businessId,
        status: "DISCOVERED",
        bookingEmail: venue.bookingEmail,
        contactAttemptCount: claimState.contactAttemptCount,
        contactState: "IN_PROGRESS",
      },
      data: {
        ...contactAttemptState(claimState.contactAttemptCount, outcome, now),
        bookingEmail: chosenEmail,
        contactSource: chosenSource,
        fitScore: score.fitScore,
        fitReasons: score.reasons,
        caution: score.caution ?? null,
      },
    });
    if (saved.count === 1) {
      result.found.push({
        venueId: venue.id,
        name: venue.name,
        email: chosenEmail,
        source: chosenSource ?? hit.source,
      });
    }
  }

  result.serperQueries = serperQueries;
  return result;
}
