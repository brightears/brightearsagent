// Venue-pitch generator (Phase 10.3, ADR-004) — mirrors drafter.ts: pure
// prompt assembly + zod schema + deterministic post-normalization, with the
// LLM call isolated behind lib/llm (per-purpose model map, LlmUsage metering).
//
// The pitch is the artist's cold introduction to a venue's booking contact.
// Hard product rules live in the prompt; the rules that MUST hold live in
// deterministic code (EPK link exactly once, white-label leak check, subject
// length). The jurisdiction footer is appended at approval time by the action
// layer — never here, never in the editable body.

import { z } from "zod";
import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { llmObject, modelFor } from "@/lib/llm";
import { appUrl } from "@/lib/app-url";
import type { VenueTemperature } from "@/lib/venues/timing";

export interface PitchBusinessProfile {
  id: string | null; // null in evals (no usage logging)
  name: string;
  ownerName: string;
  performerKind: string;
  voiceSamples?: string | null;
  headline?: string | null;
  bio?: string | null;
  genres: string[];
  eventTypes: string[];
  serviceCities: string[];
  gigTypes?: string[]; // "one-off" / "residency" — lets the pitch offer a regular slot
  riderNotes?: string | null; // how they perform & what they need — distilled into one honest line
  feeFloor?: number | null; // cents — NEVER quoted below; prefer no price at all
  feeSweetSpot?: number | null;
  reviewQuotes: string[];
  notableVenues: string[];
  /** 12.9 draw-proof: real gigs on the calendar in the last 90 days (0 = omit). */
  recentGigs90d?: number;
}

export interface PitchVenueInfo {
  name: string;
  city: string;
  country: string; // ISO-2
  kind: string; // VenueKind
  /**
   * 10.2c: temperature drives the TEMPLATE — HOT asks for a date, WARM asks
   * for a slot in an existing rotation, SEED plants the relationship with no
   * ask and NO follow-up promise. Defaults to HOT for older callers.
   */
  temperature?: VenueTemperature;
  /** Plain-language signal lines, e.g. "Rooftop bar opened May 28 per MEN". */
  signals: string[];
  /** Grounded facts proving the venue buys entertainment (10.2c, WARM/SEED). */
  entertainmentEvidence?: string[];
  fitReasons: string[];
  /**
   * Travel Mode: when set, this venue was found for a TRAVEL WINDOW — the
   * artist is visiting `city` only for these specific dates. The pitch MUST be
   * date-bounded ("I'm in Lisbon Aug 4-11") and must NEVER claim open-ended
   * availability for a travel city. Absent = a home-base hunt (normal pitch).
   */
  travelWindow?: TravelWindowContext;
}

/** A bounded availability window for a travel-city pitch (Travel Mode). */
export interface TravelWindowContext {
  city: string;
  /** Human-readable inclusive range, e.g. "August 4-11" (caller formats it). */
  dateRange: string;
}

export interface VenuePitchRequest {
  business: PitchBusinessProfile;
  venue: PitchVenueInfo;
  /** Hosted press kit URL — the proof link, must appear exactly once. */
  epkUrl: string;
  /** BCP-ish lowercase code, e.g. "en", "de". */
  language: string;
}

export interface VenuePitchResult {
  subject: string;
  body: string;
}

export const VenuePitchSchema = z.object({
  subject: z
    .string()
    .min(1)
    .describe(
      "email subject, 7 words or fewer, specific and human (e.g. 'DJ for your rooftop opening?') — no clickbait, no exclamation marks",
    ),
  body: z
    .string()
    .min(1)
    .describe("the email body, plain text, 90-150 words, no signature placeholders"),
});

/**
 * Travel Mode: format a window's inclusive date range for a pitch, e.g.
 * "August 4-11", "August 28 - September 2", "December 30, 2026 - January 2,
 * 2027". Date-only (UTC) so a window entered as "Aug 4-11" reads exactly that
 * regardless of server tz. Same-day windows collapse to a single date.
 */
export function formatTravelDateRange(
  start: Date,
  end: Date,
  referenceDate = new Date(),
): string {
  const month = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const day = (d: Date) => d.getUTCDate();
  const year = (d: Date) => d.getUTCFullYear();
  const sameYear = year(start) === year(end);
  const includeSharedYear = sameYear && year(start) !== year(referenceDate);
  if (start.getTime() === end.getTime()) {
    return `${month(start)} ${day(start)}${includeSharedYear ? `, ${year(start)}` : ""}`;
  }
  if (sameYear) {
    const range =
      month(start) === month(end)
        ? `${month(start)} ${day(start)}-${day(end)}`
        : `${month(start)} ${day(start)}-${month(end)} ${day(end)}`;
    return `${range}${includeSharedYear ? `, ${year(start)}` : ""}`;
  }
  return `${month(start)} ${day(start)}, ${year(start)}-${month(end)} ${day(end)}, ${year(end)}`;
}

/** The hosted EPK link for a tenant — strict appUrl(): this link goes into
 *  outbound pitch emails, so throwing beats mailing a wrong origin. */
export function epkUrlFor(slug: string): string {
  return `${appUrl()}/epk/${slug}`;
}

