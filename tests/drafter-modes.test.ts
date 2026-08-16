import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoObjectGeneratedError } from "ai";

// Task-mode selection (10.8): the drafter has THREE modes — first reply,
// sequence follow-up, and mid-conversation (client wrote back after we
// replied). Before the third existed, ENGAGED replies took the FIRST-reply
// task and re-introduced the act mid-thread.

const mockLlmObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm", () => ({ llmObject: mockLlmObject }));

import { generateDraft } from "@/lib/agent/drafter";
import { validateDraft } from "@/lib/agent/draft-safety";
import type { DraftRequest } from "@/lib/agent/types";

const baseReq: DraftRequest = {
  business: {
    id: null,
    name: "Sapphire Sounds",
    ownerName: "Maya",
    performerKind: "DJ",
    country: "GB",
    currency: "GBP",
  },
  packages: [],
  lead: { source: "PLAIN_EMAIL", message: "Are you free Sept 14? What would it cost?" },
  availability: { state: "unknown" },
  thread: [],
  sequenceStep: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLlmObject.mockResolvedValue({
    subject: "Re: Sept 14",
    body: "Thanks for writing — what time does the evening run?",
    availabilityStatement: "not_addressed",
    wantsProfile: false,
    wantsQuote: false,
  });
});

const promptSent = () => mockLlmObject.mock.calls[0][0] as { purpose: string; prompt: string };

const noObject = () =>
  new NoObjectGeneratedError({
    message: "provider returned malformed structured output",
    response: {} as never,
    usage: {} as never,
    finishReason: "error",
  });

describe("generateDraft task modes", () => {
  it("fresh lead (empty thread) → FIRST-reply task", async () => {
    await generateDraft(baseReq);
    const { purpose, prompt } = promptSent();
    expect(purpose).toBe("draft");
    expect(prompt).toContain("write the FIRST reply");
  });

  it("client nudged twice before we ever replied → still the FIRST reply", async () => {
    await generateDraft({
      ...baseReq,
      thread: [
        { direction: "INBOUND", body: "Are you free Sept 14?" },
        { direction: "INBOUND", body: "Hello? Still hoping to hear back." },
      ],
    });
    expect(promptSent().prompt).toContain("write the FIRST reply");
  });

  it("client wrote back after our reply → continue-the-thread task, no re-introduction", async () => {
    await generateDraft({
      ...baseReq,
      availability: { state: "free" },
      thread: [
        { direction: "INBOUND", body: "Are you free Sept 14?" },
        { direction: "OUTBOUND", body: "We are — here's how we usually run a wedding." },
        { direction: "INBOUND", body: "Great — do you also bring lighting?" },
      ],
    });
    const { purpose, prompt } = promptSent();
    expect(purpose).toBe("draft");
    expect(prompt).toContain("continue this conversation");
    expect(prompt).toContain("do NOT re-introduce");
    expect(prompt).not.toContain("write the FIRST reply");
    expect(prompt).toContain("Do not repeat this unless");
  });

  it("sequence step > 0 → follow-up task wins even mid-thread", async () => {
    await generateDraft({
      ...baseReq,
      sequenceStep: 2,
      thread: [
        { direction: "INBOUND", body: "Are you free Sept 14?" },
        { direction: "OUTBOUND", body: "We are!" },
      ],
    });
    const { purpose, prompt } = promptSent();
    expect(purpose).toBe("followup");
    expect(prompt).toContain("write follow-up #2");
    expect(prompt).not.toContain("continue this conversation");
  });

  it("grounds known availability in a first reply but leaves mid-thread copy alone", async () => {
    const first = await generateDraft({ ...baseReq, availability: { state: "free" } });
    expect(first.body).toContain("your date is open");
    expect(first.availabilityStatement).toBe("affirmed");

    const mid = await generateDraft({
      ...baseReq,
      availability: { state: "free" },
      thread: [{ direction: "OUTBOUND", body: "Your date is open." }],
    });
    expect(mid.body).not.toContain("your date is open");
    expect(mid.availabilityStatement).toBe("not_addressed");
  });
});

