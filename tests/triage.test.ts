import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mockLlmObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm", () => ({ llmObject: mockLlmObject }));

import {
  SPAM_THRESHOLD,
  hasBuyerIntent,
  hasHighConfidenceVendorSolicitation,
  triage,
  triageHeuristics,
} from "@/lib/inbound/triage";
import { extractSlug } from "@/lib/inbound/pipeline";
import type { InboundEmail } from "@/lib/inbound/types";

function fixture(name: string): InboundEmail {
  return JSON.parse(
    readFileSync(join(__dirname, "..", "fixtures", "inbound", "generic", name), "utf8"),
  );
}

describe("triage heuristics", () => {
  it("flags the overpayment/wire-back scam", () => {
    const result = triageHeuristics(fixture("scam-overpayment.json"));
    expect(result.spamScore).toBeGreaterThanOrEqual(0.8);
    expect(result.reason).toMatch(/overpayment/i);
  });

  it("does not flag a genuine contact-form lead", () => {
    const result = triageHeuristics(fixture("contact-form-wedding.json"));
    expect(result.spamScore).toBeLessThan(0.5);
  });

  it("does not flag a terse price shopper — terse is not spam", () => {
    const result = triageHeuristics(fixture("terse-price-shopper.json"));
    expect(result.spamScore).toBeLessThan(0.5);
  });
});

