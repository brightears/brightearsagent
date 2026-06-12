import { beforeEach, describe, expect, it, vi } from "vitest";

// The provider must never hit OpenRouter (or the DB via LlmUsage) in unit
// tests — same seam as venue-pitch.test.ts.
vi.mock("@/lib/llm", () => ({
  llmObject: vi.fn(),
  modelFor: vi.fn(() => "test/model"),
}));
import { llmObject } from "@/lib/llm";
import {
  buildQueryBattery,
  buildWarmQueryBattery,
  EXTRACTION_CHUNK_SIZE,
  filterCandidates,
  inferSignalTypeFromSummary,
  MAX_QUERIES_PER_METRO,
  MAX_WARM_QUERIES_PER_METRO,
  MIN_CONFIDENCE,
  reconcileTemperature,
  SerperDiscoveryProvider,
  type ExtractedCandidate,
} from "@/lib/discovery/serper";
import type { Metro } from "@/lib/discovery/provider";

const llmMock = vi.mocked(llmObject);
const NOW = new Date("2026-06-12T12:00:00Z");
const MANCHESTER: Metro = { city: "Manchester", country: "GB" };

const candidate = (over: Partial<ExtractedCandidate> = {}): ExtractedCandidate => ({
  venueName: "The Vault",
  kind: "BAR",
  signalType: "NEW_OPENING",
  temperature: "HOT",
  summary: "Cocktail bar opened on Deansgate in June 2026",
  entertainmentEvidence: [],
  contactName: null,
  contactRole: null,
  sourceUrl: "https://news.example/the-vault-opens",
  observedAtISO: null,
  confidence: 0.9,
  isInMetro: true,
  ...over,
});

beforeEach(() => {
  llmMock.mockReset();
});

describe("buildQueryBattery", () => {
  it(`is hard-capped at ${MAX_QUERIES_PER_METRO} queries per metro`, () => {
    const battery = buildQueryBattery(MANCHESTER, NOW);
    expect(battery.length).toBeLessThanOrEqual(MAX_QUERIES_PER_METRO);
    expect(battery.length).toBeGreaterThan(0);
  });

  it("targets the metro across news, search and places endpoints", () => {
    const battery = buildQueryBattery(MANCHESTER, NOW);
    expect(battery.every((b) => b.q.includes("Manchester"))).toBe(true);
    const endpoints = new Set(battery.map((b) => b.endpoint));
    expect(endpoints).toEqual(new Set(["news", "search", "places"]));
    // The year comes from the scan clock, never Date.now().
    expect(battery.some((b) => b.q.includes("2026"))).toBe(true);
  });
});