describe("bounded structured-output recovery", () => {
  it("retries one NoObjectGeneratedError and returns the parsed retry", async () => {
    mockLlmObject.mockRejectedValueOnce(noObject()).mockResolvedValueOnce({
      subject: "Re: Sept 14",
      body: "Thanks for writing — what time does the evening run?",
      availabilityStatement: "not_addressed",
      wantsProfile: false,
      wantsQuote: false,
    });

    await expect(generateDraft(baseReq)).resolves.toMatchObject({ subject: "Re: Sept 14" });
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
  });

  it("never loops when structured output fails twice and returns a validated known-fields reply", async () => {
    mockLlmObject.mockRejectedValue(noObject());
    await expect(generateDraft(baseReq)).resolves.toMatchObject({
      availabilityStatement: "not_addressed",
    });
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
  });

  it("spends the one shared transient retry on a timeout, then returns the retry", async () => {
    const timeout = new DOMException("timed out", "TimeoutError");
    mockLlmObject.mockRejectedValueOnce(timeout).mockResolvedValueOnce({
      subject: "Re: Sept 14",
      body: "Thanks for writing — what full date and venue are you considering?",
      availabilityStatement: "not_addressed",
      wantsProfile: false,
      wantsQuote: false,
    });
    await expect(generateDraft(baseReq)).resolves.toMatchObject({ subject: "Re: Sept 14" });
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
    for (const [options] of mockLlmObject.mock.calls) {
      expect(options).toMatchObject({ timeoutMs: 60_000, maxRetries: 1 });
    }
  });

  it("never loops or hides a persistent timeout", async () => {
    const timeout = new DOMException("timed out", "TimeoutError");
    mockLlmObject.mockRejectedValue(timeout);
    await expect(generateDraft(baseReq)).rejects.toBe(timeout);
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication or non-transient provider failures", async () => {
    const auth = new Error("401 unauthorized");
    mockLlmObject.mockRejectedValue(auth);
    await expect(generateDraft(baseReq)).rejects.toBe(auth);
    expect(mockLlmObject).toHaveBeenCalledTimes(1);
  });

  it("shares the single format retry with corrective generation", async () => {
    mockLlmObject
      .mockResolvedValueOnce({
        subject: "Your July 10 gala",
        body: "Great news — your date is open.",
        availabilityStatement: "affirmed",
        wantsProfile: false,
        wantsQuote: false,
      })
      .mockRejectedValueOnce(noObject())
      .mockResolvedValueOnce({
        subject: "Your July 10 gala",
        body: "I'm sorry, but your date is already booked. Is your date flexible?",
        availabilityStatement: "conflicted",
        wantsProfile: false,
        wantsQuote: false,
      });

    const generated = await generateDraft({
      ...baseReq,
      availability: { state: "conflict", bookedTitles: ["Private event"] },
    });
    expect(generated.availabilityStatement).toBe("conflicted");
    expect(mockLlmObject).toHaveBeenCalledTimes(3);
  });

  it("uses the known-fields fallback when correction exhausts structured output", async () => {
    mockLlmObject
      .mockResolvedValueOnce({
        subject: "Sept 14",
        body: "We are available for your date.",
        availabilityStatement: "affirmed",
        wantsProfile: false,
        wantsQuote: false,
      })
      .mockRejectedValue(noObject());

    const generated = await generateDraft(baseReq);
    expect(mockLlmObject).toHaveBeenCalledTimes(3);
    expect(generated.availabilityStatement).toBe("not_addressed");
    expect(generated.body).toMatch(/exact event date/i);
    expect(validateDraft(baseReq, generated).issues).toEqual([]);
  });

  it("caps later calls by the remaining 120-second operation budget", async () => {
    const now = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(71_000)
      .mockReturnValue(71_000);
    mockLlmObject
      .mockResolvedValueOnce({
        subject: "Sept 14",
        body: "We are available for your date.",
        availabilityStatement: "affirmed",
        wantsProfile: false,
        wantsQuote: false,
      })
      .mockResolvedValueOnce({
        subject: "Sept 14",
        body: "What full date and venue are you considering?",
        availabilityStatement: "not_addressed",
        wantsProfile: false,
        wantsQuote: false,
      });

    await expect(generateDraft(baseReq)).resolves.toMatchObject({
      availabilityStatement: "not_addressed",
    });
    expect(mockLlmObject.mock.calls[0][0].timeoutMs).toBe(60_000);
    expect(mockLlmObject.mock.calls[1][0].timeoutMs).toBe(50_000);
    now.mockRestore();
  });
});

