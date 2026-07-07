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
import { llmObject, modelFor } from "@/lib/llm";
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
export function formatTravelDateRange(start: Date, end: Date): string {
  const month = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const day = (d: Date) => d.getUTCDate();
  const year = (d: Date) => d.getUTCFullYear();
  const sameYear = year(start) === year(end);
  // Show the year only when the range straddles years OR isn't the current one
  // — keep the common case ("August 4-11") clean; callers in a future year are
  // rare. We always include the year when the two dates differ in year.
  const startStr = sameYear
    ? `${month(start)} ${day(start)}`
    : `${month(start)} ${day(start)}, ${year(start)}`;
  if (start.getTime() === end.getTime()) return startStr;
  const endStr =
    month(start) === month(end) && sameYear
      ? `${day(end)}`
      : sameYear
        ? `${month(end)} ${day(end)}`
        : `${month(end)} ${day(end)}, ${year(end)}`;
  return `${startStr}-${endStr}`;
}

/** The hosted EPK link for a tenant — APP_URL env with the deployed fallback. */
export function epkUrlFor(slug: string): string {
  const base = process.env.APP_URL ?? "https://brightears-app.onrender.com";
  return `${base.replace(/\/$/, "")}/epk/${slug}`;
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
        ? `5. End with ONE low-friction call to action — a no-risk trial night (see TASK) or keeping the one-pager on file. Never ask to hold a specific date, and never two asks.`
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
        `- The single call to action (12.4 trial-night converter, profit-framed): offer ONE no-risk trial night on their quietest evening — frame it around THEIR take, e.g. "give me one quiet night; if the room doesn't do better numbers, that's the end of it — easy life for you, and a profit if it works". One sentence, zero pressure, no specific date. If a trial night genuinely doesn't fit this venue's evidence (e.g. a wedding venue), fall back to asking them to keep the one-pager on file.`,
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

const MAX_SUBJECT_WORDS = 7;

/**
 * Deterministic normalization (the normalizeStatement discipline): the rules
 * that MUST hold are enforced in code, not trusted to the model.
 * - EPK link appears EXACTLY once: inject before the sign-off if dropped;
 *   strip duplicates if repeated.
 * - Subject: collapse whitespace, strip exclamation marks, cap at 7 words.
 * - Strip an echoed "Subject: …" line the model sometimes prepends to the body
 *   (seen live with deepseek-v4-pro).
 */
export function normalizeVenuePitch(req: VenuePitchRequest, result: VenuePitchResult): VenuePitchResult {
  let body = result.body.trim().replace(/^subject:[^\n]*\n+/i, "");

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

  let subject = result.subject.replace(/\s+/g, " ").replace(/!/g, "").trim();
  const words = subject.split(" ");
  if (words.length > MAX_SUBJECT_WORDS) {
    subject = words.slice(0, MAX_SUBJECT_WORDS).join(" ").replace(/[,;:–—-]+$/, "");
  }

  return { subject, body };
}

/**
 * Generate a venue pitch: LLM call (purpose "venuePitch", metered) →
 * white-label leak check (regenerate ONCE on a leak, then fail loudly) →
 * deterministic normalization. Returns the clean editable copy — the
 * jurisdiction footer is the caller's job at approval time.
 */
export async function generateVenuePitch(
  req: VenuePitchRequest,
): Promise<VenuePitchResult & { model: string }> {
  const system = buildVenuePitchSystem(req);
  const prompt = buildVenuePitchPrompt(req);

  let result = await llmObject<VenuePitchResult>({
    purpose: "venuePitch",
    businessId: req.business.id,
    system,
    prompt,
    schema: VenuePitchSchema,
  });

  let leak = detectLeak(result, req.epkUrl);
  if (leak) {
    // One retry with the violation called out — cheap models occasionally slip.
    result = await llmObject<VenuePitchResult>({
      purpose: "venuePitch",
      businessId: req.business.id,
      system,
      prompt: `${prompt}\n\nIMPORTANT: your previous attempt mentioned "${leak}" — that word class is forbidden. The email must read as written personally by the artist; never reference tools, software, automation or any other brand.`,
      schema: VenuePitchSchema,
    });
    leak = detectLeak(result, req.epkUrl);
    if (leak) {
      throw new Error(`venue pitch white-label leak after regeneration: "${leak}"`);
    }
  }

  // SEED no-follow-up guard (10.2c): a promised follow-up that never comes is
  // worse than no pitch. Regenerate once, then fail loudly — same discipline
  // as the leak check.
  if ((req.venue.temperature ?? "HOT") === "SEED") {
    let promise = detectFollowUpPromise(result);
    if (promise) {
      result = await llmObject<VenuePitchResult>({
        purpose: "venuePitch",
        businessId: req.business.id,
        system,
        prompt: `${prompt}\n\nIMPORTANT: your previous attempt said "${promise}" — this is a ONE-TIME introduction; never promise any follow-up, check-in or future contact of any kind.`,
        schema: VenuePitchSchema,
      });
      promise = detectFollowUpPromise(result);
      if (promise) {
        throw new Error(`SEED pitch promised a follow-up after regeneration: "${promise}"`);
      }
    }
  }

  return { ...normalizeVenuePitch(req, result), model: modelFor("venuePitch") };
}
