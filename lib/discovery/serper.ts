// Live venue scanner (Phase 10.2b, ADR-004): Serper.dev → one batched LLM
// extraction → RawSignal[] for the existing ingest planner.
//
// FRUGAL BY DESIGN: queries cost real money (~$0.3-1/1k). The battery is a
// hard-capped, fixed list per metro (MAX_QUERIES_PER_METRO), and the whole
// scan makes exactly ONE LLM call (purpose "parse" — cheap flash tier).
//
// No Date.now() in here — `now` arrives via DiscoveryOpts (provider contract).

import { z } from "zod";
import { llmObject } from "@/lib/llm";
import type {
  DiscoveryOpts,
  DiscoveryProvider,
  Metro,
  RawSignal,
} from "@/lib/discovery/provider";

export type SerperEndpoint = "search" | "news" | "places";
export type BatteryQuery = { endpoint: SerperEndpoint; q: string };

/** Hard cap — a scan may NEVER fire more Serper queries than this per metro. */
export const MAX_QUERIES_PER_METRO = 10;

/**
 * The query battery: tuned for "venue that will need entertainment soon"
 * signal density (new openings, opening-soon announcements, venue hiring).
 * Exported for tests — the cap is asserted there, and enforced again at
 * runtime by the slice below.
 */
export function buildQueryBattery(metro: Metro, now: Date): BatteryQuery[] {
  const city = metro.city.trim();
  const year = now.getFullYear();
  const battery: BatteryQuery[] = [
    // /news — local press is the richest opening-signal source.
    { endpoint: "news", q: `${city} new bar opening` },
    { endpoint: "news", q: `${city} new restaurant rooftop opening` },
    { endpoint: "news", q: `${city} new venue event space` },
    // /search — roundups + announcement pages the news index misses.
    { endpoint: "search", q: `${city} new bar opening ${year} roundup` },
    { endpoint: "search", q: `"opening soon" bar ${city}` },
    { endpoint: "search", q: `${city} venue hiring bartender "opening"` },
    // /places — one cheap query for brand-new listings.
    { endpoint: "places", q: `new bars ${city}` },
  ];
  return battery.slice(0, MAX_QUERIES_PER_METRO);
}

/** One search hit, normalized across /search, /news and /places. */
export type SerperItem = {
  title: string;
  snippet: string;
  link: string;
  date?: string; // human string from Serper ("2 days ago", "May 28, 2026")
  endpoint: SerperEndpoint;
};

// --- LLM extraction schema. Two footguns with cheap models, two defenses:
//  * truly optional data (dates) is .nullish() — they return null, not omit-vs-value
//  * DECISION fields (kind, signalType) must be REQUIRED: .nullish() makes the
//    generated JSON schema optional and flash models then omit the key on
//    entire batches (observed live — a whole scan filtered to zero). Required
//    enum + .catch() sentinel = forced output, salvageable garbage.
const VENUE_KINDS = ["BAR", "ROOFTOP", "HOTEL", "RESTAURANT", "EVENT_SPACE", "CLUB", "OTHER"] as const;
const SIGNAL_TYPES = ["NEW_OPENING", "OPENING_SOON", "HIRING", "NEW_SOCIAL", "PRESS"] as const;

const candidateSchema = z.object({
  venueName: z.string(),
  kind: z.enum(VENUE_KINDS).catch("OTHER"),
  /** NONE = the model couldn't justify a signal — dropped by the filter. */
  signalType: z.enum([...SIGNAL_TYPES, "NONE"]).catch("NONE"),
  summary: z.string(),
  sourceUrl: z.string(),
  /** ISO date (YYYY-MM-DD) when the source states one; null otherwise. */
  observedAtISO: z.string().nullish(),
  confidence: z.number(),
  isInMetro: z.boolean(),
});
const extractionSchema = z.object({ candidates: z.array(candidateSchema) });
export type ExtractedCandidate = z.infer<typeof candidateSchema>;

export const MIN_CONFIDENCE = 0.6;

/**
 * Deterministic rescue for the flash tier's observed cop-out: it sometimes
 * sets signalType "NONE" on a whole batch while writing summaries that
 * literally say "opened in March" / "scheduled to open". When the summary
 * states the signal, infer it; null = genuinely uninferable (drop).
 * Order matters: "opening soon" phrasings before the bare "opened".
 */
export function inferSignalTypeFromSummary(text: string): (typeof SIGNAL_TYPES)[number] | null {
  const t = text.toLowerCase();
  if (
    /(opening|opens|set to open|scheduled to open|will open|due to open|launch(es|ing)?)\s+(soon|in|early|late|this|next|by)/.test(t) ||
    /coming soon|under construction|announced/.test(t)
  ) {
    return "OPENING_SOON";
  }
  if (/now open|newly opened|just opened|has opened|opened\b|doors open/.test(t)) return "NEW_OPENING";
  if (/hiring|recruit|vacanc|staff wanted|jobs?\b/.test(t)) return "HIRING";
  if (/new (instagram|tiktok|facebook|social)/.test(t)) return "NEW_SOCIAL";
  return null;
}