describe("filterCandidates", () => {
  it(`drops candidates below confidence ${MIN_CONFIDENCE}`, () => {
    const out = filterCandidates([candidate({ confidence: 0.5 }), candidate({ confidence: 0.6 })], NOW);
    expect(out).toHaveLength(1);
  });

  it("drops candidates outside the metro", () => {
    expect(filterCandidates([candidate({ isInMetro: false })], NOW)).toHaveLength(0);
  });

  it("drops listicle titles, unnamed placeholders, null signalTypes and bad urls", () => {
    const out = filterCandidates(
      [
        candidate({ venueName: "10 best bars in Manchester" }),
        candidate({ venueName: "The Best New Rooftops Guide" }),
        candidate({ venueName: "Unnamed bar in Morley" }),
        candidate({ signalType: "NONE", summary: "A bar in the Northern Quarter" }), // no inferable signal
        candidate({ venueName: "  " }),
        candidate({ sourceUrl: "not-a-url" }),
      ],
      NOW,
    );
    expect(out).toHaveLength(0);
  });

  it("dedupes by (venueName, sourceUrl) keeping the higher confidence, but keeps distinct sources", () => {
    const out = filterCandidates(
      [
        candidate({ confidence: 0.7, summary: "low-confidence row" }),
        candidate({ confidence: 0.95, summary: "high-confidence row" }),
        candidate({ venueName: "the vault", sourceUrl: "https://other.example/roundup" }), // same venue, new source
      ],
      NOW,
    );
    expect(out).toHaveLength(2);
    expect(out[0].summary).toBe("high-confidence row");
  });

  it("clamps summaries to 140 chars and parses observedAtISO", () => {
    const out = filterCandidates(
      [candidate({ summary: "x".repeat(200), observedAtISO: "2026-06-01" })],
      NOW,
    );
    expect(out[0].summary).toHaveLength(140);
    expect(out[0].observedAt?.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("ignores an unparseable observedAtISO instead of crashing", () => {
    const out = filterCandidates([candidate({ observedAtISO: "next summer" })], NOW);
    expect(out[0].observedAt).toBeUndefined();
  });

  it("rescues NONE signalTypes from summaries that state the signal (observed flash cop-out)", () => {
    const out = filterCandidates(
      [
        candidate({ signalType: "NONE", summary: "Opened in March 2026 as part of a roundup" }),
        candidate({ venueName: "Convene", signalType: "NONE", summary: "Scheduled to open early March 2026", sourceUrl: "https://x.example/2" }),
        candidate({ venueName: "Staffed", signalType: "NONE", summary: "Hiring bar staff for launch", sourceUrl: "https://x.example/3" }),
        candidate({ venueName: "Mystery", signalType: "NONE", summary: "A nice place", sourceUrl: "https://x.example/4" }),
      ],
      NOW,
    );
    expect(out.map((s) => s.type)).toEqual(["NEW_OPENING", "OPENING_SOON", "HIRING"]); // Mystery dropped
  });
});

describe("inferSignalTypeFromSummary", () => {
  it("orders opening-soon phrasings before the bare 'opened'", () => {
    expect(inferSignalTypeFromSummary("Set to open in late summer")).toBe("OPENING_SOON");
    expect(inferSignalTypeFromSummary("Rooftop bar opens this June")).toBe("OPENING_SOON");
    expect(inferSignalTypeFromSummary("Now open on Deansgate")).toBe("NEW_OPENING");
    expect(inferSignalTypeFromSummary("Recruiting events staff")).toBe("HIRING");
    expect(inferSignalTypeFromSummary("New Instagram account posting launch sets")).toBe("NEW_SOCIAL");
    expect(inferSignalTypeFromSummary("A lovely venue")).toBeNull();
  });
});

describe("SerperDiscoveryProvider", () => {
  const serperResponse = (endpoint: string) => {
    if (endpoint === "/places") {
      return { places: [{ title: "Vault Bar", address: "1 Deansgate", category: "Bar", website: "https://vaultbar.example" }] };
    }
    const key = endpoint === "/news" ? "news" : "organic";
    return {
      [key]: [
        { title: "New bar The Vault opens", snippet: "Opened June 5 on Deansgate", link: "https://news.example/vault", date: "1 week ago" },
      ],
    };
  };

  const makeFetch = () =>
    vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      return new Response(JSON.stringify(serperResponse(path)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

  it("fires exactly the battery (never more), with the key + lowercased gl, and one LLM call", async () => {
    const fetchFn = makeFetch();
    const provider = new SerperDiscoveryProvider({ apiKey: "test-key", fetchFn });
    llmMock.mockResolvedValue({ candidates: [candidate()] });

    const signals = await provider.searchVenueSignals(MANCHESTER, { now: NOW, businessId: "biz1" });

    const battery = buildQueryBattery(MANCHESTER, NOW);
    expect(fetchFn).toHaveBeenCalledTimes(battery.length);
    expect(provider.queriesUsed).toBe(battery.length);
    expect(provider.queriesUsed).toBeLessThanOrEqual(MAX_QUERIES_PER_METRO);

    for (const call of fetchFn.mock.calls) {
      const init = call[1] as RequestInit;
      expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
      expect(JSON.parse(init.body as string).gl).toBe("gb");
    }

    expect(llmMock).toHaveBeenCalledTimes(1); // ONE batched extraction per scan
    expect(llmMock.mock.calls[0][0].purpose).toBe("parse");
    expect(llmMock.mock.calls[0][0].businessId).toBe("biz1");
    expect(signals).toHaveLength(1);
    expect(signals[0].venueName).toBe("The Vault");
  });

  it("survives individual query failures without retrying", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
      calls++;
      if (calls === 1) return new Response("rate limited", { status: 429 });
      const path = new URL(String(url)).pathname;
      return new Response(JSON.stringify(serperResponse(path)), { status: 200 });
    });
    const provider = new SerperDiscoveryProvider({ apiKey: "k", fetchFn });
    llmMock.mockResolvedValue({ candidates: [] });

    const signals = await provider.searchVenueSignals(MANCHESTER, { now: NOW });
    expect(signals).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(buildQueryBattery(MANCHESTER, NOW).length); // no retry
  });

  it("retries the extraction ONCE when the model omits decision fields batch-wide", async () => {
    const fetchFn = makeFetch();
    const provider = new SerperDiscoveryProvider({ apiKey: "k", fetchFn });
    // First call: the observed live failure — every candidate NONE and
    // nothing inferable from the summaries either.
    llmMock.mockResolvedValueOnce({
      candidates: [
        candidate({ signalType: "NONE", summary: "A bar" }),
        candidate({ venueName: "Other Bar", signalType: "NONE", summary: "Another bar" }),
      ],
    });
    llmMock.mockResolvedValueOnce({ candidates: [candidate()] });

    const signals = await provider.searchVenueSignals(MANCHESTER, { now: NOW });
    expect(llmMock).toHaveBeenCalledTimes(2); // one retry, never more
    expect(signals).toHaveLength(1);
    // Serper queries were NOT re-fired for the retry.
    expect(fetchFn).toHaveBeenCalledTimes(buildQueryBattery(MANCHESTER, NOW).length);
  });

  it("gives up after the retry if the batch is still broken (no infinite loop)", async () => {
    const provider = new SerperDiscoveryProvider({ apiKey: "k", fetchFn: makeFetch() });
    llmMock.mockResolvedValue({ candidates: [candidate({ signalType: "NONE", summary: "A bar" })] });
    const signals = await provider.searchVenueSignals(MANCHESTER, { now: NOW });
    expect(llmMock).toHaveBeenCalledTimes(2);
    expect(signals).toEqual([]);
  });

  it("skips the LLM call entirely when no results came back", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    const provider = new SerperDiscoveryProvider({ apiKey: "k", fetchFn });
    const signals = await provider.searchVenueSignals(MANCHESTER, { now: NOW });
    expect(signals).toEqual([]);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("refuses to scan without an API key", async () => {
    const provider = new SerperDiscoveryProvider({ apiKey: "" });
    await expect(provider.searchVenueSignals(MANCHESTER, { now: NOW })).rejects.toThrow(/SERPER_API_KEY/);
  });
});

// ---------------------------------------------------------------------------
// 10.2c — temperature model
// ---------------------------------------------------------------------------

describe("buildWarmQueryBattery", () => {
  it("never exceeds the warm cap (8/metro) and stays metro-specific", () => {
    const battery = buildWarmQueryBattery(MANCHESTER);
    expect(battery.length).toBeLessThanOrEqual(MAX_WARM_QUERIES_PER_METRO);
    for (const q of battery) expect(q.q).toContain("Manchester");
  });

  it("hunts entertainment-buying evidence, with at most ONE instagram query", () => {
    const battery = buildWarmQueryBattery(MANCHESTER);
    const text = battery.map((q) => q.q).join(" || ");
    expect(text).toMatch(/DJ nights|live music/i);
    expect(text).toMatch(/wedding venue/i);
    const igQueries = battery.filter((q) => q.q.includes("site:instagram.com"));
    expect(igQueries.length).toBeLessThanOrEqual(1);
  });
});

describe("reconcileTemperature", () => {
  it("opening signals are HOT no matter what the model said", () => {
    expect(reconcileTemperature("NEW_OPENING", "WARM")).toBe("HOT");
    expect(reconcileTemperature("OPENING_SOON", "SEED")).toBe("HOT");
  });

  it("existing-program evidence is never HOT — WARM (or SEED when the model says so)", () => {
    expect(reconcileTemperature("HOSTS_ENTERTAINMENT", "HOT")).toBe("WARM");
    expect(reconcileTemperature("EVENT_PROGRAM", "HOT")).toBe("WARM");
    expect(reconcileTemperature("HOSTS_ENTERTAINMENT", "SEED")).toBe("SEED");
  });

  it("a bare team contact is a SEED unless the model saw a real program", () => {
    expect(reconcileTemperature("TEAM_CONTACT", "HOT")).toBe("SEED");
    expect(reconcileTemperature("TEAM_CONTACT", "WARM")).toBe("WARM");
  });

  it("ambiguous classes keep the model's read", () => {
    expect(reconcileTemperature("HIRING", "WARM")).toBe("WARM");
    expect(reconcileTemperature("PRESS", "HOT")).toBe("HOT");
  });
});

describe("filterCandidates — 10.2c fields", () => {
  it("carries temperature + capped evidence (≤3, each ≤140 chars) onto the signal", () => {
    const long = "x".repeat(200);
    const [sig] = filterCandidates(
      [
        candidate({
          signalType: "HOSTS_ENTERTAINMENT",
          temperature: "WARM",
          entertainmentEvidence: ["Runs Friday DJ nights", long, "Hosts live bands", "a 4th fact"],
        }),
      ],
      NOW,
    );
    expect(sig.temperature).toBe("WARM");
    expect(sig.entertainmentEvidence).toHaveLength(3);
    expect(sig.entertainmentEvidence![1]).toHaveLength(140);
  });

  it("rescues warm-evidence cop-outs from NONE via the summary", () => {
    expect(inferSignalTypeFromSummary("Hotel bar hosts DJ nights every Friday")).toBe(
      "HOSTS_ENTERTAINMENT",
    );
    expect(inferSignalTypeFromSummary("Venue publishes a what's on events calendar")).toBe(
      "EVENT_PROGRAM",
    );
    expect(inferSignalTypeFromSummary("Maria Lopez is the events manager for the hotel")).toBe(
      "TEAM_CONTACT",
    );
  });

  it("keeps a contact name from a NON-LinkedIn public snippet, with provenance", () => {
    const [sig] = filterCandidates(
      [
        candidate({
          signalType: "TEAM_CONTACT",
          temperature: "SEED",
          contactName: "Maria Lopez",
          contactRole: "events manager",
          sourceUrl: "https://venue.example/team",
        }),
      ],
      NOW,
    );
    expect(sig.bookingContactName).toBe("Maria Lopez");
    expect(sig.contactSource).toContain("events manager");
    expect(sig.linkedinUrl).toBeUndefined();
  });

  it("NEVER stores a name sourced from linkedin.com — the URL goes on the handoff card", () => {
    const [sig] = filterCandidates(
      [
        candidate({
          signalType: "TEAM_CONTACT",
          temperature: "SEED",
          contactName: "Maria Lopez",
          contactRole: "events manager",
          sourceUrl: "https://www.linkedin.com/in/maria-lopez-events",
        }),
      ],
      NOW,
    );
    expect(sig.bookingContactName).toBeUndefined();
    expect(sig.linkedinUrl).toBe("https://www.linkedin.com/in/maria-lopez-events");
  });
});

describe("SerperDiscoveryProvider — warm battery + chunked extraction (10.2c)", () => {
  const tenResults = {
    organic: Array.from({ length: 10 }, (_, i) => ({
      title: `Venue ${i}`,
      snippet: "Hotel bar with Friday DJ nights",
      link: `https://example.com/venue-${i}`,
    })),
  };
  const bigFetch = () =>
    vi.fn(
      async () =>
        new Response(JSON.stringify(tenResults), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

  it("warm=true fires hot + warm batteries; results are extracted in chunks", async () => {
    const fetchFn = bigFetch();
    const provider = new SerperDiscoveryProvider({ apiKey: "k", fetchFn });
    llmMock.mockResolvedValue({ candidates: [candidate()] });

    await provider.searchVenueSignals(MANCHESTER, { now: NOW, warm: true });

    const expectedQueries =
      buildQueryBattery(MANCHESTER, NOW).length + buildWarmQueryBattery(MANCHESTER).length;
    expect(fetchFn).toHaveBeenCalledTimes(expectedQueries);
    // 10 items/query → chunked: never one giant call (the live 46k-token
    // output blowup), one call per EXTRACTION_CHUNK_SIZE items.
    const expectedChunks = Math.ceil((expectedQueries * 10) / EXTRACTION_CHUNK_SIZE);
    expect(expectedChunks).toBeGreaterThan(1);
    expect(llmMock).toHaveBeenCalledTimes(expectedChunks);
  });

  it("warm=false keeps the hot battery only (the slow wheel's off-turn)", async () => {
    const fetchFn = bigFetch();
    const provider = new SerperDiscoveryProvider({ apiKey: "k", fetchFn });
    llmMock.mockResolvedValue({ candidates: [] });
    await provider.searchVenueSignals(MANCHESTER, { now: NOW, warm: false });
    expect(fetchFn).toHaveBeenCalledTimes(buildQueryBattery(MANCHESTER, NOW).length);
  });

  it("a chunk that errors twice is dropped — the other chunks still land", async () => {
    const fetchFn = bigFetch();
    const provider = new SerperDiscoveryProvider({ apiKey: "k", fetchFn });
    llmMock
      .mockResolvedValueOnce({ candidates: [candidate()] }) // chunk 1 ok
      .mockRejectedValueOnce(new Error("output limit")) // chunk 2, attempt 1
      .mockRejectedValueOnce(new Error("output limit")) // chunk 2, attempt 2 — dropped
      .mockResolvedValue({ candidates: [candidate({ venueName: "Survivor Bar" })] }); // rest

    const signals = await provider.searchVenueSignals(MANCHESTER, { now: NOW, warm: true });
    expect(signals.map((s) => s.venueName)).toContain("The Vault");
    expect(signals.map((s) => s.venueName)).toContain("Survivor Bar");
  });
});
