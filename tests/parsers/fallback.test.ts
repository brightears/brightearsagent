import { beforeEach, describe, expect, it, vi } from "vitest";

// Fallback parser source classification (10.11): a form-system sender IS the
// website form — otherwise every fallback lead lands as PLAIN_EMAIL and the
// auto-send card's "Your website form" trust checkbox can never match.

const mockLlmObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm", () => ({ llmObject: mockLlmObject }));

import { parseFallback } from "@/lib/inbound/parsers/fallback";
import type { InboundEmail } from "@/lib/inbound/types";

const base: InboundEmail = {
  from: "jess@example.com",
  fromName: "Jess Park",
  to: "leads@sapphire-sounds.in.brightears.io",
  subject: "Wedding on Sept 14",
  textBody: "Hi — are you free Sept 14? — Jess",
};

const extraction = {
  isInquiry: true,
  clientName: "Jess Park",
  clientEmail: "jess@example.com",
  clientPhone: null,
  eventType: "wedding",
  eventDate: "2026-09-14",
  venue: null,
  guestCount: null,
  budgetHint: null,
  notes: "wedding availability ask",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLlmObject.mockResolvedValue(extraction);
});

describe("parseFallback source classification", () => {
  it("human sender → PLAIN_EMAIL, sender usable as contact default", async () => {
    mockLlmObject.mockResolvedValue({ ...extraction, clientName: null, clientEmail: null });
    const lead = await parseFallback(base, "biz1");
    expect(lead?.source).toBe("PLAIN_EMAIL");
    expect(lead?.clientEmail).toBe("jess@example.com");
    expect(lead?.clientName).toBe("Jess Park");
  });

  it("form-system sender → WEBSITE_FORM, never defaulted as the client's address", async () => {
    mockLlmObject.mockResolvedValue({ ...extraction, clientName: null, clientEmail: null });
    const lead = await parseFallback(
      { ...base, from: "no-reply@wordpress.com", fromName: "Contact Form" },
      "biz1",
    );
    expect(lead?.source).toBe("WEBSITE_FORM");
    expect(lead?.clientEmail).toBeUndefined();
    expect(lead?.clientName).toBeUndefined();
  });

  it("form-system sender still passes through extracted client details", async () => {
    const lead = await parseFallback(
      { ...base, from: "notification@jotform.com", fromName: "JotForm" },
      "biz1",
    );
    expect(lead?.source).toBe("WEBSITE_FORM");
    expect(lead?.clientEmail).toBe("jess@example.com");
  });

  it("non-inquiries return null", async () => {
    mockLlmObject.mockResolvedValue({ ...extraction, isInquiry: false });
    expect(await parseFallback(base, "biz1")).toBeNull();
  });
});