// Country → primary pitch language. The action picks this ONLY when the
// business lists it in pitchLanguages; default is en. Conservative map —
// multilingual countries default to en rather than guessing.
const COUNTRY_LANGUAGE: Record<string, string> = {
  DE: "de",
  AT: "de",
  FR: "fr",
  ES: "es",
  MX: "es",
  AR: "es",
  IT: "it",
  NL: "nl",
  PT: "pt",
  BR: "pt",
  TH: "th",
  JP: "ja",
};

export function pitchLanguageFor(countryISO2: string, pitchLanguages: string[]): string {
  const wanted = COUNTRY_LANGUAGE[countryISO2.trim().toUpperCase()];
  return wanted && pitchLanguages.includes(wanted) ? wanted : "en";
}

/**
 * Only English currently has complete deterministic semantic gates for price,
 * unsupported commercial promises, firsthand claims and CTA shape. Other
 * languages remain useful drafts, but must be reviewed and sent manually.
 */
export function isVenuePitchAutoSendLanguage(language: string): boolean {
  return language.trim().toLowerCase() === "en";
}

/** Pure system-prompt assembly — the artist's voice + the hard pitch rules. */
export function buildVenuePitchSystem(req: VenuePitchRequest): string {
  const b = req.business;
  const temperature = req.venue.temperature ?? "HOT";
  const travel = req.venue.travelWindow;
  const ammo = [
    b.headline && `Headline: ${b.headline}`,
    b.bio && `Bio: ${b.bio}`,
    b.genres.length > 0 && `Genres/vibe: ${b.genres.join(", ")}`,
    b.eventTypes.length > 0 && `Plays: ${b.eventTypes.join(", ")}`,
    // Residency intent is the cheap signal that turns a "one night?" pitch into
    // a "regular slot?" pitch for bars/hotels/clubs that book ongoing rotations.
    b.gigTypes?.includes("residency") &&
      `Open to a regular residency slot, not just one-off bookings`,
    // Setup/needs let a pitch be honest about fit ("I bring my own rig, just need
    // a power outlet") — never a price (rule 6 still binds), never invented (2b).
    b.riderNotes && `Setup & needs: ${b.riderNotes}`,
    b.serviceCities.length > 0 && `Based around: ${b.serviceCities.join(", ")}`,
    b.notableVenues.length > 0 && `Rooms played: ${b.notableVenues.join(", ")}`,
    // 12.9 draw-proof: a working act is its own best evidence — grounded in
    // the artist's real calendar, never invented (rule 2b binds this too).
    (b.recentGigs90d ?? 0) >= 3 &&
      `Working schedule: ${b.recentGigs90d} booked gigs in the last 90 days`,
    b.reviewQuotes.length > 0 &&
      `What clients say:\n${b.reviewQuotes.map((q) => `- "${q}"`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `You write a COLD INTRODUCTION email to a venue's booking contact on behalf of ${b.ownerName}, who performs as ${b.name} (${b.performerKind.toLowerCase().replace(/_/g, " ")}). You ARE ${b.ownerName} — first person, their voice. A venue manager skims this in five seconds; sound like a working artist who knows their room, never like marketing.`,
    b.voiceSamples
      ? `VOICE — match the tone, warmth and phrasing of these real messages by ${b.ownerName}:\n"""${b.voiceSamples}"""`
      : `VOICE — warm, direct, professional; plain language; confident without bragging.`,
    `THE ARTIST (the only facts you may use):\n${ammo || "(minimal profile — keep it short and honest)"}`,
    `HARD RULES:`,
    // 10.2c: SEED is the shortest form — a calling card, not a pitch.
    temperature === "SEED" ? `1. Body 60-90 words. Short paragraphs.` : `1. Body 90-150 words. Short paragraphs.`,
    `2. Open by referencing the venue's specific situation from the signals given (e.g. "saw you're opening this month") — naturally, like a local who noticed, never like a database.`,
    `2b. ONLY state facts that appear in the venue facts below, and never claim firsthand experience you don't have: you have NOT visited, seen sets, watched clips, or heard anything — you READ that they're opening/hiring/in the news. "Heard you're opening the rooftop" is honest; "the launch sets looked great" is a lie that kills trust on reply. No invented platforms, dates, names, or details. Vague-but-true beats specific-but-invented, always.`,
    // Travel Mode: a date-bounded availability claim, NEVER open-ended. The
    // artist is only in this city for the window — say so plainly.
    travel
      ? `2c. TRAVEL: you do NOT live in ${travel.city} — you are visiting only on these dates: ${travel.dateRange}. Say so naturally and early (e.g. "I'm in ${travel.city} ${travel.dateRange}"). NEVER claim open-ended or ongoing availability there, never imply you're local, and only offer to play within those dates. The whole point is a date-specific guest spot while you're in town.`
      : null,
    `3. Exactly ONE concrete value line: what their specific crowd gets when this act plays their room. Where the artist facts include rooms played, a working schedule, or a client quote, you may weave ONE of them in as draw-proof — never more than one, never invented.`,
    `4. Include this link EXACTLY ONCE as the proof, presented as a one-page look at the act: ${req.epkUrl}`,
    // 10.2c: the CTA shape follows the temperature (the TASK section in the
    // user prompt carries the detail; this rule keeps the count at ONE).
    temperature === "HOT"
      ? `5. End with ONE low-friction call to action — a short call, or an offer like "shall I hold a date?". Never two asks.`
      : temperature === "WARM"
        ? `5. End with ONE low-friction call to action — ask whether they would consider a guest/trial slot when it suits their calendar, or simply keeping the one-pager on file. Never offer free work, discounts, contingent terms or performance guarantees. Never ask to hold a specific date, and never two asks.`
        : `5. End with NO call to action beyond "file me away for when you need entertainment" — no call, no meeting, no date, and NEVER a promise to follow up.`,
    `6. NEVER mention prices, fees or rates in this first email — pricing comes when they reply.`,
    `7. Never mention AI, software, automation, agents or assistants, or any company or brand other than the artist's own business. You are simply ${b.ownerName} writing.`,
    `8. Subject line: 7 words or fewer, specific to this venue. No exclamation marks anywhere; no "I hope this finds you well"; no placeholder brackets like [date].`,
    `9. Sign off with the artist's first name and act name.`,
    `10. Write the entire email in this language: ${req.language}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The temperature-specific TASK section (10.2c). Exported for tests — the
 * template choice is a product decision and must be assertable.
 * - HOT: the current behavior — they're deciding entertainment NOW; close
 *   with a date-shaped ask ("shall I hold a date?").
 * - WARM: they already buy entertainment but posted no need — an introduction
 *   that references their EXISTING program (grounding rule 2b: evidence facts
 *   only) and asks for a place in the rotation / the one-pager on file.
 * - SEED: relationship planting — shortest (60-90 words), pure introduction
 *   for future reference, explicitly NO ask beyond "file me away", and NEVER
 *   a promise to follow up (the no-follow-up guard enforces this in code).
 */
export function buildPitchTask(temperature: VenueTemperature): string {
  switch (temperature) {
    case "WARM":
      return [
        `TASK: write an INTRODUCTION email to this venue's booking contact. They already book entertainment (see the evidence above) but have NOT posted any need — do not pretend they did.`,
        `- Open by referencing their EXISTING entertainment program, using ONLY the evidence facts above (e.g. "saw you run Friday DJ sets").`,
        `- Be plainly honest that this is an introduction for their roster/future slots, not a response to anything.`,
        `- The single call to action: ask whether they would consider one guest/trial slot when it suits their calendar. This is only a scheduling question — never offer it for free, never call it "no-risk", never make pay contingent on results, and never promise revenue, profit, crowd size or sales. If a trial slot does not fit this venue's evidence (e.g. a wedding venue), ask them to keep the one-pager on file instead. One sentence, zero pressure, no specific date.`,
      ].join("\n");
    case "SEED":
      return [
        `TASK: write the SHORTEST possible introduction email (60-90 words total) to this contact, purely so they know the act exists when they next need wedding/event entertainment.`,
        `- No ask beyond "file me away for when you need entertainment" — do not request a call, a meeting, a date, or a reply.`,
        `- NEVER promise to follow up, check back, or touch base — this is a one-time introduction.`,
        `- Tone: polite, brief, zero pressure.`,
      ].join("\n");
    default:
      return `TASK: write the first pitch email to this venue's booking contact.`;
  }
}

