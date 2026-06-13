import { beforeEach, describe, expect, it, vi } from "vitest";

// sendTestEmail action — the mailbox onboarding affordance. It must:
//  - require a CONNECTED mailbox (else friendly error, no send),
//  - generate a SAMPLE pitch in the owner's voice and send it to the OWNER'S
//    OWN connected address (To + Reply-To), subject prefixed "[Test] ",
//  - prepend the unmissable TEST banner to the body,
//  - NEVER create Venue or VenuePitch rows,
//  - fall back to a static body (and still send) if generation throws.
// sendGmail + the LLM are mocked so no real Gmail/OpenRouter call happens; the
// DB is mocked the way venues-actions.test.ts / send-venue-pitch.test.ts do.

const mockDb = vi.hoisted(() => ({
  mailboxConnection: { findUnique: vi.fn() },
  // Present so we can ASSERT they're never called (no row writes).
  venue: { create: vi.fn(), updateMany: vi.fn() },
  venuePitch: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({
  getCurrentBusiness: vi.fn(async () => ({
    id: "biz1",
    name: "Sapphire Sounds",
    slug: "sapphire-sounds",
    ownerEmail: "maya@login.com",
    ownerName: "Maya Reyes",
    performerKind: "DJ",
    country: "GB", // STANDARD jurisdiction → footer resolves
    timezone: "Europe/London",
    voiceSamples: null,
    headline: null,
    bio: null,
    genres: ["house"],
    eventTypes: ["weddings"],
    serviceCities: ["Manchester"],
    feeFloor: null,
    feeSweetSpot: null,
    reviewQuotes: [],
    notableVenues: [],
    pitchLanguages: ["en"],
  })),
}));

type GmailSendInput = {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  replyToEmail?: string;
};
const sendGmail = vi.hoisted(() =>
  vi.fn(async (_businessId: string, _input: GmailSendInput) => ({ messageId: "gmail-test-1" })),
);
vi.mock("@/lib/outbound/gmail", () => ({
  sendGmail,
  MailboxError: class MailboxError extends Error {},
}));

// Keep epkUrlFor/pitchLanguageFor real; never let the action hit OpenRouter.
vi.mock("@/lib/agent/venue-pitch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agent/venue-pitch")>()),
  generateVenuePitch: vi.fn(async () => ({
    subject: "DJ for your rooftop opening?",
    body: "Saw you're opening a rooftop in Manchester — I'd love to play your launch.",
    model: "test/model",
  })),
}));

import { sendTestEmail } from "@/app/actions/venues";
import { TEST_EMAIL_BANNER, __resetTestSendLog } from "@/lib/outreach/test-email";
import { generateVenuePitch } from "@/lib/agent/venue-pitch";

beforeEach(() => {
  vi.clearAllMocks();
  __resetTestSendLog(); // the in-memory rate limiter persists across calls
  mockDb.mailboxConnection.findUnique.mockResolvedValue({
    email: "maya@studio.com",
    status: "CONNECTED",
  });
});

describe("sendTestEmail — requires a connected mailbox", () => {
  it("returns a friendly error and never sends when there is no connection", async () => {
    mockDb.mailboxConnection.findUnique.mockResolvedValue(null);
    const result = await sendTestEmail();
    expect(result).toEqual({ ok: false, error: "Connect your mailbox first" });
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("returns a friendly error and never sends when the mailbox is in ERROR", async () => {
    mockDb.mailboxConnection.findUnique.mockResolvedValue({
      email: "maya@studio.com",
      status: "ERROR",
    });
    const result = await sendTestEmail();
    expect(result).toEqual({ ok: false, error: "Connect your mailbox first" });
    expect(sendGmail).not.toHaveBeenCalled();
  });
});

describe("sendTestEmail — sends a sample to the owner's OWN address", () => {
  it("sends to the connection's own email with a [Test] subject and the banner in the body", async () => {
    const result = await sendTestEmail();
    expect(result).toEqual({ ok: true, sentTo: "maya@studio.com" });
    expect(sendGmail).toHaveBeenCalledOnce();

    const [businessId, input] = sendGmail.mock.calls[0];
    expect(businessId).toBe("biz1");
    // To AND Reply-To are the owner's OWN connected address — never a venue.
    expect(input.toEmail).toBe("maya@studio.com");
    expect(input.replyToEmail).toBe("maya@studio.com");
    // Subject carries the [Test] prefix in front of the generated subject.
    expect(input.subject).toContain("[Test]");
    expect(input.subject).toContain("DJ for your rooftop opening?");
    // The unmissable banner is the first line of the body.
    expect(input.body.startsWith(TEST_EMAIL_BANNER)).toBe(true);
    expect(input.body).toContain("No venue received this.");
    // The generated pitch body follows the banner.
    expect(input.body).toContain("Saw you're opening a rooftop");
    // The same jurisdiction footer a real STANDARD send appends is present.
    expect(input.body).toContain("Sapphire Sounds · Manchester");
  });

  it("passes the tenant's REAL profile + a built-in sample venue to the generator", async () => {
    await sendTestEmail();
    const req = vi.mocked(generateVenuePitch).mock.calls[0][0];
    // Real profile.
    expect(req.business.name).toBe("Sapphire Sounds");
    expect(req.business.ownerName).toBe("Maya Reyes");
    expect(req.business.id).toBe("biz1"); // logs LlmUsage per rule 8
    // Built-in sample venue in the tenant's first service city, HOT, own country.
    expect(req.venue.name).toBe("The Sample Rooftop");
    expect(req.venue.city).toBe("Manchester");
    expect(req.venue.country).toBe("GB");
    expect(req.venue.temperature).toBe("HOT");
    expect(req.venue.signals.length).toBeGreaterThan(0);
    expect(req.venue.fitReasons.length).toBeGreaterThan(0);
  });

  it("NEVER creates Venue or VenuePitch rows", async () => {
    await sendTestEmail();
    expect(mockDb.venue.create).not.toHaveBeenCalled();
    expect(mockDb.venue.updateMany).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.create).not.toHaveBeenCalled();
  });
});

describe("sendTestEmail — generation failure falls back to a static sample", () => {
  it("still sends (with the banner) when the generator throws", async () => {
    vi.mocked(generateVenuePitch).mockRejectedValueOnce(new Error("openrouter down"));
    const result = await sendTestEmail();
    expect(result).toEqual({ ok: true, sentTo: "maya@studio.com" });
    expect(sendGmail).toHaveBeenCalledOnce();
    const input = sendGmail.mock.calls[0][1];
    expect(input.subject).toContain("[Test]");
    expect(input.body.startsWith(TEST_EMAIL_BANNER)).toBe(true);
    // Static fallback subject/body.
    expect(input.body).toContain("The Sample Rooftop");
    expect(mockDb.venuePitch.create).not.toHaveBeenCalled();
  });
});

describe("sendTestEmail — transport errors surface as friendly form errors", () => {
  it("surfaces a MailboxError message", async () => {
    const { MailboxError } = await import("@/lib/outbound/gmail");
    sendGmail.mockRejectedValueOnce(new MailboxError("Reconnect your mailbox"));
    const result = await sendTestEmail();
    expect(result).toEqual({ ok: false, error: "Reconnect your mailbox" });
  });

  it("surfaces a generic friendly error for a non-MailboxError throw", async () => {
    sendGmail.mockRejectedValueOnce(new Error("network blip"));
    const result = await sendTestEmail();
    expect(result).toEqual({
      ok: false,
      error: "The test email didn't go through — try again in a moment",
    });
  });
});
