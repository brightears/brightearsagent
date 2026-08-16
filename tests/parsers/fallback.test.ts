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
    expect(
      await parseFallback(
        {
          ...base,
          subject: "Your weekly music industry digest",
          textBody: "Five trends for festival season. Read online. Unsubscribe at any time.",
        },
        "biz1",
      ),
    ).toBeNull();
  });

  it("labeled body fields win when the model returns null (staging 2026-07-10: 'Unknown' lead)", async () => {
    mockLlmObject.mockResolvedValue({ ...extraction, clientName: null, clientEmail: null, eventDate: null });
    const lead = await parseFallback(
      {
        ...base,
        from: "notification@forms.brightears.io",
        fromName: "Availability form",
        textBody:
          "New availability inquiry via your page:\n\nName: Jessica Park\nEmail: jess@example.com\nEvent type: wedding\nEvent date: 2027-09-12\nMessage: riverside venue, 120 guests",
      },
      "biz1",
    );
    expect(lead?.source).toBe("WEBSITE_FORM");
    expect(lead?.clientName).toBe("Jessica Park");
    expect(lead?.clientEmail).toBe("jess@example.com");
    expect(lead?.eventType).toBe("wedding");
    expect(lead?.eventDate).toBe("2027-09-12");
  });

  it("drops reasoning-leak garbage in string fields (newlines/backticks/900-char monologues)", async () => {
    mockLlmObject.mockResolvedValue({
      ...extraction,
      venue: `riverside venue in Bangkok (explicitly from message, NOT guessed... ${"x".repeat(400)} \`\`\`json { "venue": null }\`\`\``,
      clientEmail: "not-an-email",
      eventDate: "sometime next year",
      notes: "line one\nline two",
    });
    const lead = await parseFallback(base, "biz1");
    expect(lead?.venue).toBeUndefined();
    expect(lead?.clientEmail).toBe("jess@example.com"); // falls back to the human sender
    expect(lead?.eventDate).toBeUndefined();
    expect(lead?.notes).toBeUndefined();
  });

  it("grounds the parse prompt with today's date", async () => {
    await parseFallback(base, "biz1");
    const call = mockLlmObject.mock.calls[0][0];
    expect(call.system).toContain(new Date().toISOString().slice(0, 10));
  });

  it("does not let model=false drop a sparse but explicit booking inquiry", async () => {
    mockLlmObject.mockResolvedValue({ ...extraction, isInquiry: false });

    const lead = await parseFallback(
      {
        ...base,
        fromName: undefined,
        subject: "Sept 12",
        textBody: "Are you free on 12 September 2027 for a wedding in Bangkok?",
      },
      "biz1",
    );

    expect(lead).toMatchObject({
      source: "PLAIN_EMAIL",
      eventType: "wedding",
      eventDate: "2027-09-12",
    });
  });

  it("recovers an explicit sparse inquiry from a provider timeout", async () => {
    mockLlmObject.mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    await expect(
      parseFallback(
        {
          ...base,
          fromName: undefined,
          subject: "Sept 12",
          textBody: "Are you free on 12 September 2027 for a wedding in Bangkok?",
        },
        "biz1",
      ),
    ).resolves.toMatchObject({ eventType: "wedding", eventDate: "2027-09-12" });
  });

  it("rethrows a timeout for ambiguous mail so the webhook can retry", async () => {
    const timeout = new DOMException("timed out", "TimeoutError");
    mockLlmObject.mockRejectedValue(timeout);

    await expect(
      parseFallback(
        { ...base, subject: "Hello", textBody: "Could you tell me more about what you do?" },
        "biz1",
      ),
    ).rejects.toBe(timeout);
  });

  it.each([
    {
      subject: "Your weekly music industry digest",
      textBody: "Five trends shaping live entertainment. Read online. Unsubscribe at any time.",
    },
    {
      subject: "Partnership opportunity for your DJ business",
      textBody: "Our SEO services get DJs more bookings. Can I book 15 minutes to show you a demo?",
    },
  ])("keeps obvious news/vendor mail out and retryable", async (mail) => {
    mockLlmObject.mockResolvedValueOnce({ ...extraction, isInquiry: false });
    await expect(parseFallback({ ...base, ...mail }, "biz1")).resolves.toBeNull();

    const timeout = new DOMException("timed out", "TimeoutError");
    mockLlmObject.mockRejectedValueOnce(timeout);
    await expect(parseFallback({ ...base, ...mail }, "biz1")).rejects.toBe(timeout);
  });

  it("lets explicit dates and guest counts beat corrupted model values", async () => {
    mockLlmObject.mockResolvedValue({
      ...extraction,
      eventType: "corporate",
      eventDate: "2028-01-01",
      guestCount: 12,
    });

    const lead = await parseFallback(
      {
        ...base,
        textBody: "Event type: Wedding\nEvent date: 2027-09-12\nGuests: 120\nMessage: Are you free?",
      },
      "biz1",
    );

    expect(lead).toMatchObject({ eventType: "wedding", eventDate: "2027-09-12", guestCount: 120 });
  });

  it("rejects placeholder venues rather than turning TBD into a lead fact", async () => {
    mockLlmObject.mockResolvedValue({ ...extraction, venue: "venue is still TBD" });
    const lead = await parseFallback(
      { ...base, textBody: "Wedding on 03/14/2027, about 90 guests. Venue is still TBD." },
      "biz1",
    );
    expect(lead?.venue).toBeUndefined();
  });

  it("extracts an explicitly named venue while rejecting a generic room description", async () => {
    mockLlmObject.mockResolvedValue({ ...extraction, venue: null });
    const named = await parseFallback(
      {
        ...base,
        textBody:
          "We are getting married on 12 September 2027 at The Siam Hotel in Bangkok with 140 guests.",
      },
      "biz1",
    );
    expect(named?.venue).toBe("The Siam Hotel");

    const generic = await parseFallback(
      {
        ...base,
        textBody:
          "We are planning a company party on 18 December 2027 at a hotel ballroom in Sathorn.",
      },
      "biz1",
    );
    expect(generic?.venue).toBeUndefined();
  });

  it.each([
    ["Hello, my name is Somchai Ratanakul. We are having our wedding reception.", "Somchai Ratanakul"],
    ["We're planning a company party. Best regards, Kessara", "Kessara"],
    ["Checking availability for our wedding. Thanks! Brooke", "Brooke"],
    ["Do you do private parties? — Nok", "Nok"],
    ["We're getting married. Name: Jessica Park. Could you send your rates?", "Jessica Park"],
  ])("extracts a defensible explicit/signature name", async (textBody, name) => {
    mockLlmObject.mockResolvedValue({ ...extraction, clientName: null });
    const lead = await parseFallback({ ...base, fromName: undefined, textBody }, "biz1");
    expect(lead?.clientName).toBe(name);
  });
});