/** Pure user-prompt assembly — the venue facts + the temperature's task. */
export function buildVenuePitchPrompt(req: VenuePitchRequest): string {
  const v = req.venue;
  const evidence = v.entertainmentEvidence ?? [];
  const travel = v.travelWindow;
  return [
    `THE VENUE:`,
    `Name: ${v.name}`,
    `City: ${v.city}, ${v.country}`,
    `Type: ${v.kind.toLowerCase().replace(/_/g, " ")}`,
    // Travel Mode: the bounded dates the artist is in town — the pitch is for a
    // guest spot within this window, never an open-ended availability claim.
    travel
      ? `TRAVEL WINDOW: you are visiting ${travel.city} only on ${travel.dateRange}. Offer a guest spot within these exact dates — never ongoing availability.`
      : "",
    v.signals.length > 0 ? `What we know (signals):\n${v.signals.map((s) => `- ${s}`).join("\n")}` : "",
    evidence.length > 0
      ? `Their entertainment program (verified facts — the ONLY program claims you may reference):\n${evidence.map((e) => `- ${e}`).join("\n")}`
      : "",
    v.fitReasons.length > 0 ? `Why this room fits:\n${v.fitReasons.map((r) => `- ${r}`).join("\n")}` : "",
    ``,
    buildPitchTask(v.temperature ?? "HOT"),
  ]
    .filter(Boolean)
    .join("\n");
}

// White-label LAW (CLAUDE.md rule 7): if any of these surface in copy a venue
// would read, the generation is invalid — regenerate once, then fail loudly.
const LEAK_PATTERN =
  /\bA\.?I\.?\b|artificial intelligence|\bassistants?\b|\bbots?\b|automat(?:ed|ion|ically)|bright\s*ears|language model|\bLLM\b|\bchatbot\b/i;

/**
 * The leaked token, or null when the copy is clean. The EPK URL is excised
 * before matching — it legitimately contains "brightears" in its hostname
 * (the interim hosted-EPK domain) and must never count as a leak.
 */
export function detectLeak(result: VenuePitchResult, epkUrl?: string): string | null {
  let text = `${result.subject}\n${result.body}`;
  if (epkUrl) text = text.split(epkUrl).join(" ");
  const match = text.match(LEAK_PATTERN);
  return match ? match[0] : null;
}

