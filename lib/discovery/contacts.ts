// Contact discovery (Phase 10.2b): for promising venues the scanner found
// WITHOUT a booking email, find one on the venue's OWN website. NEVER guessed
// — an email is only stored if it literally appears on a page we fetched
// (mailto: or text). Provenance goes in contactSource (trust signal on card).
//
// Frugal + polite by design:
//   * cap CONTACT_VENUES_PER_SCAN venues per scan, 1 Serper query each
//   * plain fetch, 3s timeout, text/html only, bounded head+tail sample
//   * 403/404 = skip, never retry, never proxy
//   * SSRF-guarded: private/loopback/metadata hosts (and names resolving to
//     them) are refused; one same-host redirect is revalidated before fetching
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
export const CONTACT_PASS_WALL_BUDGET_MS = 75_000;
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

// RFC-compatible practical bounds also keep hostile long text runs from
// turning the global scan into quadratic backtracking work.
const EMAIL_RE = /(?<![A-Z0-9._%+-])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}(?![A-Z0-9.-])/gi;
/** Filename-looking matches the text regex catches in srcsets etc. */
const NOT_AN_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/i;

/**
 * Decode only exact email punctuation encodings seen in HTML/JSON-LD. This is
 * deliberately not a general entity decoder: broad decoding can join unrelated
 * page fragments into something that merely looks like an address.
 */
