import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPitchTask,
  buildVenuePitchPrompt,
  buildVenuePitchSystem,
  detectFollowUpPromise,
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

  it("offers a residency slot as ammo only when the artist takes residencies", () => {
    const residency = { ...req, business: { ...req.business, gigTypes: ["one-off", "residency"] } };
    expect(buildVenuePitchSystem(residency)).toContain("regular residency slot");
    // No residency intent → no residency line (one-off only / unset).
    const oneOff = { ...req, business: { ...req.business, gigTypes: ["one-off"] } };
    expect(buildVenuePitchSystem(oneOff)).not.toContain("regular residency slot");
    expect(buildVenuePitchSystem(req)).not.toContain("regular residency slot");
  });

  it("carries riderNotes (setup/needs) as ammo when present, omits it otherwise", () => {
    const withRider = {
      ...req,
      business: { ...req.business, riderNotes: "I bring my own rig; just need two power outlets near the booth." },
    };
    const sys = buildVenuePitchSystem(withRider);
    expect(sys).toContain("Setup & needs:");
    expect(sys).toContain("two power outlets");
    expect(buildVenuePitchSystem(req)).not.toContain("Setup & needs:");
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

// ---------------------------------------------------------------------------
// 10.2c — temperature templates + the SEED no-follow-up guard
// ---------------------------------------------------------------------------

const warmReq: VenuePitchRequest = {
  ...req,
  venue: {
    ...req.venue,
    temperature: "WARM",
    signals: [],
    entertainmentEvidence: ["Runs Friday DJ nights per its events page", "Hosts live bands monthly"],
  },
};

const seedReq: VenuePitchRequest = {
  ...req,
  venue: { ...req.venue, temperature: "SEED", signals: [], entertainmentEvidence: [] },
};

describe("temperature template selection (buildPitchTask)", () => {
  it("HOT (and legacy callers without temperature) keep the date-shaped ask", () => {
    expect(buildPitchTask("HOT")).toContain("first pitch email");
    expect(buildVenuePitchPrompt(req)).toContain("first pitch email");
    expect(buildVenuePitchSystem(req)).toContain("shall I hold a date?");
  });

  it("WARM is an introduction referencing their EXISTING program, trial-night/on-file CTA", () => {
    const task = buildPitchTask("WARM");
    expect(task).toContain("INTRODUCTION");
    expect(task).toContain("have NOT posted any need");
    // 12.4: the converter CTA is a no-risk trial night; on-file is the fallback.
    expect(task).toMatch(/trial night|on file/i);
    // The evidence facts land in the prompt as the only program grounding.
    const prompt = buildVenuePitchPrompt(warmReq);
    expect(prompt).toContain("Runs Friday DJ nights per its events page");
    expect(prompt).toContain("verified facts");
    // The system CTA rule bans the date-ask for WARM.
    const system = buildVenuePitchSystem(warmReq);
    expect(system).toMatch(/[Nn]ever ask to hold a (specific )?date/);
    expect(system).not.toContain("shall I hold a date?");
  });

  it("SEED is the shortest pure introduction — 60-90 words, no ask, never a follow-up promise", () => {
    const task = buildPitchTask("SEED");
    expect(task).toContain("60-90 words");
    expect(task).toContain("file me away");
    expect(task).toMatch(/NEVER promise to follow up/i);
    expect(buildVenuePitchSystem(seedReq)).toContain("1. Body 60-90 words.");
  });
});

describe("detectFollowUpPromise (SEED no-follow-up guard)", () => {
  it("catches the classic follow-up promises", () => {
    for (const line of [
      "I'll follow up next month.",
      "I will be following up soon",
      "I'll check back in a few weeks",
      "Happy to touch base after the summer",
      "I'll circle back once you've settled in",
      "I'll reach out again in the autumn",
    ]) {
      expect(detectFollowUpPromise({ subject: "Hi", body: line })).toBeTruthy();
    }
  });

  it("does not flag clean file-me-away copy", () => {
    expect(
      detectFollowUpPromise({
        subject: "Wedding DJ for your venue files",
        body: "Keep this on file for when you next need wedding entertainment. No reply needed.",
      }),
    ).toBeNull();
  });
});

describe("generateVenuePitch — SEED guard wiring", () => {
  it("regenerates ONCE when a SEED pitch promises a follow-up, then succeeds", async () => {
    llmMock
      .mockResolvedValueOnce({
        subject: "Hello from Sapphire Sounds",
        body: `Just introducing myself. ${EPK} I'll follow up next month. Maya — Sapphire Sounds`,
      })
      .mockResolvedValueOnce({
        subject: "Hello from Sapphire Sounds",
        body: `Just introducing myself — file me away for when you need wedding entertainment. ${EPK}\n\nMaya — Sapphire Sounds`,
      });
    const out = await generateVenuePitch(seedReq);
    expect(llmMock).toHaveBeenCalledTimes(2);
    const retryPrompt = llmMock.mock.calls[1][0].prompt;
    expect(retryPrompt).toContain("ONE-TIME introduction");
    expect(detectFollowUpPromise(out)).toBeNull();
  });

  it("fails loudly when the follow-up promise survives regeneration", async () => {
    llmMock.mockResolvedValue({
      subject: "Hello",
      body: `Intro. ${EPK} I'll check back soon. Maya`,
    });
    await expect(generateVenuePitch(seedReq)).rejects.toThrow(/follow-up/);
  });

  it("HOT pitches are NOT subject to the follow-up guard (sequences may follow)", async () => {
    llmMock.mockResolvedValue({
      subject: "DJ for The Vault",
      body: `Saw you opened. ${EPK} I'll follow up next week if easier. Maya — Sapphire Sounds`,
    });
    const out = await generateVenuePitch(req);
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(out.body).toContain("follow up");
  });
});

describe("WARM trial-night converter (P12.4)", () => {
  it("the WARM task offers a profit-framed no-risk trial night, no specific date", () => {
    const task = buildPitchTask("WARM");
    expect(task).toMatch(/trial night/i);
    expect(task).toMatch(/profit/i);
    expect(task).toMatch(/no specific date/i);
    // The on-file fallback stays for venues where a trial night makes no sense.
    expect(task).toMatch(/on file/i);
  });
});