// SEED sequencing law (10.2c): one polite intro, then silence — a re-touch is
// allowed only after 180 days (re-touch engine deferred). Any follow-up
// promise in a SEED pitch is therefore a lie. Deterministic guard, same
// pattern as the white-label leak check.
const FOLLOW_UP_PATTERN =
  /follow(?:ing)?[ -]up|i'?ll (?:check|circle|chase|be in touch|reach out again|get back)|check back|touch base|circle back|speak soon|talk soon|follow along/i;

/** The follow-up promise found in a SEED pitch, or null when clean. */
export function detectFollowUpPromise(result: VenuePitchResult): string | null {
  const match = `${result.subject}\n${result.body}`.match(FOLLOW_UP_PATTERN);
  return match ? match[0] : null;
}

/**
 * Remove an echoed subject label the model sometimes prepends to the body.
 *
 * THREE shapes, all seen live with deepseek-v4-pro:
 *   A) "Subject: Rooftop soundtrack\n\nHeard you're opening..."      newline-delimited
 *   B) "Subject: ... (5 words, no exclamation ...). Body: Heard ..."  ALL ONE LINE
 *   C) "Subject: Cabaret for Maré / Hello — ..."                      slash-delimited
 *
 * The original guard was /^subject:[^\n]*\n+/i, which requires a trailing
 * newline and therefore silently did NOTHING to shape B. On 2026-07-30 that
 * shipped the model's entire rubric — "Word count: ~100. No prices, no
 * exclamation marks, ... sign-off with first name and act name." — into a real
 * pitch, from the artist's own Gmail. Shape B is now handled by cutting to the
 * "Body:" label.
 *
 * Never returns empty: the schema only enforces body.min(1), so a strip that
 * consumed everything would produce a blank email, which is worse than the
 * label it removed. Shape A therefore still requires the newline.
 */
export function stripEchoedSubject(body: string): string {
  const t = body.trim();
  // Shape B first — the more specific match.
  const labelled = t.match(/^\s*subject\s*:[\s\S]*?\bbody\s*:\s*/i);
  if (labelled) {
    const rest = t.slice(labelled[0].length).trim();
    if (rest) return rest;
  }
  // Shape C: the model sometimes uses a slash as the field delimiter. Require
  // a normal email opener after the slash so a subject containing "/" is not
  // cut at the wrong place. The lazy prefix can backtrack to a later slash
  // when the echoed subject itself contains one.
  const slashDelimited = t.match(
    /^\s*subject\s*:[\s\S]{1,200}?\s*\/\s*((?:hello|hi|hey|dear|good (?:morning|afternoon|evening)|saw|heard|noticed|i(?:['’]m| am)|we(?:['’]re| are))\b[\s\S]+)$/i,
  );
  if (slashDelimited?.[1]?.trim()) return slashDelimited[1].trim();
  const stripped = t.replace(/^\s*subject\s*:[^\n]*\n+/i, "").trim();
  return stripped || t;
}

// SPEC-LEAK LAW: the model echoing its OWN instructions into copy a venue would
// read. Third guard of the same shape as the white-label and follow-up checks,
// because this is the same class of failure — the generation is invalid, not
// merely untidy, and a partially-stripped rubric is still unsendable.
//
// Live incident 2026-07-30: a real pitch went out containing "(5 words, no
// exclamation, specific to venue: ...", "Body:", "Word count: ~100", "no
// invented details, one concrete value line, link exactly once, low-friction
// CTA, sign-off with first name and act name" — a paraphrase of rules 2b/3/4/5/8
// in buildVenuePitchSystem. Stripping is not enough: the tokens appear THROUGHOUT
// the body, not just as a prefix.
//
// Tokens are drawn from our own rubric vocabulary AND the model's paraphrases of
// it. Deliberately narrow: every entry is language no artist would ever write to
// a venue, so a false positive costs one cheap regeneration, while a false
// negative costs the artist's credibility with a prospect.
const SPEC_LEAK_PATTERN =
  /\bword count\b|\bno exclamation\b|\bexclamation marks?\b|\bno clickbait\b|\blow[- ]?friction\b|\bcall to action\b|\bCTA\b|\bconcrete value line\b|\blink\s+exactly\s+once\b|\b(?:no|never) invented\b|\binvented details\b|\bsign-?off with\b|\bplaceholder brackets?\b|\bbody\s*:|\b\d+\s+words\b|\bspecific to (?:this )?venue\b/i;

/**
 * The echoed instruction found in the copy, or null when clean.
 *
 * An echoed LEADING "Subject:" line is excluded: that is a formatting slip which
 * stripEchoedSubject repairs, and has been repaired silently for months. Making
 * it a hard failure would start refusing pitches that were previously fine. The
 * rubric itself is a different matter, and so is a "Body:" label surviving
 * anywhere in the copy.
 */
export function detectSpecLeak(result: VenuePitchResult): string | null {
  const text = `${result.subject}\n${stripEchoedSubject(result.body)}`;
  const match = text.match(SPEC_LEAK_PATTERN);
  return match ? match[0] : null;
}

const MAX_SUBJECT_WORDS = 7;
const HTTP_URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;

