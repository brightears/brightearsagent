import { beforeEach, describe, expect, it, vi } from "vitest";

// Task-mode selection (10.8): the drafter has THREE modes — first reply,
// sequence follow-up, and mid-conversation (client wrote back after we
// replied). Before the third existed, ENGAGED replies took the FIRST-reply
// task and re-introduced the act mid-thread.

const mockLlmObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm", () => ({ llmObject: mockLlmObject }));

import { generateDraft } from "@/lib/agent/drafter";
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

  it("a body that affirms WITHOUT refusing is still the visible safety failure", async () => {
    mockLlmObject.mockResolvedValue({
      subject: "Your July 10 gala",
      body: "Great news — the date is open and we're available!",
      availabilityStatement: "not_addressed",
      wantsProfile: false,
      wantsQuote: false,
    });
    const result = await generateDraft({
      ...baseReq,
      availability: { state: "conflict", bookedTitles: ["Hotel Aurora"] },
    });
    expect(result.availabilityStatement).toBe("affirmed");
  });
});