function decodeEmailPunctuation(value: string): string {
  return value
    .replace(/(?:&#0*64;|&#x0*40;|&commat;)/gi, "@")
    .replace(/(?:&#0*46;|&#x0*2e;|&period;)/gi, ".")
    .replace(/\\u0040/gi, "@")
    .replace(/\\u002e/gi, ".");
}

/** All literal emails on a page — mailto: links plus plain-text matches. */
export function extractEmails(html: string): string[] {
  const decodedHtml = decodeEmailPunctuation(html);
  const found = new Set<string>();
  for (const m of decodedHtml.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    let decoded = m[1];
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // A malformed percent escape must not abort extraction of other literal
      // addresses on the page.
    }
    EMAIL_RE.lastIndex = 0;
    for (const emailMatch of decoded.matchAll(EMAIL_RE)) {
      const e = emailMatch[0].toLowerCase();
      if (!NOT_AN_EMAIL.test(e)) found.add(e);
    }
    EMAIL_RE.lastIndex = 0;
  }
  for (const m of decodedHtml.matchAll(EMAIL_RE)) {
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
  if (/(no-?reply|donotreply|career|jobs?|recruit|press|privacy|abuse|unsubscribe|postmaster|webmaster|newsletters?|editorial|support|customer[._-]?service|marketing)/.test(local)) {
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

/** Paths worth trying on a venue site — events/booking pages FIRST (12.8):
 *  an events@ found on /events is the booker; info@ on /contact is a lottery. */
export const CONTACT_PATHS = [
  "/events",
  "/private-hire",
  "/contact",
  "/contact-us",
] as const;

export type ContactHit = {
  email: string;
  source: string;
  /**
   * true = exact venue identity; false = explicitly generic despite role words
   * (used for a loosely grounded search page); absent = infer from role rank.
   */
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

const SEARCH_RESULT_CANDIDATE_CAP = 3;
const DISCOVERED_CONTACT_LINK_CAP = 2;
const DISCOVERED_CONTACT_LINK_PARSE_CAP = 12;
export const CONTACT_PAGE_FETCH_CAP_PER_VENUE = 8;

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

/**
 * Venue-type words may suffix an otherwise distinctive name without appearing
 * in its address ("Sato San Rooftop" -> "satosan"). Strip ONLY trailing type
 * words and require a multi-word, reasonably long remainder: individual words,
 * acronyms and generic category matches are deliberately insufficient proof.
 */
const VENUE_TYPE_SUFFIXES = new Set([
  "bar",
  "cafe",
  "club",
  "grill",
  "hotel",
  "kitchen",
  "lounge",
  "pub",
  "restaurant",
  "resort",
  "rooftop",
  "terrace",
  "venue",
]);

function venueIdentityCoreTokens(value: string): string[] {
  const tokens = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 0 && VENUE_TYPE_SUFFIXES.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.length >= 2 && tokens.join("").length >= 6 ? tokens : [];
}

function venueIdentityCore(value: string): string | null {
  const tokens = venueIdentityCoreTokens(value);
  return tokens.length > 0 ? tokens.join("") : null;
}

function emailContainsIdentityPhrase(email: string, phrase: string): boolean {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  return (
    phrase.length >= 4 &&
    (identityPhrase(local).includes(phrase) || identityPhrase(domain).includes(phrase))
  );
}

function isAggregatorHost(host: string): boolean {
  return AGGREGATOR_DOMAINS.some((domain) => host.includes(domain));
}

/** Common public-suffix second levels; unknown shapes fail closed. */
const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "go",
  "gov",
  "ne",
  "net",
  "or",
  "org",
]);

/**
 * Return only the registrant label, never a user-controlled subdomain. This
 * deliberately handles the common ccTLD shapes and fails closed for unusual
 * multi-label public suffixes rather than granting direct-contact confidence.
 */
function registrantLabel(host: string): string | null {
  const labels = host.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9-]+$/.test(label))) return null;
  const tld = labels[labels.length - 1]!;
  const secondLevel = labels[labels.length - 2]!;
  const hasCommonCcTldSuffix =
    tld.length === 2 && COMMON_SECOND_LEVEL_SUFFIXES.has(secondLevel);
  const index = labels.length - (hasCommonCcTldSuffix ? 3 : 2);
  return index >= 0 ? labels[index]! : null;
}

/**
 * Direct-contact identity needs stricter first-party proof than the crawler's
 * intentionally broad any-token host selection. The registrant label must be
 * an exact full/core venue identity with only a known city or venue-type
 * prefix/suffix — arbitrary publisher words such as "guide" or "tickets" fail.
 */
function isStrictFirstPartyHost(host: string, venueName: string, city: string): boolean {
  const label = registrantLabel(host);
  if (!label) return false;
  const hostIdentity = identityPhrase(label);
  const fullIdentity = identityPhrase(venueName);
  // Short brands are too collision-prone for substring matching. Permit only
  // the exact registrant label, or the exact brand/city concatenation in
  // either order (Veyla -> veyla, veylabangkok, bangkokveyla).
  if (fullIdentity.length >= 4 && fullIdentity.length <= 5) {
    const cityIdentity = identityPhrase(city);
    if (
      hostIdentity === fullIdentity ||
      (cityIdentity.length > 0 &&
        (hostIdentity === `${fullIdentity}${cityIdentity}` ||
          hostIdentity === `${cityIdentity}${fullIdentity}`))
    ) {
      return true;
    }
    return false;
  }
  if (fullIdentity.length < 6) return false;

  const bases = new Set([fullIdentity]);
  const core = venueIdentityCore(venueName);
  if (core) bases.add(core);
  const cityIdentity = identityPhrase(city);
  const venueTypes = [...VENUE_TYPE_SUFFIXES].map(identityPhrase).filter(Boolean);
  const allowed = new Set<string>();

  for (const base of bases) {
    allowed.add(base);
    if (cityIdentity) {
      allowed.add(`${base}${cityIdentity}`);
      allowed.add(`${cityIdentity}${base}`);
    }
    for (const venueType of venueTypes) {
      allowed.add(`${base}${venueType}`);
      allowed.add(`${venueType}${base}`);
      if (!cityIdentity) continue;
      // Every ordering of one exact city, one known venue type and the exact
      // venue base remains finite and auditable; no arbitrary extra token is
      // admitted.
      allowed.add(`${base}${cityIdentity}${venueType}`);
      allowed.add(`${base}${venueType}${cityIdentity}`);
      allowed.add(`${cityIdentity}${base}${venueType}`);
      allowed.add(`${cityIdentity}${venueType}${base}`);
      allowed.add(`${venueType}${base}${cityIdentity}`);
      allowed.add(`${venueType}${cityIdentity}${base}`);
    }
  }
  return allowed.has(hostIdentity);
}

/**
 * A venue can legitimately live below its hotel's or hospitality group's
 * hostname. Retain that weaker shape for manual verification only when the
 * full venue phrase appears in BOTH path and title, plus city in title. Very
 * short acronyms are too ambiguous even for this generic fallback.
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

/** A weak parent-brand page may retain only an address visibly named for the venue. */
function emailBoundToVenue(email: string, venueName: string): boolean {
  const venuePhrase = identityPhrase(venueName);
  return emailContainsIdentityPhrase(email, venuePhrase);
}

/**
 * Strong hostname grounding lets an official page use a narrowly relaxed
 * identity proof. The exact full-name rule remains first; the only relaxation
 * is a distinctive multi-word core after trailing venue-type words are
 * removed. Weak parent-brand pages intentionally do NOT use this helper.
 */
function emailBoundToOfficialVenue(email: string, venueName: string): boolean {
  if (emailBoundToVenue(email, venueName)) return true;
  const core = venueIdentityCore(venueName);
  return core !== null && emailContainsIdentityPhrase(email, core);
}

type ContactSearchResult = { link: string; title?: string };
type ContactCandidateKind = "strict" | "weak" | "loose";

function looseHostnameMatchesVenue(host: string, venueName: string): boolean {
  const compactHost = host.toLowerCase().replace(/[^a-z0-9]/g, "");
  return slugTokens(venueName).some((token) => compactHost.includes(token));
}

/**
 * Rank redundant first-party proof ahead of broad any-token matching, while
 * preserving result order inside each proof class. Only three already-paid
 * organic hits may be evaluated for a venue.
 */
function rankedContactCandidates(
  results: ContactSearchResult[],
  venue: { name: string; city: string },
): { result: ContactSearchResult; kind: ContactCandidateKind }[] {
  const ranked: {
    result: ContactSearchResult;
    kind: ContactCandidateKind;
    index: number;
  }[] = [];
  const seen = new Set<string>();

  for (const [index, result] of results.entries()) {
    if (seen.has(result.link)) continue;
    let host: string;
    try {
      host = new URL(result.link).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (isAggregatorHost(host)) continue;

    let kind: ContactCandidateKind | null = null;
    if (isStrictFirstPartyHost(host, venue.name, venue.city)) kind = "strict";
    else if (isWeakParentBrandResult(result, venue)) kind = "weak";
    else if (looseHostnameMatchesVenue(host, venue.name)) kind = "loose";
    if (!kind) continue;

    seen.add(result.link);
    ranked.push({ result, kind, index });
  }

  const weight: Record<ContactCandidateKind, number> = {
    strict: 0,
    weak: 1,
    loose: 2,
  };
  return ranked
    .sort((a, b) => weight[a.kind] - weight[b.kind] || a.index - b.index)
    .slice(0, SEARCH_RESULT_CANDIDATE_CAP)
    .map(({ result, kind }) => ({ result, kind }));
}

/** Bounded purpose-looking links, exact same origin, from strict sites only. */
function discoveredContactLinks(html: string, baseUrl: string, siteOrigin: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const purpose = /(?:contact|events?|private[-_/]?hire|functions?|weddings?|bookings?|venue[-_/]?hire|meetings?)/i;
  for (const match of html.matchAll(/href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    if (found.length >= DISCOVERED_CONTACT_LINK_PARSE_CAP) break;
    const rawHref = (match[1] ?? match[2] ?? "").replace(/&amp;/gi, "&").trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.length > 2_048) continue;
    let url: URL;
    try {
      url = new URL(rawHref, baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (url.username || url.password) continue;
    // Exact origin also rejects HTTPS downgrades and alternate-port pivots.
    if (url.origin.toLowerCase() !== siteOrigin.toLowerCase()) continue;
    if (!purpose.test(`${url.pathname}${url.search}`)) continue;
    url.hash = "";
    const value = url.toString();
    if (seen.has(value)) continue;
    seen.add(value);
    found.push(value);
  }
  return found;
}

async function discoverFromWeakParentBrandResult(
  venue: { name: string; city: string },
  candidate: ContactSearchResult,
  deps: ContactDeps,
): Promise<ContactHit | null> {
  // Weak identity means weak fetch authority: fetch ONLY the indexed hit.
  // Never fan out to its origin, guessed paths or discovered links.
  const html = await deps.fetchPage(candidate.link);
  if (!html) return null;
  const email = pickBestEmail(
    extractEmails(html).filter((value) => emailBoundToVenue(value, venue.name)),
  );
  if (!email) return null;

  const url = new URL(candidate.link);
  const label = url.pathname.replace(/\/$/, "") || "/";
  return {
    email,
    source: `venue-branded search page ${label} — venue-named contact, verify parent brand (${email.split("@")[1]})`,
    // Path/title/email agreement on a parent or publisher host is useful
    // provenance, not first-party proof. Keep it manual and retryable.
    direct: false,
  };
}

/**
 * A broad any-token hostname remains useful for a generic lead, but it is not
 * strong enough to grant direct confidence or authority to crawl more pages.
 */
async function discoverFromLooseResult(
  venue: { name: string; city: string },
  candidate: ContactSearchResult,
  deps: ContactDeps,
): Promise<ContactHit | null> {
  const html = await deps.fetchPage(candidate.link);
  if (!html) return null;
  const email = pickBestEmail(extractEmails(html));
  if (!email) return null;
  const url = new URL(candidate.link);
  const label = url.pathname.replace(/\/$/, "") || "/";
  return {
    email,
    source: `search-matched page ${label} — ${roleLabelFor(email, url.hostname)}`,
    // Purpose words alone cannot turn a broad any-token publisher match into
    // a direct venue contact. The explicit false survives persistence.
    ...(emailRank(email) >= 3 ? { direct: false } : {}),
  };
}

type RankedContactHit = { hit: ContactHit; rank: number };

function contactHitFromStrictPage(
  html: string,
  venue: { name: string },
  pageUrl: string,
  label: string,
): RankedContactHit | null {
  const pageHost = new URL(pageUrl).hostname;
  let email: string | null = null;
  let identityDirect = false;
  let rank = 0;
  for (const candidate of extractEmails(html)) {
    const roleRank = emailRank(candidate);
    if (roleRank < 1) continue;
    const candidateIdentityDirect =
      roleRank < 3 && emailBoundToOfficialVenue(candidate, venue.name);
    // A deterministic venue identity beats a generic role address, while a
    // purpose-specific events/bookings address remains the best outcome.
    const candidateRank = candidateIdentityDirect ? 2.5 : roleRank;
    if (candidateRank > rank) {
      email = candidate;
      identityDirect = candidateIdentityDirect;
      rank = candidateRank;
    }
  }
  if (!email) return null;
  return {
    hit: identityDirect
      ? {
          email,
          source: `venue site ${label} — venue-bound contact (${email.split("@")[1]})`,
          direct: true,
        }
      : {
          email,
          source: `venue site ${label} — ${roleLabelFor(email, pageHost)}`,
        },
    rank,
  };
}

/** Later strict candidates get only their indexed hit; no second full crawl. */
async function discoverFromStrictHit(
  venue: { name: string; city: string },
  candidate: ContactSearchResult,
  deps: ContactDeps,
): Promise<ContactHit | null> {
  const html = await deps.fetchPage(candidate.link);
  if (!html) return null;
  const url = new URL(candidate.link);
  const label = url.pathname.replace(/\/$/, "") || "/";
  return contactHitFromStrictPage(html, venue, candidate.link, label)?.hit ?? null;
}

/** Strict first-party crawl: indexed hit, fixed paths, then two same-host links. */
async function discoverFromStrictResult(
  venue: { name: string; city: string },
  candidate: ContactSearchResult,
  deps: ContactDeps,
): Promise<ContactHit | null> {
  const siteUrl = candidate.link;

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
  let discoveredCount = 0;
  for (const [url, label] of pages) {
    const html = await deps.fetchPage(url);
    if (!html) continue;
    if (discoveredCount < DISCOVERED_CONTACT_LINK_CAP) {
      for (const discoveredUrl of discoveredContactLinks(html, url, origin)) {
        if (discoveredCount >= DISCOVERED_CONTACT_LINK_CAP) break;
        if (pages.has(discoveredUrl)) continue;
        const discoveredPath = new URL(discoveredUrl).pathname.replace(/\/$/, "") || "/";
        pages.set(discoveredUrl, discoveredPath);
        discoveredCount++;
      }
    }
    const pageHit = contactHitFromStrictPage(html, venue, url, label);
    if (!pageHit) continue;
    if (pageHit.rank > bestRank) {
      best = pageHit.hit;
      bestRank = pageHit.rank;
    }
    if (bestRank >= 3) break; // events@/bookings@ found — stop fetching
  }
  return best;
}

/**
 * The per-venue hunt, DB-free for tests: one search query, at most three
 * grounded results. A direct result wins; otherwise retain only the best one
 * generic result while continuing the bounded candidate pass.
 */
export async function discoverVenueContact(
  venue: { name: string; city: string },
  deps: ContactDeps,
): Promise<ContactHit | null> {
  const results = await deps.serperSearch(contactQueryFor(venue.name, venue.city));
  const candidates = rankedContactCandidates(results, venue);
  let pageFetches = 0;
  const boundedDeps: ContactDeps = {
    ...deps,
    fetchPage: async (url) => {
      if (pageFetches >= CONTACT_PAGE_FETCH_CAP_PER_VENUE) return null;
      pageFetches++;
      return deps.fetchPage(url);
    },
  };
  let generic: ContactHit | null = null;
  let genericRank = 0;
  let strictCrawlSpent = false;

  for (const candidate of candidates) {
    let hit: ContactHit | null;
    if (candidate.kind === "strict") {
      if (strictCrawlSpent) {
        hit = await discoverFromStrictHit(venue, candidate.result, boundedDeps);
      } else {
        strictCrawlSpent = true;
        hit = await discoverFromStrictResult(venue, candidate.result, boundedDeps);
      }
    } else if (candidate.kind === "weak") {
      hit = await discoverFromWeakParentBrandResult(venue, candidate.result, boundedDeps);
    } else {
      hit = await discoverFromLooseResult(venue, candidate.result, boundedDeps);
    }
    if (!hit) continue;
    if (hit.direct === true || (hit.direct !== false && emailRank(hit.email) >= 3)) return hit;
    const rank = emailRank(hit.email);
    if (rank > genericRank) {
      generic = hit;
      genericRank = rank;
    }
  }
  return generic;
}

// ---------------------------------------------------------------------------
// Real-world deps + DB pass
// ---------------------------------------------------------------------------

export const CONTACT_PAGE_HEAD_CHAR_CAP = 140_000;
export const CONTACT_PAGE_TAIL_CHAR_CAP = 60_000;
export const CONTACT_PAGE_DECODED_CHAR_CAP = 1_000_000;
export const CONTACT_PAGE_SAMPLE_SEPARATOR = "\n<!-- bright-ears page sample boundary -->\n";
const PAGE_TIMEOUT_MS = 3_000;

function sampledPageBody(value: string): string {
  const retainedCap = CONTACT_PAGE_HEAD_CHAR_CAP + CONTACT_PAGE_TAIL_CHAR_CAP;
  if (value.length <= retainedCap) return value;
  return (
    value.slice(0, CONTACT_PAGE_HEAD_CHAR_CAP) +
    CONTACT_PAGE_SAMPLE_SEPARATOR +
    value.slice(-CONTACT_PAGE_TAIL_CHAR_CAP)
  );
}

/**
 * Stream and decode only an absolute bounded amount, then cancel. Within that
 * bound retain a deterministic head+tail sample so footer mailto/JSON-LD is not
 * lost, with an explicit separator that prevents false email splicing.
 */
async function readBoundedHtml(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let decoded = "";
  let capped = false;

  while (decoded.length < CONTACT_PAGE_DECODED_CHAR_CAP) {
    const { done, value } = await reader.read();
    if (done) break;
    const part = decoder.decode(value, { stream: true });
    const remaining = CONTACT_PAGE_DECODED_CHAR_CAP - decoded.length;
    if (part.length >= remaining) {
      decoded += part.slice(0, remaining);
      capped = true;
      break;
    }
    decoded += part;
  }

  if (capped || decoded.length >= CONTACT_PAGE_DECODED_CHAR_CAP) {
    await reader.cancel().catch(() => undefined);
  } else {
    const tail = decoder.decode();
    const remaining = CONTACT_PAGE_DECODED_CHAR_CAP - decoded.length;
    decoded += tail.slice(0, remaining);
    if (tail.length > remaining) await reader.cancel().catch(() => undefined);
  }
  return sampledPageBody(decoded);
}

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
        // metadata hosts, and re-check what the NAME actually resolves to.
        // One relative/same-host redirect is allowed for ordinary canonical
        // contact URLs; its target goes through every check again.
        const pageSignal = AbortSignal.timeout(PAGE_TIMEOUT_MS);
        const resolvesBlockedBeforeDeadline = async (hostname: string) => {
          if (pageSignal.aborted) return true;
          return Promise.race([
            resolvesToBlockedIp(hostname),
            new Promise<boolean>((resolve) => {
              pageSignal.addEventListener("abort", () => resolve(true), { once: true });
            }),
          ]);
        };
        const fetchValidated = async (
          target: string,
          redirectsRemaining: number,
        ): Promise<string | null> => {
          const parsed = new URL(target);
          if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
          if (parsed.username || parsed.password) return null;
          if (isBlockedHost(parsed.hostname)) return null;
          if (await resolvesBlockedBeforeDeadline(parsed.hostname)) return null;

          const res = await fetchFn(target, {
            headers: { Accept: "text/html" },
            signal: pageSignal,
            redirect: "manual",
          });
          if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get("location");
            if (res.body) await res.body.cancel().catch(() => undefined);
            if (redirectsRemaining === 0) return null;
            if (!location) return null;
            const redirected = new URL(location, parsed);
            if (redirected.protocol !== "https:" && redirected.protocol !== "http:") return null;
            if (redirected.username || redirected.password) return null;
            if (redirected.host.toLowerCase() !== parsed.host.toLowerCase()) return null;
            if (parsed.protocol === "https:" && redirected.protocol !== "https:") return null;
            return fetchValidated(redirected.toString(), redirectsRemaining - 1);
          }
          if (!res.ok) return null; // 403/404/5xx — skip, never retry
          const type = res.headers.get("content-type") ?? "";
          if (!type.toLowerCase().includes("text/html")) return null;
          return readBoundedHtml(res);
        };

        return await fetchValidated(url, 1);
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
  opts: {
    now?: Date;
    deps?: ContactDeps;
    gl?: string;
    limit?: number;
    wallClock?: () => number;
  } = {},
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
  const wallClock = opts.wallClock ?? Date.now;
  const passStartedAt = wallClock();

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

  let admittedVenues = 0;
  for (const venue of venues) {
    // Never interrupt a claimed venue: admission is checked only between
    // venues. Always admit one so a limit=1 backfill remains unaffected.
    if (
      admittedVenues > 0 &&
      wallClock() - passStartedAt >= CONTACT_PASS_WALL_BUDGET_MS
    ) break;
    admittedVenues++;
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
    // contactState is the persisted proof. Re-inferring from role words would
    // silently promote an explicitly-generic events@ address from a loosely
    // matched publisher on its next retry.
    const existingDirect = venue.contactState === "FOUND_DIRECT";
    const foundDirect =
      hit.direct === true || (hit.direct !== false && emailRank(email) >= 3);
    const existingRank = existingDirect
      ? 3
      : venue.bookingEmail
        ? emailRank(venue.bookingEmail)
        : -1;
    const foundRank = foundDirect ? 3 : emailRank(email);
    const useFound =
      foundRank > existingRank || (foundDirect && !existingDirect);
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
