import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildVenuePitchPrompt,
  buildVenuePitchSystem,
  detectLeak,
  generateVenuePitch,
  normalizeVenuePitch,
  pitchLanguageFor,
  type VenuePitchRequest,
  type VenuePitchResult,
} from "@/lib/agent/venue-pitch";

// Mock the LLM gateway — generateVenuePitch must never hit OpenRouter (or the
// DB via LlmUsage) in unit tests.
vi.mock("@/lib/llm", () => ({
  llmObject: vi.fn(),
  modelFor: vi.fn(() => "test/model"),
}));
import { llmObject } from "@/lib/llm";
const llmMock = vi.mocked(llmObject);

const EPK = "https://brightears-app.onrender.com/epk/sapphire-sounds";

const req: VenuePitchRequest = {
  business: {
    id: null,
    name: "Sapphire Sounds",
    ownerName: "Maya Reyes",
    performerKind: "DJ",
    voiceSamples: "Hey! Thanks so much for reaching out — I'd love to play your party.",
    headline: "Open-format DJ that keeps dance floors full",
    bio: "Fifteen years behind the decks across the North West.",
    genres: ["open format", "house", "disco"],
    eventTypes: ["weddings", "club nights"],
    serviceCities: ["Manchester", "Leeds"],
    feeFloor: 35000,
    feeSweetSpot: 60000,
    reviewQuotes: ["Best DJ we've ever booked"],
    notableVenues: ["Albert Hall", "YES Basement"],
  },
  venue: {
    name: "The Vault",
    city: "Manchester",
    country: "GB",
    kind: "BAR",
    signals: ["Rooftop bar opened May 28 per Manchester Evening News"],
    fitReasons: ["New opening in your home city", "Open-format room"],
  },
  epkUrl: EPK,
  language: "en",
};

const clean: VenuePitchResult = {
  subject: "DJ for The Vault's opening season",
  body: `Saw The Vault just opened on the rooftop — congratulations.\n\nI'm Maya, I play open-format sets that keep after-work crowds dancing till close. Here's a one-page look at what I do: ${EPK}\n\nShall I hold a date for you?\n\nMaya — Sapphire Sounds`,
};

beforeEach(() => {
  llmMock.mockReset();
});

describe("prompt assembly", () => {
  it("system prompt carries the profile ammunition and the artist's voice", () => {
    const system = buildVenuePitchSystem(req);
    expect(system).toContain("Maya Reyes");
    expect(system).toContain("Sapphire Sounds");
    expect(system).toContain("Open-format DJ that keeps dance floors full");
    expect(system).toContain("Fifteen years behind the decks");
    expect(system).toContain("Albert Hall");
    expect(system).toContain("Best DJ we've ever booked");
    expect(system).toContain("Thanks so much for reaching out"); // voiceSamples
    expect(system).toContain(EPK);
  });

  it("user prompt carries the venue and its signals", () => {
    const prompt = buildVenuePitchPrompt(req);
    expect(prompt).toContain("The Vault");
    expect(prompt).toContain("Manchester, GB");
    expect(prompt).toContain("Rooftop bar opened May 28");
    expect(prompt).toContain("New opening in your home city");
  });

  it("no forbidden tokens in the prompts (white-label LAW, outside the EPK URL)", () => {
    const all = `${buildVenuePitchSystem(req)}\n${buildVenuePitchPrompt(req)}`.split(EPK).join(" ");
    expect(all).not.toMatch(/bright\s*ears/i);
    expect(all.toLowerCase()).not.toContain("brightears");
  });

  it("never puts a price in the prompt — fee fields stay internal", () => {
    const system = buildVenuePitchSystem(req);
    expect(system).not.toContain("35000");
    expect(system).not.toContain("350");
    expect(system).toMatch(/NEVER mention prices/);
  });
});

describe("pitchLanguageFor", () => {
  it("matches venue country to a pitch language the business speaks", () => {
    expect(pitchLanguageFor("DE", ["en", "de"])).toBe("de");
    expect(pitchLanguageFor("AT", ["en", "de"])).toBe("de");
    expect(pitchLanguageFor("TH", ["en", "th"])).toBe("th");
  });
  it("defaults to en when the business doesn't speak it (or country unknown)", () => {
    expect(pitchLanguageFor("DE", ["en"])).toBe("en");
    expect(pitchLanguageFor("US", ["en", "de"])).toBe("en");
    expect(pitchLanguageFor("XX", ["en"])).toBe("en");
  });
});

