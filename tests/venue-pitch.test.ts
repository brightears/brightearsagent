import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPitchTask,
  buildVenuePitchPrompt,
  buildVenuePitchSystem,
  detectFollowUpPromise,
  detectLeak,
  generateVenuePitch,
  isVenuePitchAutoSendLanguage,
  normalizeVenuePitch,
  pitchLanguageFor,
  validateVenuePitch,
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
import { VENUE_PITCH_SCENARIOS } from "@/evals/venue-pitch-scenarios";
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

  it("permits auto-send only for the language with complete semantic validators", () => {
    expect(isVenuePitchAutoSendLanguage("en")).toBe(true);
    for (const language of ["de", "fr", "th", "ja"]) {
      expect(isVenuePitchAutoSendLanguage(language), language).toBe(false);
    }
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

  it("upgrades a legacy host for the same EPK path without leaving two links", () => {
    const out = normalizeVenuePitch(req, {
      subject: "A room-specific introduction",
      body: "One-page look: http://localhost:3000/epk/sapphire-sounds\n\nMaya — Sapphire Sounds",
    });
    expect(out.body).toContain(EPK);
    expect(out.body).not.toContain("localhost");
    expect(out.body.match(/https?:\/\//g)).toHaveLength(1);
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

  it("adds one canonical first-name + act-name sign-off when the model omits it", async () => {
    llmMock.mockResolvedValueOnce({
      ...clean,
      body: clean.body.replace(/\n\nMaya — Sapphire Sounds$/, ""),
    });

    const out = await generateVenuePitch(req);

    expect(out.body).toMatch(/\n\nMaya — Sapphire Sounds$/);
    expect(out.body.split("Maya — Sapphire Sounds")).toHaveLength(2);
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(validateVenuePitch(req, out).issues).toEqual([]);
  });

  it("normalizes a slash-delimited echoed subject idempotently", async () => {
    const scenario = VENUE_PITCH_SCENARIOS.find(
      ({ name }) => name === "dancer-hot-supper-club-launch",
    );
    expect(scenario).toBeDefined();
    const dancerReq = scenario!.request;
    llmMock.mockResolvedValueOnce({
      subject: "Cabaret for Maré's supper-club launch",
      body: `Subject: Cabaret for Maré's supper-club launch / Hello — I noticed Maré is launching its October supper-club programme with live floor shows.\n\nWe are Velvet Duo Cabaret, a two-person cabaret act with a compact setup that can build a focused dinner-show moment without taking over the room.\n\nHere's a one-page look at our work: ${dancerReq.epkUrl}\n\nShall I hold a suitable launch date for you?\n\nAna — Velvet Duo Cabaret`,
    });

    const out = await generateVenuePitch(dancerReq);
    const rechecked = validateVenuePitch(dancerReq, out);

    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(out.body).toMatch(/^Hello —/);
    expect(out.body).not.toMatch(/^Subject:/i);
    expect(rechecked.issues).toEqual([]);
    expect(rechecked.result).toEqual({ subject: out.subject, body: out.body });
  });

  it("retries one transient provider timeout, then succeeds", async () => {
    const timeout = Object.assign(new Error("provider timed out"), { name: "TimeoutError" });
    llmMock.mockRejectedValueOnce(timeout).mockResolvedValueOnce({ ...clean });

    const out = await generateVenuePitch(req);

    expect(out.body).toContain(EPK);
    expect(llmMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the transient retry bounded to one extra provider call", async () => {
    const timeout = Object.assign(new Error("provider timed out"), { name: "TimeoutError" });
    llmMock.mockRejectedValue(timeout);

    await expect(generateVenuePitch(req)).rejects.toThrow("provider timed out");
    expect(llmMock).toHaveBeenCalledTimes(2);
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

describe("generateVenuePitch — deterministic CTA fallback", () => {
  it.each([
    ["HOT", req, "Shall I hold a suitable date for you?"],
    [
      "WARM",
      warmReq,
      "Would you consider keeping my one-page profile on file for a future slot?",
    ],
    ["SEED", seedReq, "Please file me away for when you next need entertainment."],
  ] as const)("normalizes a repeated %s two-ask correction to one safe CTA", async (_, request, fallback) => {
    const withTwoAsks = {
      ...clean,
      body: clean.body.replace(
        "Shall I hold a date for you?",
        "Would you be open to a quick call? Shall I send a few dates?",
      ),
    };
    // The first failure still gets the model's normal corrective generation.
    // Only when that correction repeats both asks does deterministic fallback
    // take over.
    llmMock.mockResolvedValueOnce(withTwoAsks).mockResolvedValueOnce(withTwoAsks);

    const out = await generateVenuePitch(request);

    expect(llmMock).toHaveBeenCalledTimes(2);
    expect(out.body).toContain(fallback);
    expect(out.body).not.toContain("quick call");
    expect(out.body).not.toContain("send a few dates");
    // Repair is sentence-scoped: venue grounding, artist value, proof and the
    // canonical signature all survive unchanged.
    expect(out.body).toContain("Saw The Vault just opened on the rooftop");
    expect(out.body).toContain("I play open-format sets");
    expect(out.body).toContain(EPK);
    expect(out.body).toMatch(/\n\nMaya — Sapphire Sounds$/);
    expect(validateVenuePitch(request, out).issues).toEqual([]);
    if (request.venue.temperature === "WARM") {
      expect(out.body).not.toMatch(/hold a (?:specific |suitable )?date/i);
    }
    if (request.venue.temperature === "SEED") {
      expect(out.body).not.toContain("?");
      expect(detectFollowUpPromise(out)).toBeNull();
    }
  });
});

describe("generateVenuePitch — post-correction short-copy repair", () => {
  const shortWarm: VenuePitchResult = {
    subject: "An introduction for Friday DJ nights",
    body: `Saw The Vault runs Friday DJ nights.\n\nI play warm open-format sets that can sit under conversation and lift later.\n\nHere's my profile: ${EPK}\n\nWould you keep me on file?\n\nMaya — Sapphire Sounds`,
  };

  it("adds one neutral bridge to a safe 33-ish-word WARM near-miss", async () => {
    expect(validateVenuePitch(warmReq, shortWarm).issues).toEqual([
      expect.stringMatching(/outside the safe 40-170 word budget/),
    ]);
    llmMock.mockResolvedValueOnce(shortWarm).mockResolvedValueOnce(shortWarm);

    const out = await generateVenuePitch(warmReq);

    expect(llmMock).toHaveBeenCalledTimes(2);
    expect(out.body).toContain(
      "I’m keeping this introduction straightforward and focused on whether the act could suit the room.",
    );
    expect(out.body).toContain("Friday DJ nights");
    expect(out.body).toContain(EPK);
    expect(out.body).toContain("Would you keep me on file?");
    expect(validateVenuePitch(warmReq, out).issues).toEqual([]);
  });

  it("does not let length repair conceal a forbidden commercial claim", async () => {
    const unsafe = {
      ...shortWarm,
      body: shortWarm.body.replace(
        "warm open-format sets that can sit under conversation and lift later",
        "a free trial night at no risk for the venue",
      ),
    };
    llmMock.mockResolvedValueOnce(unsafe).mockResolvedValueOnce(unsafe);

    await expect(generateVenuePitch(warmReq)).rejects.toThrow(/unauthorized free/);
    expect(llmMock).toHaveBeenCalledTimes(2);
  });

  it("refuses to pad a severely incomplete correction up to the minimum", async () => {
    const fragment = {
      subject: "Friday DJ introduction",
      body: `Friday DJ nights. ${EPK}\n\nWould you keep me on file?\n\nMaya — Sapphire Sounds`,
    };
    llmMock.mockResolvedValueOnce(fragment).mockResolvedValueOnce(fragment);

    await expect(generateVenuePitch(warmReq)).rejects.toThrow(/outside the safe 40-170 word budget/);
    expect(llmMock).toHaveBeenCalledTimes(2);
  });
});

describe("venue-pitch live scenario punctuation", () => {
  it("accepts either a hyphen or en dash in the exact travel date range", () => {
    const scenario = VENUE_PITCH_SCENARIOS.find(({ name }) => name === "dj-travel-date-bounded");
    const datePattern = scenario?.expect.mustInclude?.[1];

    expect(datePattern?.test("Lisbon, August 4-11")).toBe(true);
    expect(datePattern?.test("Lisbon, August 4–11")).toBe(true);
  });

  it("word-bounds performer-kind exclusions without missing DJ variants", () => {
    const scenario = VENUE_PITCH_SCENARIOS.find(
      ({ name }) => name === "comedian-warm-comedy-series",
    );
    const performerPattern = scenario?.expect.mustNotInclude?.[0];

    expect(performerPattern?.test("I adjust the set to suit the room.")).toBe(false);
    for (const copy of ["A DJ set", "DJs for the room", "DJing all night"]) {
      expect(performerPattern?.test(copy), copy).toBe(true);
    }
  });
});

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
    // A guest/trial scheduling question is allowed; commercial concessions are not.
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
        body: `Just introducing myself because The Vault keeps a strong entertainment program. I play open-format sets that build naturally from early drinks into a full room, with fifteen years behind the decks across Manchester. Here's a one-page look: ${EPK}\n\nPlease file me away for when you next need a DJ.\n\nMaya — Sapphire Sounds`,
      });
    const out = await generateVenuePitch(seedReq);
    expect(llmMock).toHaveBeenCalledTimes(2);
    const retryPrompt = llmMock.mock.calls[1][0].prompt;
    expect(retryPrompt).toContain("CORRECTION REQUIRED");
    expect(retryPrompt).toMatch(/one-time introduction/i);
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
      ...clean,
      body: `${clean.body}\n\nI'll follow up next week if easier.`,
    });
    const out = await generateVenuePitch(req);
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(out.body).toContain("follow up");
  });
});

describe("WARM trial-slot introduction", () => {
  it("asks about a neutral trial slot without authorizing commercial concessions", () => {
    const task = buildPitchTask("WARM");
    expect(task).toMatch(/trial slot/i);
    expect(task).toMatch(/no specific date/i);
    expect(task).toMatch(/never offer it for free/i);
    expect(task).toMatch(/never make pay contingent/i);
    expect(task).toMatch(/never promise revenue, profit/i);
    // The on-file fallback stays for venues where a trial night makes no sense.
    expect(task).toMatch(/on file/i);
  });
});

describe("validateVenuePitch", () => {
  it("rejects prices, free/performance-contingent terms, exclamations and multiple asks", () => {
    const checked = validateVenuePitch(warmReq, {
      subject: "A slot at The Vault!",
      body: `Saw you run Friday DJ nights. I can do a free trial night at no risk for £0, and if the room doesn't do better numbers you owe nothing! ${EPK}\n\nWould you like a call? Shall I send dates?\n\nMaya — Sapphire Sounds`,
    });
    expect(checked.issues).toEqual(
      expect.arrayContaining([
        "contains an exclamation mark",
        "mentions a price, fee, or rate",
        "offers unauthorized free, contingent, or guaranteed commercial terms",
        "call-to-action count is 2, expected 1",
      ]),
    );
  });

  it("rejects a WARM pitch that pretends the venue posted a current need", () => {
    const checked = validateVenuePitch(warmReq, {
      ...clean,
      body: clean.body.replace(
        "Saw The Vault just opened on the rooftop — congratulations.",
        "Saw your post saying you're looking for a DJ right now.",
      ),
    });
    expect(checked.issues).toContain("pretends the WARM venue posted a current need");
  });

  it("allows profile-backed 'I've been playing/DJing' career language", () => {
    for (const careerLine of [
      "I've been playing rooftops for twelve years.",
      "I’ve been DJing across Manchester for twelve years.",
      "I've been at this for twelve years.",
    ]) {
      const checked = validateVenuePitch(req, {
        ...clean,
        body: clean.body.replace(
          "Saw The Vault just opened on the rooftop — congratulations.",
          `Heard The Vault just opened on the rooftop. ${careerLine}`,
        ),
      });
      expect(checked.issues, careerLine).not.toContain("claims firsthand venue experience");
    }
  });

  it("still blocks actual target-venue visits and venue-specific firsthand content", () => {
    for (const firsthandLine of [
      "I've been to The Vault before.",
      "I’ve been at your venue before.",
      "I've visited The Vault before.",
      "I've watched your rooftop clips.",
      "I've heard your Friday sets.",
      "I saw The Vault's rooftop shows.",
    ]) {
      const checked = validateVenuePitch(req, {
        ...clean,
        body: clean.body.replace(
          "Saw The Vault just opened on the rooftop — congratulations.",
          firsthandLine,
        ),
      });
      expect(checked.issues, firsthandLine).toContain("claims firsthand venue experience");
    }
  });

  it("rejects an additional or wrong press-kit link", () => {
    const checked = validateVenuePitch(req, {
      ...clean,
      body: clean.body.replace(EPK, `${EPK} https://example.test/epk/someone-else`),
    });
    expect(checked.issues).toContain(
      "body must contain the current EPK URL and no other external links",
    );
  });

  it("rejects a non-English request answered entirely in English", () => {
    const checked = validateVenuePitch(
      { ...req, language: "de" },
      clean,
    );
    expect(checked.issues).toContain("body does not appear to be written in de");
  });

  it("uses script-character bounds for Japanese instead of whitespace word counts", () => {
    const japanese = validateVenuePitch(
      { ...req, language: "ja" },
      {
        subject: "ザ・ヴォルトへのDJ紹介",
        body: `ザ・ヴォルトが新しくオープンしたことを知り、ご連絡しました。私はマンチェスターを拠点に活動するオープンフォーマットDJです。お客様の流れに合わせ、落ち着いた時間からダンスフロアまで自然につながる選曲を大切にしています。会場の雰囲気を尊重しながら、幅広い年代が楽しめる夜を作ります。\n\n活動内容はこちらです: ${EPK}\n\n今後の出演候補としてご検討いただけますか？\n\nMaya — Sapphire Sounds`,
      },
    );
    expect(japanese.issues.join(" ")).not.toMatch(/word budget|character budget/i);
    expect(japanese.issues).toEqual([]);
  });

  it("uses script-character bounds for Thai instead of treating the body as one word", () => {
    const thai = validateVenuePitch(
      { ...req, language: "th" },
      {
        subject: "ดีเจสำหรับเดอะวอลต์",
        body: `เห็นข่าวว่าเดอะวอลต์เพิ่งเปิดใหม่จึงอยากแนะนำตัวค่ะ ฉันเป็นดีเจโอเพนฟอร์แมตที่ดูบรรยากาศของห้องและค่อย ๆ พาเพลงจากช่วงนั่งดื่มไปสู่ฟลอร์เต้นรำ ฉันให้ความสำคัญกับแขกของสถานที่และเลือกเพลงให้เหมาะกับคนหลายช่วงวัยโดยไม่เร่งจังหวะเกินไป\n\nดูผลงานแบบหน้าเดียวได้ที่นี่: ${EPK}\n\nสนใจเก็บโปรไฟล์ไว้สำหรับคืนที่เหมาะสมไหมคะ?\n\nMaya — Sapphire Sounds`,
      },
    );
    expect(thai.issues.join(" ")).not.toMatch(/word budget|character budget/i);
    expect(thai.issues).toEqual([]);
  });
});
