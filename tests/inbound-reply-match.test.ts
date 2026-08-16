import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  message: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  lead: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  sequenceRun: { updateMany: vi.fn() },
  draft: { updateMany: vi.fn() },
  outreachSuppression: { upsert: vi.fn() },
  venue: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  venuePitch: { findFirst: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
const mockParseFallback = vi.hoisted(() => vi.fn());
const mockTriage = vi.hoisted(() => vi.fn());
const mockGenerateDraft = vi.hoisted(() => vi.fn());
const mockMeterState = vi.hoisted(() => vi.fn());
const mockDetectAutoReply = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/inbound/parsers/fallback", () => ({ parseFallback: mockParseFallback }));
vi.mock("@/lib/inbound/triage", () => ({
  triage: mockTriage,
  triageHeuristics: vi.fn(() => ({ spamScore: 0, reason: "none" })),
  SPAM_THRESHOLD: 0.7,
}));
vi.mock("@/lib/agent/generate-for-lead", () => ({ generateDraftForLead: mockGenerateDraft }));
vi.mock("@/lib/agent/schedule-send", () => ({ scheduleAutonomousSend: vi.fn() }));
vi.mock("@/lib/billing/metering", () => ({ meterState: mockMeterState }));
vi.mock("@/lib/notify", () => ({ notifyBusiness: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/inbound/forwarding-confirmation", () => ({
  detectForwardingConfirmation: vi.fn(() => null),
}));
vi.mock("@/lib/inbound/auto-reply", () => ({ detectAutoReply: mockDetectAutoReply }));

import { processInbound } from "@/lib/inbound/pipeline";
import {
  assessReplyMatch,
  normalizeThreadSubject,
  type ReplyMatchLead,
} from "@/lib/inbound/reply-match";
import type { InboundEmail } from "@/lib/inbound/types";

const TODAY = new Date("2026-08-16T12:00:00Z");

function mail(overrides: Partial<InboundEmail> = {}): InboundEmail {
  return {
    from: "jordan@example.com",
    to: "leads@sapphire-sounds.in.brightears.io",
    subject: "Re: Wedding reception — 12 September 2027",
    textBody: "Thanks, that sounds good. Can you also bring uplighting?",
    providerMessageId: "pm-inbound-2",
    ...overrides,
  };
}

function candidate(overrides: Partial<ReplyMatchLead> = {}): ReplyMatchLead {
  return {
    rawSubject: "Wedding reception — 12 September 2027",
    eventType: "wedding",
    eventDate: new Date("2027-09-12T12:00:00Z"),
    messages: [
      {
        subject: "Wedding reception — 12 September 2027",
        providerMessageId: "outbound-uuid-1",
      },
    ],
    ...overrides,
  };
}

describe("same-sender reply evidence", () => {
  it("normalizes repeated and localized reply prefixes without erasing the subject", () => {
    expect(normalizeThreadSubject(" Re: AW: Fwd: Wedding Reception ")).toBe(
      "wedding reception",
    );
  });

  it("keeps a genuine reply on the existing thread when its subject continues it", () => {
    expect(assessReplyMatch(mail(), candidate(), TODAY)).toMatchObject({
      attach: true,
      reason: "subject_and_event",
    });
  });

  it("does not let quoted history manufacture an event conflict", () => {
    const result = assessReplyMatch(
      mail({
        textBody:
          "Sounds perfect.\n\nOn Tuesday, Sapphire Sounds wrote:\n> Wedding reception on 12 September 2027",
      }),
      candidate(),
      TODAY,
    );
    expect(result.attach).toBe(true);
  });

  it("rejects a genuinely different event from the same sender even inside 45 days", () => {
    const result = assessReplyMatch(
      mail({
        subject: "DJ needed for company gala — 18 October 2027",
        textBody: "Our corporate gala is for the London office.",
      }),
      candidate(),
      TODAY,
    );
    expect(result).toEqual({ attach: false, score: 0, reason: "event_conflict" });
  });

  it("lets fresh event facts beat a stale reply subject", () => {
    const result = assessReplyMatch(
      mail({
        // Some people start a new request from an old email instead of using
        // Compose, so the mail client preserves a deceptively matching subject.
        subject: "Re: Wedding reception — 12 September 2027",
        textBody: "Separate request: our corporate gala is on 18 October 2027.",
      }),
      candidate(),
      TODAY,
    );
    expect(result).toEqual({ attach: false, score: 0, reason: "new_event_intent" });
  });

  it("does not use a shared event type alone as continuity evidence", () => {
    const result = assessReplyMatch(
      mail({ subject: "Another wedding inquiry", textBody: "Could you share your packages?" }),
      candidate({ eventDate: null }),
      TODAY,
    );
    expect(result).toEqual({ attach: false, score: 0, reason: "no_continuity" });
  });

  it("lets an exact RFC thread reference outrank changed event details", () => {
    const result = assessReplyMatch(
      mail({
        subject: "Schedule change",
        textBody: "We need to move it to 18 October 2027.",
        headers: { "In-Reply-To": "<outbound-uuid-1@mtasv.net>" },
      }),
      candidate(),
      TODAY,
    );
    expect(result).toEqual({ attach: true, score: 100, reason: "thread_reference" });
  });

  it("does not let a real thread reference swallow an explicitly separate booking", () => {
    const result = assessReplyMatch(
      mail({
        subject: "Re: Wedding reception — 12 September 2027",
        textBody: "I also have a second corporate event on 18 October 2027.",
        headers: { "In-Reply-To": "<outbound-uuid-1@mtasv.net>" },
      }),
      candidate(),
      TODAY,
    );
    expect(result).toEqual({ attach: false, score: 0, reason: "new_event_intent" });
  });
});

const business = {
  id: "biz1",
  slug: "sapphire-sounds",
  name: "Sapphire Sounds",
  plan: "STARTER",
  trialEndsAt: null,
  timezone: "Europe/London",
  autoSendSources: [],
  stripeSubscriptionId: "sub_1",
};

function dbCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-old",
    businessId: "biz1",
    status: "REPLIED",
    venueId: null,
    clientName: "Jordan",
    clientEmail: "jordan@example.com",
    createdAt: new Date("2026-08-10T09:00:00Z"),
    deadAt: null,
    rawSubject: "Wedding reception — 12 September 2027",
    eventType: "wedding",
    eventDate: new Date("2027-09-12T12:00:00Z"),
    messages: [
      {
        createdAt: new Date("2026-08-15T08:00:00Z"),
        subject: "Wedding reception — 12 September 2027",
        providerMessageId: "outbound-uuid-1",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.business.findUnique.mockResolvedValue(business);
  mockDb.business.findMany.mockResolvedValue([]);
  mockDb.message.findFirst.mockResolvedValue(null);
  mockDb.message.count.mockResolvedValue(1);
  mockDb.message.create.mockResolvedValue({ id: "message-1" });
  mockDb.lead.findFirst.mockResolvedValue(null);
  mockDb.lead.findMany.mockResolvedValue([]);
  mockDb.lead.update.mockResolvedValue({});
  mockDb.lead.create.mockResolvedValue({ id: "lead-new", clientName: "Jordan" });
  mockDb.sequenceRun.updateMany.mockResolvedValue({ count: 1 });
  mockDb.draft.updateMany.mockResolvedValue({ count: 1 });
  mockDb.venue.findFirst.mockResolvedValue(null);
  mockDb.venue.update.mockResolvedValue({});
  mockDb.venue.updateMany.mockResolvedValue({ count: 0 });
  mockDb.venuePitch.updateMany.mockResolvedValue({ count: 0 });
  mockParseFallback.mockResolvedValue({
    source: "PLAIN_EMAIL",
    clientName: "Jordan",
    clientEmail: "jordan@example.com",
    eventType: "corporate",
    eventDate: "2027-10-18",
    confidence: 0.6,
  });
  mockTriage.mockResolvedValue({ spamScore: 0.02, reason: "genuine inquiry" });
  mockMeterState.mockResolvedValue({ used: 1, cap: 15, overCap: false });
  mockGenerateDraft.mockResolvedValue("draft-1");
  mockDetectAutoReply.mockReturnValue(null);
});

describe("processInbound repeat sender routing", () => {
  it("creates a separate lead for a different event received within the window", async () => {
    mockDb.lead.findMany.mockResolvedValue([dbCandidate()]);

    const result = await processInbound(
      mail({
        subject: "DJ needed for company gala — 18 October 2027",
        textBody: "This is a separate corporate event for our London office.",
      }),
    );

    expect(result).toEqual({ outcome: "lead_created", leadId: "lead-new", status: "NEW" });
    expect(mockDb.message.create).not.toHaveBeenCalled();
    expect(mockDb.lead.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: "corporate",
        eventDate: new Date("2027-10-18T12:00:00Z"),
        rawSubject: "DJ needed for company gala — 18 October 2027",
      }),
    });
    expect(mockGenerateDraft).toHaveBeenCalledWith("lead-new");
  });

  it("attaches a genuine subject-threaded response and keeps normal reply handling", async () => {
    mockDb.lead.findMany.mockResolvedValue([dbCandidate()]);

    const result = await processInbound(mail());

    expect(result).toEqual({ outcome: "reply_attached", leadId: "lead-old" });
    expect(mockDb.lead.create).not.toHaveBeenCalled();
    expect(mockDb.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: "lead-old",
        direction: "INBOUND",
        providerMessageId: "pm-inbound-2",
      }),
    });
    expect(mockGenerateDraft).toHaveBeenCalledWith("lead-old", 0, { suppressPush: true });
  });

  it("routes a referenced reply to the older of two live events", async () => {
    mockDb.lead.findMany.mockResolvedValue([
      dbCandidate({
        id: "lead-newer",
        rawSubject: "Birthday on 3 October 2027",
        eventType: "birthday",
        eventDate: new Date("2027-10-03T12:00:00Z"),
        messages: [
          {
            createdAt: new Date("2026-08-16T08:00:00Z"),
            subject: "Birthday on 3 October 2027",
            providerMessageId: "outbound-newer",
          },
        ],
      }),
      dbCandidate(),
    ]);

    const result = await processInbound(
      mail({
        subject: "Schedule update",
        textBody: "We need to move the wedding to 18 October 2027.",
        headers: { References: "<unrelated@example.net> <outbound-uuid-1@mtasv.net>" },
      }),
    );

    expect(result).toEqual({ outcome: "reply_attached", leadId: "lead-old" });
  });

  it("records a mangled out-of-office notice without treating it as a new event", async () => {
    mockDb.lead.findMany.mockResolvedValue([dbCandidate()]);
    mockDetectAutoReply.mockReturnValue("subject + no-reply sender");

    const result = await processInbound(
      mail({
        subject: "Automatic reply: away from the office",
        textBody: "I am away until 18 October 2027.",
      }),
    );

    expect(result).toEqual({ outcome: "ignored", reason: "auto_reply" });
    expect(mockDb.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ leadId: "lead-old", autoReply: true }),
    });
    expect(mockDb.lead.create).not.toHaveBeenCalled();
    expect(mockDb.lead.update).not.toHaveBeenCalled();
    expect(mockGenerateDraft).not.toHaveBeenCalled();
  });
});