describe("normalizeVenuePitch", () => {
  it("keeps a clean result intact", () => {
    const out = normalizeVenuePitch(req, clean);
    expect(out.body).toBe(clean.body);
    expect(out.subject).toBe(clean.subject);
  });

  it("injects the EPK link when the model dropped it (before the sign-off)", () => {
    const out = normalizeVenuePitch(req, {
      subject: "DJ for your opening",
      body: "Saw you just opened.\n\nI keep floors full.\n\nMaya — Sapphire Sounds",
    });
    expect(out.body.split(EPK).length - 1).toBe(1);
    // Link lands before the final sign-off paragraph.
    const paragraphs = out.body.split("\n\n");
    expect(paragraphs[paragraphs.length - 2]).toContain(EPK);
    expect(paragraphs[paragraphs.length - 1]).toContain("Maya");
  });

  it("strips duplicate EPK links down to exactly one", () => {
    const out = normalizeVenuePitch(req, {
      subject: "DJ for your opening",
      body: `Look: ${EPK}\n\nAnd again ${EPK}\n\nMaya`,
    });
    expect(out.body.split(EPK).length - 1).toBe(1);
  });

  it("strips an echoed 'Subject:' line the model prepends to the body", () => {
    const out = normalizeVenuePitch(req, {
      subject: clean.subject,
      body: `Subject: ${clean.subject}\n\n${clean.body}`,
    });
    expect(out.body).toBe(clean.body);
  });

  it("enforces subject ≤ 7 words and strips exclamation marks", () => {
    const out = normalizeVenuePitch(req, {
      subject: "An amazing open format DJ for your brand new rooftop bar!!",
      body: clean.body,
    });
    expect(out.subject.split(" ").length).toBeLessThanOrEqual(7);
    expect(out.subject).not.toContain("!");
  });
});

describe("detectLeak", () => {
  it("catches AI/assistant/automation/brand leaks", () => {
    expect(detectLeak({ subject: "x", body: "I'm an AI assistant" })).toBeTruthy();
    expect(detectLeak({ subject: "x", body: "this was automated" })).toBeTruthy();
    expect(detectLeak({ subject: "x", body: "powered by Bright Ears" })).toBeTruthy();
    expect(detectLeak({ subject: "Your AI pitch", body: "hello" })).toBeTruthy();
  });

  it("does not flag clean artist copy, the EPK URL, or lookalike words", () => {
    expect(detectLeak(clean, EPK)).toBeNull();
    expect(detectLeak({ subject: "x", body: "the air in Dubai is humid, I said" })).toBeNull();
  });
});

describe("generateVenuePitch", () => {
  it("returns normalized copy and the purpose's model id", async () => {
    llmMock.mockResolvedValueOnce({ ...clean });
    const out = await generateVenuePitch(req);
    expect(out.subject).toBe(clean.subject);
    expect(out.model).toBe("test/model");
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(llmMock.mock.calls[0][0]).toMatchObject({ purpose: "venuePitch", businessId: null });
  });

  it("regenerates ONCE on a white-label leak, then succeeds", async () => {
    llmMock
      .mockResolvedValueOnce({ subject: "x", body: "I'm an AI assistant for Maya" })
      .mockResolvedValueOnce({ ...clean });
    const out = await generateVenuePitch(req);
    expect(llmMock).toHaveBeenCalledTimes(2);
    // The retry prompt names the violation.
    expect((llmMock.mock.calls[1][0] as { prompt: string }).prompt).toMatch(/forbidden/);
    expect(out.body).toContain(EPK);
  });

  it("fails loudly when the leak survives the regeneration", async () => {
    llmMock.mockResolvedValue({ subject: "x", body: "I'm an AI assistant" });
    await expect(generateVenuePitch(req)).rejects.toThrow(/white-label leak/);
    expect(llmMock).toHaveBeenCalledTimes(2);
  });
});