describe("exhausted structured-output fallback", () => {
  it("preserves partial availability without exposing roster details", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockLlmObject.mockRejectedValue(noObject());
    const req: DraftRequest = {
      ...baseReq,
      business: { ...baseReq.business, country: "US", currency: "USD" },
      lead: {
        source: "WEDDINGWIRE",
        clientName: "Sofia",
        eventType: "wedding",
        eventDate: "2026-09-12",
        guestCount: 120,
        message: "Looking for a DJ for about 120 guests. Are you free September 12?",
      },
      availability: { state: "partial", freePerformers: ["Sam"] },
    };

    const fallback = await generateDraft(req);
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
    expect(fallback.availabilityStatement).toBe("affirmed");
    expect(fallback.body).toMatch(/date is open/i);
    expect(fallback.body).toMatch(/what venue/i);
    expect(fallback.body).not.toMatch(/Sam|roster|other booking/i);
    expect(validateDraft(req, fallback).issues).toEqual([]);

    const receipt = warning.mock.calls
      .map(([line]) => String(line))
      .find((line) => line.includes('"kind":"draft_provider_format_fallback"'));
    expect(receipt).toBeTruthy();
    expect(receipt).not.toMatch(/Sofia|Sam|September|body/i);
    expect(JSON.parse(receipt ?? "{}")).toMatchObject({
      stage: "initial",
      availabilityState: "partial",
      usedFeatureFallback: false,
    });
  });

  it("keeps a conflict honest and names the unsupported sound-system detail", async () => {
    mockLlmObject.mockRejectedValue(noObject());
    const req: DraftRequest = {
      ...baseReq,
      lead: {
        source: "PLAIN_EMAIL",
        clientName: "Leo",
        eventType: "wedding",
        eventDate: "2026-07-10",
        message: "Are you free July 10? Also do you bring your own sound system?",
      },
      availability: { state: "conflict", bookedTitles: ["Miller wedding"] },
    };

    const fallback = await generateDraft(req);
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
    expect(fallback.availabilityStatement).toBe("conflicted");
    expect(fallback.body).toMatch(/date is already booked/i);
    expect(fallback.body).toMatch(/sound system.*confirm/is);
    expect(fallback.body).not.toMatch(/Miller|date is open|we(?:'|’)re available/i);
    expect(validateDraft(req, fallback).issues).toEqual([]);
  });

  it("quotes only an event-matched configured range when price was requested", async () => {
    mockLlmObject.mockRejectedValue(noObject());
    const req: DraftRequest = {
      ...baseReq,
      business: { ...baseReq.business, country: "US", currency: "USD" },
      packages: [
        {
          name: "Wedding Essentials",
          description: "Ceremony and reception",
          priceMin: 180_000,
          priceMax: 220_000,
          eventTypes: ["wedding"],
        },
        {
          name: "Corporate Party",
          description: "Four-hour company event",
          priceMin: 90_000,
          priceMax: 120_000,
          eventTypes: ["corporate"],
        },
      ],
      lead: {
        source: "WEBSITE_FORM",
        clientName: "Emily",
        eventType: "wedding",
        eventDate: "2026-10-17",
        venue: "Harvest Barn",
        guestCount: 140,
        message: "What does your wedding package cost?",
      },
      availability: { state: "free" },
    };

    const fallback = await generateDraft(req);
    expect(fallback.body).toMatch(/\$1,?800.*\$2,?200/s);
    expect(fallback.body).not.toMatch(/\$900|\$1,?200/);
    expect(fallback.availabilityStatement).toBe("affirmed");
    expect(validateDraft(req, fallback).issues).toEqual([]);
  });
});

describe("normalizeStatement conflict branch (P12.3 eval catch)", () => {
  it("an honest refusal that also refers an available colleague stays CONFLICTED", async () => {
    mockLlmObject.mockResolvedValue({
      subject: "Your July 10 gala",
      body: "Unfortunately July 10th is already booked on our end. I'm happy to point you to a trusted colleague who is available that night.",
      availabilityStatement: "affirmed", // the model's wrong self-report
      wantsProfile: false,
      wantsQuote: false,
    });
    const result = await generateDraft({
      ...baseReq,
      availability: { state: "conflict", bookedTitles: ["Hotel Aurora"] },
    });
    expect(result.availabilityStatement).toBe("conflicted");
  });

  it("a body that affirms a booked date twice fails closed", async () => {
    mockLlmObject.mockResolvedValue({
      subject: "Your July 10 gala",
      body: "Great news — the date is open and we're available!",
      availabilityStatement: "not_addressed",
      wantsProfile: false,
      wantsQuote: false,
    });
    await expect(
      generateDraft({
        ...baseReq,
        availability: { state: "conflict", bookedTitles: ["Hotel Aurora"] },
      }),
    ).rejects.toThrow("failed safety validation after regeneration");
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
  });

  it("regenerates once and returns the corrected booked-date reply", async () => {
    mockLlmObject
      .mockResolvedValueOnce({
        subject: "Your July 10 gala",
        body: "Great news — the date is open and we're available!",
        availabilityStatement: "affirmed",
        wantsProfile: false,
        wantsQuote: false,
      })
      .mockResolvedValueOnce({
        subject: "Your July 10 gala",
        body: "Thanks for reaching out. July 10 is already booked, but if your date is flexible I'd love to find another evening that works.",
        availabilityStatement: "conflicted",
        wantsProfile: false,
        wantsQuote: false,
      });

    const result = await generateDraft({
      ...baseReq,
      availability: { state: "conflict", bookedTitles: ["Hotel Aurora"] },
    });
    expect(result.availabilityStatement).toBe("conflicted");
    expect(mockLlmObject.mock.calls[1][0].prompt).toContain("CORRECTION REQUIRED");
  });
});

describe("unsupported-feature safe fallback", () => {
  it("replaces a repeated generic hedge with one that names the exact feature", async () => {
    mockLlmObject.mockResolvedValue({
      subject: "Photo booth details",
      body: "Let me confirm the exact photo booth details and come back to you.",
      availabilityStatement: "not_addressed",
      wantsProfile: false,
      wantsQuote: false,
    });
    const req: DraftRequest = {
      ...baseReq,
      lead: {
        source: "WEBSITE_FORM",
        clientName: "Aisha",
        eventType: "wedding",
        eventDate: "2026-11-07",
        message: "Does the photo booth package include prints?",
      },
      availability: { state: "free" },
      thread: [
        { direction: "OUTBOUND", body: "Your date is open; the booth package is available." },
        { direction: "INBOUND", body: "Does it include prints?" },
      ],
    };

    const fallback = await generateDraft(req);
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
    expect(fallback.body).toMatch(/prints.*confirm/is);
    expect(validateDraft(req, fallback).issues).toEqual([]);
  });

  it("replaces repeated print invention with a validated mid-thread uncertainty reply", async () => {
    mockLlmObject.mockResolvedValue({
      subject: "Photo booth prints",
      body: "Yes, prints are included.",
      availabilityStatement: "affirmed",
      wantsProfile: false,
      wantsQuote: false,
    });
    const req: DraftRequest = {
      ...baseReq,
      lead: {
        source: "WEBSITE_FORM",
        clientName: "Aisha",
        eventType: "wedding",
        eventDate: "2026-11-07",
        message: "Does the photo booth package include prints?",
      },
      availability: { state: "free" },
      thread: [
        { direction: "OUTBOUND", body: "Your date is open; the booth package is available." },
        { direction: "INBOUND", body: "Does it include prints?" },
      ],
    };

    const fallback = await generateDraft(req);
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
    expect(fallback.body).toMatch(/Aisha/);
    expect(fallback.body).toMatch(/prints.*confirm/is);
    expect(fallback.body).not.toMatch(/\b(?:yes|included)\b/i);
    expect(fallback.availabilityStatement).toBe("not_addressed");
    expect(validateDraft(req, fallback).issues).toEqual([]);
  });

  it("keeps a first conflict and a sound uncertainty in the deterministic fallback", async () => {
    mockLlmObject.mockResolvedValue({
      subject: "July 10",
      body: "Yes, we'll bring our sound system.",
      availabilityStatement: "not_addressed",
      wantsProfile: false,
      wantsQuote: false,
    });
    const req: DraftRequest = {
      ...baseReq,
      lead: {
        source: "PLAIN_EMAIL",
        clientName: "Leo",
        eventType: "wedding",
        eventDate: "2026-07-10",
        message: "Are you free July 10? Also do you bring your own sound system?",
      },
      availability: { state: "conflict", bookedTitles: ["Private event"] },
    };

    const fallback = await generateDraft(req);
    expect(fallback.body).toMatch(/date is already booked/i);
    expect(fallback.body).toMatch(/sound system.*confirm/is);
    expect(fallback.body).not.toMatch(/\b(?:yes|included|we(?:'|’)ll bring)\b/i);
    expect(fallback.availabilityStatement).toBe("conflicted");
    expect(validateDraft(req, fallback).issues).toEqual([]);
  });
});

describe("unknown-calendar deterministic recovery", () => {
  it("replaces two unsafe calendar claims with grounded pricing and a date question", async () => {
    mockLlmObject.mockResolvedValue({
      subject: "Your birthday",
      body: "We are available and would love to help.",
      availabilityStatement: "affirmed",
      wantsProfile: false,
      wantsQuote: true,
    });
    const req: DraftRequest = {
      ...baseReq,
      business: { ...baseReq.business, country: "US", currency: "USD" },
      packages: [
        {
          name: "Private Party (4h)",
          description: "DJ and sound system",
          priceMin: 90_000,
          priceMax: 120_000,
          eventTypes: ["birthday"],
        },
      ],
      lead: {
        source: "PLAIN_EMAIL",
        clientName: "Gary",
        eventType: "birthday",
        budgetHint: "$400 max",
        message: "Birthday party, only have $400, can you do it?",
      },
      availability: { state: "unknown" },
    };

    const fallback = await generateDraft(req);
    expect(mockLlmObject).toHaveBeenCalledTimes(2);
    expect(fallback.body).toMatch(/\$900.*\$1,?200/s);
    expect(fallback.body).toMatch(/exact event date/i);
    expect(fallback.body).not.toMatch(/\b(?:we are|we're) available\b/i);
    expect(fallback.availabilityStatement).toBe("not_addressed");
    expect(validateDraft(req, fallback).issues).toEqual([]);
  });
});