describe("triage spam safety gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("never lets an uncorroborated cheap-model verdict hide a terse real inquiry", async () => {
    mockLlmObject.mockResolvedValue({
      category: "scam",
      spamScore: 0.99,
      reason: "Very short message with no greeting",
    });

    const result = await triage(fixture("terse-price-shopper.json"), "biz-1");

    expect(result.spamScore).toBeLessThan(SPAM_THRESHOLD);
    expect(result.reason).toMatch(/not auto-filtered/i);
  });

  it("protects explicit buyer intent even when genuine words overlap a vendor heuristic", async () => {
    const email = fixture("genuine-marketing-agency-event.json");
    expect(triageHeuristics(email).spamScore).toBeGreaterThanOrEqual(0.4);
    expect(hasBuyerIntent(email)).toBe(true);
    expect(hasHighConfidenceVendorSolicitation(email)).toBe(false);
    mockLlmObject.mockResolvedValue({
      category: "vendor_pitch",
      spamScore: 0.98,
      reason: "The sender mentions a marketing agency",
    });

    const result = await triage(email, "biz-1");

    expect(result.spamScore).toBeLessThan(SPAM_THRESHOLD);
  });

  it("does not let a bulk-mail word outweigh a direct wedding booking request", async () => {
    const email = fixture("genuine-booking-with-unsubscribe.json");
    expect(triageHeuristics(email).spamScore).toBe(0.5);
    expect(hasBuyerIntent(email)).toBe(true);
    mockLlmObject.mockResolvedValue({
      category: "bulk_marketing",
      spamScore: 0.99,
      reason: "The body contains an unsubscribe request",
    });

    expect((await triage(email, "biz-1")).spamScore).toBeLessThan(SPAM_THRESHOLD);
  });

  it("does not short-circuit when multiple generic bulk markers collide on a real buyer", async () => {
    const base = fixture("genuine-marketing-agency-event.json");
    const email = {
      ...base,
      textBody: `${base.textBody}\nPlease unsubscribe my old office address from your mailing list.`,
    };
    expect(triageHeuristics(email).spamScore).toBe(1);
    mockLlmObject.mockResolvedValue({
      category: "genuine_inquiry",
      spamScore: 0.05,
      reason: "The sender is asking to book a DJ for a real event",
    });

    const result = await triage(email, "biz-1");

    expect(result.spamScore).toBeLessThan(SPAM_THRESHOLD);
    expect(mockLlmObject).toHaveBeenCalledOnce();
  });

  it("fails open when generic-only evidence collides and the classifier is unavailable", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const email = {
      ...fixture("genuine-marketing-agency-event.json"),
      textBody:
        "Our marketing agency needs a DJ for a client event. Please unsubscribe an old office address from your list.",
    };
    expect(triageHeuristics(email).spamScore).toBe(1);

    const result = await triage(email, "biz-1");

    expect(result.spamScore).toBeLessThan(SPAM_THRESHOLD);
    expect(result.reason).toMatch(/classifier is unavailable/i);
    expect(mockLlmObject).not.toHaveBeenCalled();
  });

  it("filters an obvious vendor solicitation when deterministic evidence corroborates the model", async () => {
    const email = fixture("vendor-seo-solicitation.json");
    expect(triageHeuristics(email).spamScore).toBe(0.5);
    expect(hasBuyerIntent(email)).toBe(false);
    expect(hasHighConfidenceVendorSolicitation(email)).toBe(true);

    const result = await triage(email, "biz-1");

    expect(result.spamScore).toBeGreaterThanOrEqual(SPAM_THRESHOLD);
    expect(result.reason).toMatch(/explicit seo\/web-design/i);
    expect(mockLlmObject).not.toHaveBeenCalled();
  });

  it("does not treat ambiguous marketing-agency wording plus an LLM verdict as seller evidence", async () => {
    const base = fixture("genuine-marketing-agency-event.json");
    const email = {
      ...base,
      subject: "Marketing agency introduction",
      textBody: "I work with a marketing agency and thought an introduction might be useful. Open to talking?",
    };
    expect(hasBuyerIntent(email)).toBe(false);
    expect(triageHeuristics(email).spamScore).toBe(0.5);
    expect(hasHighConfidenceVendorSolicitation(email)).toBe(false);
    mockLlmObject.mockResolvedValue({
      category: "vendor_pitch",
      spamScore: 0.99,
      reason: "This may be a vendor introduction",
    });

    const result = await triage(email, "biz-1");

    expect(result.spamScore).toBeLessThan(SPAM_THRESHOLD);
    expect(result.reason).toMatch(/not auto-filtered/i);
  });

  it("fails open when the classifier times out on a terse genuine buyer", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockLlmObject.mockRejectedValue(new Error("provider timed out"));

    const result = await triage(fixture("terse-price-shopper.json"), "biz-1");

    expect(result.spamScore).toBeLessThan(SPAM_THRESHOLD);
    expect(result.reason).toMatch(/left in Inbox/i);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"kind":"triage-classifier"'));
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("how much for 3 hours"));
  });

  it("keeps strong overpayment scams on the deterministic fast path", async () => {
    const result = await triage(fixture("scam-overpayment.json"), "biz-1");

    expect(result.spamScore).toBeGreaterThanOrEqual(0.8);
    expect(mockLlmObject).not.toHaveBeenCalled();
  });

  it("retains a high provider spam verdict without paying for model triage", async () => {
    const email = {
      ...fixture("terse-price-shopper.json"),
      headers: { "X-Spam-Score": "8.4" },
    };

    const result = await triage(email, "biz-1");

    expect(result.spamScore).toBeGreaterThanOrEqual(SPAM_THRESHOLD);
    expect(result.reason).toContain("8.4");
    expect(mockLlmObject).not.toHaveBeenCalled();
  });
});

describe("tenant slug extraction", () => {
  it("extracts the slug from a parse address", () => {
    expect(extractSlug("leads@demo-dj-co.in.brightears.io")).toBe("demo-dj-co");
  });
  it("extracts from display-name and list forms", () => {
    expect(extractSlug("Demo DJ Co <leads@demo-dj-co.in.brightears.io>")).toBe("demo-dj-co");
    expect(extractSlug("a@b.test, leads@demo-dj-co.in.brightears.io")).toBe("demo-dj-co");
  });
  it("returns null for unrelated addresses", () => {
    expect(extractSlug("owner@demodjco.test")).toBeNull();
  });
  it("rejects local parts that merely END in 'leads' (anchoring)", () => {
    expect(extractSlug("djleads@demo-dj-co.in.brightears.io")).toBeNull();
    expect(extractSlug("myleads@demo-dj-co.in.brightears.io")).toBeNull();
  });
});