function canonicalizeHostedEpkLinks(body: string, canonicalUrl: string): string {
  let canonicalPath: string;
  try {
    canonicalPath = new URL(canonicalUrl).pathname.replace(/\/+$/, "");
  } catch {
    return body;
  }
  return body.replace(HTTP_URL_PATTERN, (matched) => {
    const clean = matched.replace(/[.,;:!?]+$/, "");
    const punctuation = matched.slice(clean.length);
    try {
      const path = new URL(clean).pathname.replace(/\/+$/, "");
      return path === canonicalPath ? `${canonicalUrl}${punctuation}` : matched;
    } catch {
      return matched;
    }
  });
}

function identityComparable(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, " ")
    .trim();
}

function canonicalPitchSignoff(req: VenuePitchRequest): string {
  const owner = req.business.ownerName?.trim() ?? "";
  const firstName = owner.split(/\s+/)[0] || req.business.name?.trim() || "";
  const actName = req.business.name?.trim() ?? "";
  if (!firstName) return actName;
  if (!actName) return firstName;
  return `${firstName} — ${actName}`;
}

function isSignatureBlock(req: VenuePitchRequest, block: string): boolean {
  const owner = req.business.ownerName?.trim() ?? "";
  const firstName = owner.split(/\s+/)[0] || req.business.name?.trim() || "";
  const actName = req.business.name?.trim() ?? "";
  let normalized = identityComparable(block);
  for (const closing of [
    "all the best",
    "best regards",
    "kind regards",
    "warm regards",
    "thank you",
    "thanks",
    "cheers",
    "regards",
    "warmly",
    "best",
  ]) {
    if (normalized.startsWith(`${closing} `)) {
      normalized = normalized.slice(closing.length).trim();
      break;
    }
  }
  const allowed = [
    firstName,
    owner,
    actName,
    `${firstName} ${actName}`,
    `${owner} ${actName}`,
  ]
    .map(identityComparable)
    .filter(Boolean);
  return !!normalized && allowed.includes(normalized);
}

/** Replace zero, partial or repeated trailing signatures with one stable form. */
function ensureCanonicalSignoff(req: VenuePitchRequest, body: string): string {
  const canonical = canonicalPitchSignoff(req);
  if (!canonical) return body.trim();

  let lines = body.trim().split(/\r?\n/);
  // A model may return "Best,\nMaya\nSapphire Sounds", only "Maya", or even
  // the same signature twice. Remove only a short signature-shaped suffix;
  // names appearing naturally in the introduction remain untouched.
  while (lines.length > 0) {
    let cutAt = -1;
    for (let index = Math.max(0, lines.length - 4); index < lines.length; index++) {
      if (isSignatureBlock(req, lines.slice(index).join("\n").trim())) {
        cutAt = index;
        break;
      }
    }
    if (cutAt < 0) break;
    lines = lines.slice(0, cutAt);
    while (lines.at(-1)?.trim() === "") lines.pop();
  }

  const content = lines.join("\n").trim();
  return content ? `${content}\n\n${canonical}` : canonical;
}

/**
 * Deterministic normalization (the normalizeStatement discipline): the rules
 * that MUST hold are enforced in code, not trusted to the model.
 * - EPK link appears EXACTLY once: inject before the sign-off if dropped;
 *   strip duplicates if repeated.
 * - End with exactly one canonical first-name + act-name sign-off.
 * - Subject: collapse whitespace, strip exclamation marks, cap at 7 words.
 * - Strip an echoed "Subject: …" line the model sometimes prepends to the body
 *   (seen live with deepseek-v4-pro).
 */
export function normalizeVenuePitch(req: VenuePitchRequest, result: VenuePitchResult): VenuePitchResult {
  // Legacy drafts can contain the correct /epk/{slug} path on an old Render or
  // localhost origin. Canonicalize that exact path before enforcing one link so
  // a deployment-host change cannot leave two press-kit links in a sent email.
  let body = canonicalizeHostedEpkLinks(stripEchoedSubject(result.body), req.epkUrl);

  // EPK link exactly once.
  const occurrences = body.split(req.epkUrl).length - 1;
  if (occurrences === 0) {
    // Inject as its own line before the final paragraph (the sign-off) so the
    // proof lands ahead of the goodbye; append when there's only one block.
    const proofLine = `Here's a one-page look at what I do: ${req.epkUrl}`;
    const paragraphs = body.split(/\n\n+/);
    if (paragraphs.length >= 2) {
      paragraphs.splice(paragraphs.length - 1, 0, proofLine);
      body = paragraphs.join("\n\n");
    } else {
      body = `${body}\n\n${proofLine}`;
    }
  } else if (occurrences > 1) {
    // Keep the first occurrence; drop the rest (and tidy emptied lines).
    const [first, ...rest] = body.split(req.epkUrl);
    body = (first + req.epkUrl + rest.join("")).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  }

  body = ensureCanonicalSignoff(req, body);

  let subject = result.subject.replace(/\s+/g, " ").replace(/!/g, "").trim();
  const words = subject.split(" ");
  if (words.length > MAX_SUBJECT_WORDS) {
    subject = words.slice(0, MAX_SUBJECT_WORDS).join(" ").replace(/[,;:–—-]+$/, "");
  }

  return { subject, body };
}

const PITCH_PLACEHOLDER =
  /\[[a-z][a-z _-]{1,40}\]|\{\{[^}]{1,50}\}\}|<\s*(?:name|date|venue|price|link)\s*>/i;