/** Listicle/roundup page titles masquerading as venue names — cheap regex guard. */
const LISTICLE_NAME = /^\d+\s|\b(best|top \d+|guide to|things to do)\b/i;
/** "Unnamed bar in Morley" etc. — a venue we can't name is not pitchable. */
const UNNAMED = /^(unnamed|unknown|new|a few|several|various|tba|untitled)\b/i;

/**
 * PURE filter over the LLM's raw candidates (unit-tested without LLM/fetch):
 * confidence gate, metro gate, listicle-name guard, dedupe by
 * (venueName, sourceUrl) keeping the highest-confidence row — multiple
 * DISTINCT sources for one venue survive (corroboration boosts the score).
 */
export function filterCandidates(
  candidates: ExtractedCandidate[],
  scanNow: Date,
  /** Optional drop-reason tally, filled in for the scan log. */
  drops?: Record<string, number>,
): RawSignal[] {
  const drop = (reason: string) => {
    if (drops) drops[reason] = (drops[reason] ?? 0) + 1;
  };
  const seen = new Map<string, { confidence: number; index: number }>();
  const out: RawSignal[] = [];
  for (let c of candidates) {
    if (!c.venueName?.trim()) {
      drop("missing_name");
      continue;
    }
    if (c.signalType === "NONE") {
      const inferred = inferSignalTypeFromSummary(c.summary ?? "");
      if (!inferred) {
        drop("no_clear_signal");
        continue;
      }
      c = { ...c, signalType: inferred };
      drop("rescued_from_none"); // tallied for the log; candidate continues
    }
    if (c.confidence < MIN_CONFIDENCE) {
      drop("low_confidence");
      continue;
    }
    if (!c.isInMetro) {
      drop("out_of_metro");
      continue;
    }
    if (LISTICLE_NAME.test(c.venueName.trim()) || UNNAMED.test(c.venueName.trim())) {
      drop("listicle_or_unnamed");
      continue;
    }
    if (!/^https?:\/\//i.test(c.sourceUrl ?? "")) {
      drop("bad_url");
      continue;
    }

    const key = `${c.venueName.trim().toLowerCase()}|${c.sourceUrl}`;
    const prev = seen.get(key);
    if (prev) {
      if (c.confidence > prev.confidence) {
        out[prev.index] = toRawSignal(c, scanNow);
        seen.set(key, { confidence: c.confidence, index: prev.index });
      }
      continue;
    }
    seen.set(key, { confidence: c.confidence, index: out.length });
    out.push(toRawSignal(c, scanNow));
  }
  return out;
}

function toRawSignal(c: ExtractedCandidate, scanNow: Date): RawSignal {
  let observedAt: Date | undefined;
  if (c.observedAtISO) {
    const d = new Date(c.observedAtISO);
    if (!Number.isNaN(d.getTime())) observedAt = d;
  }
  return {
    venueName: c.venueName.trim(),
    kindGuess: c.kind,
    type: c.signalType as Exclude<typeof c.signalType, "NONE">,
    summary: c.summary.trim().slice(0, 140),
    sourceUrl: c.sourceUrl,
    ...(observedAt ? { observedAt } : {}),
  };
}

export function buildExtractionSystem(metro: Metro, now: Date): string {
  return [
    `You extract venue prospects for a performing artist's booking agent from web search results about ${metro.city} (${metro.country}).`,
    `Today is ${now.toISOString().slice(0, 10)}.`,
    `Return ONLY real, individual venues (a specific bar, rooftop, hotel, restaurant, event space or club) that are newly opened, opening soon, hiring, newly on social, or covered in the press.`,
    `Rules:`,
    `- NEVER return a listicle or roundup page itself ("10 best bars in ...") as a venue. If a roundup snippet NAMES specific venues, extract those venues (each with the roundup URL as sourceUrl). If no venue is clearly named, skip it.`,
    `- ONLY hospitality and event venues (places that could book a DJ or live act). Retail shops, fast-food chains, gyms, offices and showrooms are NOT venues — skip them.`,
    `- Skip venues you cannot NAME. Never invent placeholders like "Unnamed bar in ...".`,
    `- venueName is the venue's proper name only — no taglines, no city suffix.`,
    `- kind: classify confidently from the name and snippet (a cocktail/wine/sports bar = BAR, a rooftop bar/terrace = ROOFTOP, nightclub = CLUB, restaurant/cafe/bistro = RESTAURANT, hotel = HOTEL, function/event/wedding space or food hall = EVENT_SPACE). Use OTHER only when genuinely unclassifiable.`,
    `- summary: max 140 characters, factual, and include WHEN it opened/opens if the snippet says so.`,
    `- observedAtISO: the publish/opening date as YYYY-MM-DD when stated or clearly derivable from the result's date; otherwise null.`,
    `- isInMetro: true only if the venue is in or immediately around ${metro.city}. Results about other cities: isInMetro false.`,
    `- confidence: 0-1 that this is a real single venue with the stated signal. Be conservative — vague or ambiguous snippets get < 0.6.`,
    `- signalType: NEW_OPENING (just opened), OPENING_SOON (announced/under construction/launching), HIRING (staffing up), NEW_SOCIAL (brand-new social account), PRESS (other coverage). Use NONE only when no signal clearly applies.`,
    `- Include EVERY field on EVERY candidate.`,
    `- One candidate per (venue, source URL). The same venue across different URLs = multiple candidates.`,
  ].join("\n");
}