const PRICE_OR_RATE =
  /(?:[\$£€฿¥₹₩₫₱₽]\s*\d|\b(?:USD|GBP|EUR|THB|JPY|CAD|AUD)\s*\d|\b(?:price|pricing|fees?|rates?)\b)/i;
const UNAUTHORIZED_TERMS =
  /\b(?:no[- ]risk|free (?:set|night|show|performance|trial|gig)|at no cost|on the house|profit if|better numbers|revenue guarantee|guaranteed (?:crowd|sales|revenue|profit))\b/i;
const FIRSTHAND_CLAIM =
  /\b(?:i(?:['’]ve| have) (?:been\s+(?:(?:to|inside)\s+(?:your|the|this|that)\s+(?:venue|room|space|bar|club|hotel|restaurant|rooftop|lounge)|at\s+(?:your|the|this|that)\s+(?:venue|room|space|bar|club|hotel|restaurant|rooftop|lounge))|visited\s+(?:your|the|this|that)\s+(?:venue|room|space|bar|club|hotel|restaurant|rooftop|lounge)|(?:seen|watched)\s+(?:your|the|this|that)\s+(?:[a-z0-9'’-]+\s+){0,3}(?:sets?|shows?|clips?|videos?|venue|room|space|crowd|events?|nights?)|heard\s+(?:your|the|this|that)\s+(?:[a-z0-9'’-]+\s+){0,3}(?:sets?|shows?|music|sound|crowd))|i (?:saw|watched|heard) (?:your|the|this|that) (?:[a-z0-9'’-]+\s+){0,3}(?:sets?|shows?|clips?|videos?|music|sound|venue|room|space|crowd|events?|nights?)|i love your|caught (?:a|your) set|stopped by|when i was at)\b/i;
const WARM_FALSE_NEED =
  /\b(?:you(?:'re| are) (?:looking|searching|booking now)|you (?:need|requested|asked for)|your (?:request|job post|listing)|saw your (?:post|ad|request))\b/i;

function claimsFirsthandVenueExperience(body: string, venueName: string): boolean {
  if (FIRSTHAND_CLAIM.test(body)) return true;
  const escapedName = venueName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escapedName) return false;
  const namedVisit = new RegExp(
    `\\bi(?:['’]ve| have)\\s+(?:been\\s+(?:to|at|inside)|visited)\\s+(?:the\\s+)?${escapedName}\\b`,
    "i",
  );
  const namedContent = new RegExp(
    `\\bi(?:(?:['’]ve| have)\\s+|\\s+)(?:saw|seen|watched|heard)\\s+(?:the\\s+)?${escapedName}['’]s\\s+(?:[a-z0-9'’-]+\\s+){0,3}(?:sets?|shows?|clips?|videos?|music|sound|crowd|events?|nights?)\\b`,
    "i",
  );
  return namedVisit.test(body) || namedContent.test(body);
}

function pitchLength(
  body: string,
  language: string,
  temperature: VenueTemperature,
): { value: number; min: number; max: number; unit: "word" | "character" } {
  const normalizedLanguage = language.trim().toLowerCase();
  if (normalizedLanguage === "th" || normalizedLanguage === "ja") {
    // Thai does not delimit every word with spaces; Japanese generally does
    // not delimit words at all. Count script characters (including combining
    // marks), excluding the proof URL, instead of pretending one paragraph is
    // one word. Bounds are deliberately broad because these drafts are manual
    // review only at launch.
    const text = body.replace(HTTP_URL_PATTERN, " ");
    const value = [...text.matchAll(/[\p{L}\p{M}\p{N}]/gu)].length;
    return temperature === "SEED"
      ? { value, min: 50, max: 500, unit: "character" }
      : { value, min: 80, max: 900, unit: "character" };
  }
  const value = body.trim() ? body.trim().split(/\s+/).length : 0;
  return temperature === "SEED"
    ? { value, min: 25, max: 110, unit: "word" }
    : { value, min: 40, max: 170, unit: "word" };
}

function isCallToActionUnit(line: string): boolean {
  return (
    /[?？]/.test(line) ||
    /\b(?:let me know|keep me on file|file me away|open to|would you|could we|can we|shall i|happy to chat|worth a quick call)\b/i.test(
      line,
    )
  );
}

function callToActionCount(body: string): number {
  return body
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isCallToActionUnit).length;
}

function canonicalCallToAction(temperature: VenueTemperature): string {
  switch (temperature) {
    case "WARM":
      return "Would you consider keeping my one-page profile on file for a future slot?";
    case "SEED":
      return "Please file me away for when you next need entertainment.";
    default:
      return "Shall I hold a suitable date for you?";
  }
}

/**
 * Last-resort English CTA repair after the model has already had its one
 * corrective generation. Remove every conservatively detected ask and insert
 * one temperature-safe fallback; all other validators run again afterwards.
 */
function normalizeEnglishCallToAction(
  req: VenuePitchRequest,
  result: VenuePitchResult,
): VenuePitchResult {
  if (!isVenuePitchAutoSendLanguage(req.language) || callToActionCount(result.body) === 1) {
    return result;
  }

  const canonicalSignoff = canonicalPitchSignoff(req);
  const signedBody = ensureCanonicalSignoff(req, result.body);
  const paragraphs = signedBody.split(/\n\n+/);
  if (identityComparable(paragraphs.at(-1) ?? "") === identityComparable(canonicalSignoff)) {
    paragraphs.pop();
  }

  const content = paragraphs
    .map((paragraph) =>
      paragraph
        .split(/\n+/)
        .flatMap((line) => line.split(/(?<=[.!?])\s+/))
        .map((unit) => unit.trim())
        .filter(Boolean)
        .filter((unit) => !isCallToActionUnit(unit))
        .join(" "),
    )
    .filter(Boolean);

  return {
    ...result,
    body: [...content, canonicalCallToAction(req.venue.temperature ?? "HOT"), canonicalSignoff]
      .filter(Boolean)
      .join("\n\n"),
  };
}

const SHORT_PITCH_BRIDGE =
  "I’m keeping this introduction straightforward and focused on whether the act could suit the room.";

/**
 * Repair a near-miss after corrective generation without inventing profile or
 * venue facts. One neutral, conditional bridge is enough for the observed
 * 33-word result. If it cannot reach the existing 40-word floor by itself, the
 * candidate is too incomplete to pad safely and remains a hard failure.
 */
function repairShortEnglishVenuePitch(
  req: VenuePitchRequest,
  result: VenuePitchResult,
): VenuePitchResult {
  const temperature = req.venue.temperature ?? "HOT";
  const length = pitchLength(result.body, req.language, temperature);
  if (
    !isVenuePitchAutoSendLanguage(req.language) ||
    temperature === "SEED" ||
    length.unit !== "word" ||
    length.value >= length.min
  ) {
    return result;
  }

  const bridgeWords = SHORT_PITCH_BRIDGE.split(/\s+/).length;
  if (length.value + bridgeWords < length.min) return result;

  const signedBody = ensureCanonicalSignoff(req, result.body);
  const paragraphs = signedBody.split(/\n\n+/);
  const signoff = paragraphs.pop();
  const proofIndex = paragraphs.findIndex((paragraph) => paragraph.includes(req.epkUrl));
  const insertAt = proofIndex > 0 ? proofIndex : Math.min(1, paragraphs.length);
  paragraphs.splice(insertAt, 0, SHORT_PITCH_BRIDGE);
  if (signoff) paragraphs.push(signoff);
  return { ...result, body: paragraphs.join("\n\n") };
}

function isTransientGenerationError(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error)) return true;
  if (APICallError.isInstance(error)) return error.isRetryable;
  if (RetryError.isInstance(error)) {
    if (error.reason === "maxRetriesExceeded" || error.reason === "abort") return true;
    return isTransientGenerationError(error.lastError);
  }
  if (!(error instanceof Error)) return false;
  if (/^(?:AbortError|TimeoutError|NoObjectGeneratedError)$/i.test(error.name)) return true;
  return /\b(?:timed?\s*out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network error|fetch failed|temporarily unavailable)\b/i.test(
    error.message,
  );
}

function comparable(value: string): string {
  return value.toLowerCase().replace(/[^À-ɏa-z0-9]+/g, " ").trim();
}

function looksLikeLanguage(text: string, language: string): boolean {
  const normalizedLanguage = language.trim().toLowerCase();
  if (normalizedLanguage === "en") return true;
  if (normalizedLanguage === "th") return /[฀-๿]/.test(text);
  if (normalizedLanguage === "ja") return /[぀-ヿ㐀-鿿]/.test(text);
  const hints: Record<string, RegExp> = {
    de: /\b(?:ich|und|für|gerne|viele|mit|sie|ihr)\b/i,
    fr: /\b(?:je|et|pour|avec|vous|votre|bien|merci)\b/i,
    es: /\b(?:yo|y|para|con|usted|su|gracias|encantaría)\b/i,
    it: /\b(?:io|e|per|con|voi|vostro|grazie|piacerebbe)\b/i,
    nl: /\b(?:ik|en|voor|met|jullie|uw|graag|bedankt)\b/i,
    pt: /\b(?:eu|e|para|com|você|seu|obrigad|gostaria)\b/i,
  };
  return hints[normalizedLanguage]?.test(text) ?? true;
}

export type VenuePitchValidation = { result: VenuePitchResult; issues: string[] };