export function buildExtractionPrompt(items: SerperItem[]): string {
  const lines = items.map(
    (it, i) =>
      `${i + 1}. [${it.endpoint}] ${it.title}\n   ${it.snippet}\n   url: ${it.link}${it.date ? `\n   date: ${it.date}` : ""}`,
  );
  return `Search results:\n\n${lines.join("\n\n")}\n\nExtract the venue candidates.`;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type SerperProviderDeps = {
  apiKey?: string;
  /** Injectable for tests — never hits google.serper.dev in unit tests. */
  fetchFn?: typeof fetch;
};

export class SerperDiscoveryProvider implements DiscoveryProvider {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  /** Cumulative Serper queries fired by this instance (scan budget ledger). */
  queriesUsed = 0;

  constructor(deps: SerperProviderDeps = {}) {
    this.apiKey = deps.apiKey ?? process.env.SERPER_API_KEY ?? "";
    this.fetchFn = deps.fetchFn ?? fetch;
  }

  async searchVenueSignals(metro: Metro, opts: DiscoveryOpts): Promise<RawSignal[]> {
    if (!this.apiKey) throw new Error("SERPER_API_KEY is not set — cannot run a live scan");
    const battery = buildQueryBattery(metro, opts.now).slice(0, MAX_QUERIES_PER_METRO);
    const gl = metro.country.trim().toLowerCase();

    const items: SerperItem[] = [];
    for (const q of battery) {
      this.queriesUsed++;
      try {
        items.push(...(await this.serperQuery(q, gl)));
      } catch (err) {
        // One failed query never kills the scan — log and move on. Never retry
        // (a retry is a second billable query).
        console.error(`serper ${q.endpoint} query failed: "${q.q}"`, err);
      }
    }

    let accepted: RawSignal[] = [];
    let candidateCount = 0;
    let attempts = 0;
    let drops: Record<string, number> = {};
    // The flash tier sometimes omits the decision fields on an ENTIRE batch
    // (observed live: every candidate caught to NONE). One retry of the LLM
    // call reuses the already-paid Serper results — pennies, no new queries.
    while (items.length > 0 && attempts < 2) {
      attempts++;
      drops = {};
      const { candidates } = await llmObject({
        purpose: "parse",
        businessId: opts.businessId ?? null,
        system: buildExtractionSystem(metro, opts.now),
        prompt: buildExtractionPrompt(items),
        schema: extractionSchema,
      });
      candidateCount = candidates.length;
      accepted = filterCandidates(candidates, opts.now, drops);
      // Zero accepted out of a non-empty batch = the model probably broke the
      // format wholesale (observed live). One retry; never more.
      const batchBroken = candidateCount > 0 && accepted.length === 0;
      if (!batchBroken) break;
      console.error(
        `extraction batch broken for ${metro.city} (attempt ${attempts}) — sample:`,
        JSON.stringify(candidates.slice(0, 3)),
      );
    }

    console.log(
      JSON.stringify({
        kind: "discovery_scan",
        city: metro.city,
        queries: battery.length,
        results: items.length,
        candidates: candidateCount,
        accepted: accepted.length,
        attempts,
        drops,
      }),
    );
    return accepted;
  }

  private async serperQuery(q: BatteryQuery, gl: string): Promise<SerperItem[]> {
    const res = await this.fetchFn(`https://google.serper.dev/${q.endpoint}`, {
      method: "POST",
      headers: { "X-API-KEY": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: q.q, gl, num: 10 }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`serper /${q.endpoint} HTTP ${res.status}`);
    const data = (await res.json()) as {
      organic?: { title?: string; snippet?: string; link?: string; date?: string }[];
      news?: { title?: string; snippet?: string; link?: string; date?: string }[];
      places?: { title?: string; address?: string; category?: string; website?: string }[];
    };

    const items: SerperItem[] = [];
    for (const r of data.organic ?? data.news ?? []) {
      if (!r.title || !r.link) continue;
      items.push({
        title: r.title,
        snippet: r.snippet ?? "",
        link: r.link,
        ...(r.date ? { date: r.date } : {}),
        endpoint: q.endpoint,
      });
    }
    for (const p of data.places ?? []) {
      if (!p.title || !p.website) continue; // no website = nothing pitchable to cite
      items.push({
        title: p.title,
        snippet: [p.category, p.address].filter(Boolean).join(" — "),
        link: p.website,
        endpoint: "places",
      });
    }
    return items;
  }
}