/** Pure runtime gate shared by generation, tests/evals, and the send boundary. */
export function validateVenuePitch(
  req: VenuePitchRequest,
  candidate: VenuePitchResult,
): VenuePitchValidation {
  const result = normalizeVenuePitch(req, candidate);
  const issues: string[] = [];
  const temperature = req.venue.temperature ?? "HOT";
  const combined = `${result.subject}\n${result.body}`;
  const length = pitchLength(result.body, req.language, temperature);
  const fullyValidatedLanguage = isVenuePitchAutoSendLanguage(req.language);

  const leak = detectLeak(result, req.epkUrl);
  if (leak) issues.push(`white-label leak: ${leak}`);
  const spec = detectSpecLeak(result);
  if (spec) issues.push(`instruction leak: ${spec}`);
  if (temperature === "SEED") {
    const promise = detectFollowUpPromise(result);
    if (promise) issues.push(`SEED follow-up promise: ${promise}`);
  }
  if (!result.subject.trim()) issues.push("empty subject");
  if (result.subject.trim().split(/\s+/).length > MAX_SUBJECT_WORDS) {
    issues.push("subject exceeds seven words");
  }
  if (combined.includes("!")) issues.push("contains an exclamation mark");
  if (PITCH_PLACEHOLDER.test(combined)) issues.push("contains an unresolved placeholder");
  if (PRICE_OR_RATE.test(result.body)) issues.push("mentions a price, fee, or rate");
  if (UNAUTHORIZED_TERMS.test(result.body)) {
    issues.push("offers unauthorized free, contingent, or guaranteed commercial terms");
  }
  if (claimsFirsthandVenueExperience(result.body, req.venue.name)) {
    issues.push("claims firsthand venue experience");
  }
  if (temperature === "WARM" && WARM_FALSE_NEED.test(result.body)) {
    issues.push("pretends the WARM venue posted a current need");
  }
  if (length.value < length.min || length.value > length.max) {
    issues.push(
      `body is outside the safe ${length.min}-${length.max} ${length.unit} budget (${length.value})`,
    );
  }
  const links = result.body.split(req.epkUrl).length - 1;
  if (links !== 1) issues.push(`EPK link count is ${links}, expected 1`);
  const urls = (result.body.match(HTTP_URL_PATTERN) ?? []).map((url) =>
    url.replace(/[.,;:!?]+$/, ""),
  );
  if (urls.length !== 1 || urls[0] !== req.epkUrl) {
    issues.push("body must contain the current EPK URL and no other external links");
  }
  const ctas = callToActionCount(result.body);
  if (fullyValidatedLanguage) {
    if (ctas !== 1) issues.push(`call-to-action count is ${ctas}, expected 1`);
  } else if (ctas > 1) {
    // Partial structural guard only. Delivery remains manual-review-only, so
    // absence of an English-recognizable CTA is not treated as validated.
    issues.push(`call-to-action count is ${ctas}, expected no more than 1`);
  }

  const firstName = req.business.ownerName.trim().split(/\s+/)[0];
  if (firstName && !result.body.toLowerCase().includes(firstName.toLowerCase())) {
    issues.push("missing artist first-name sign-off");
  }
  if (!result.body.toLowerCase().includes(req.business.name.toLowerCase())) {
    issues.push("missing act-name sign-off");
  }

  if (!looksLikeLanguage(result.body, req.language)) {
    issues.push(`body does not appear to be written in ${req.language}`);
  }

  const travel = req.venue.travelWindow;
  if (travel) {
    const normalizedBody = comparable(result.body);
    if (!normalizedBody.includes(comparable(travel.city))) {
      issues.push("travel pitch omits the destination city");
    }
    if (!normalizedBody.includes(comparable(travel.dateRange))) {
      issues.push("travel pitch omits the exact travel window");
    }
    const escapedCity = travel.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const falseLocal = new RegExp(
      `\\b(?:based|local|live|living)\\s+(?:in|around)\\s+${escapedCity}\\b|\\b(?:always|regularly)\\s+in\\s+${escapedCity}\\b|\\bavailable\\s+anytime\\b`,
      "i",
    );
    if (falseLocal.test(result.body)) issues.push("travel pitch falsely implies local/open-ended availability");
  }

  return { result, issues };
}

/**
 * Generate a venue pitch: LLM call → normalize + validate every hard rule →
 * one corrective regeneration → fail closed. Returns clean editable copy;
 * the jurisdiction footer remains the caller's job at approval time.
 */
export async function generateVenuePitch(
  req: VenuePitchRequest,
): Promise<VenuePitchResult & { model: string }> {
  const system = buildVenuePitchSystem(req);
  const prompt = buildVenuePitchPrompt(req);

  const callProvider = (attemptPrompt: string) =>
    llmObject<VenuePitchResult>({
      purpose: "venuePitch",
      businessId: req.business.id,
      system,
      prompt: attemptPrompt,
      schema: VenuePitchSchema,
    });
  // One outer retry budget for the whole operation. The SDK already performs
  // its own bounded retries, so this catches a single exhausted timeout or
  // malformed-object event without multiplying calls at both generation stages.
  let transientRetryAvailable = true;
  const generate = async (attemptPrompt: string) => {
    try {
      return await callProvider(attemptPrompt);
    } catch (error) {
      if (!transientRetryAvailable || !isTransientGenerationError(error)) throw error;
      transientRetryAvailable = false;
      return callProvider(attemptPrompt);
    }
  };

  let checked = validateVenuePitch(req, await generate(prompt));
  if (checked.issues.length > 0) {
    const correction = [
      prompt,
      "CORRECTION REQUIRED: the previous pitch failed these deterministic checks:",
      ...checked.issues.map((issue) => `- ${issue}`),
      "Those failures are forbidden. Return only a corrected finished email, never the checks or an explanation.",
    ].join("\n");
    checked = validateVenuePitch(req, await generate(correction));
    if (
      isVenuePitchAutoSendLanguage(req.language) &&
      checked.issues.some((issue) => issue.startsWith("call-to-action count is "))
    ) {
      checked = validateVenuePitch(req, normalizeEnglishCallToAction(req, checked.result));
    }
    if (isVenuePitchAutoSendLanguage(req.language)) {
      checked = validateVenuePitch(req, repairShortEnglishVenuePitch(req, checked.result));
    }
  }
  if (checked.issues.length > 0) {
    throw new Error(
      `venue pitch failed safety validation after regeneration: ${checked.issues.join("; ")}`,
    );
  }

  return { ...checked.result, model: modelFor("venuePitch") };
}
