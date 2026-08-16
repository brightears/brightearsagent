import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  message: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  lead: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  sequenceRun: { updateMany: vi.fn() },
  draft: { updateMany: vi.fn() },
  globalOutreachSuppression: { upsert: vi.fn() },
  outreachSuppression: { upsert: vi.fn() },
  venue: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  venuePitch: { findFirst: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
const mockGenerateDraft = vi.hoisted(() => vi.fn());
const mockMeterState = vi.hoisted(() => vi.fn());
const mockNotify = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/agent/generate-for-lead", () => ({ generateDraftForLead: mockGenerateDraft }));
vi.mock("@/lib/agent/schedule-send", () => ({ scheduleAutonomousSend: vi.fn() }));
vi.mock("@/lib/billing/metering", () => ({ meterState: mockMeterState }));
vi.mock("@/lib/notify", () => ({ notifyBusiness: mockNotify }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/inbound/forwarding-confirmation", () => ({
  detectForwardingConfirmation: vi.fn(() => null),
}));
vi.mock("@/lib/inbound/auto-reply", () => ({ detectAutoReply: vi.fn(() => null) }));

import { processInbound } from "@/lib/inbound/pipeline";
import type { InboundEmail } from "@/lib/inbound/types";

const business = {
  id: "biz1",
  slug: "sapphire-sounds",
  name: "Sapphire Sounds",
  plan: "STARTER",
  trialEndsAt: null,
  timezone: "Europe/London",
};

function inbound(overrides: Partial<InboundEmail> = {}): InboundEmail {
  return {
    from: "Events@Velvet.CO",
    to: "leads@sapphire-sounds.in.brightears.io",
    subject: "Re: Friday rotation",
    textBody: "Please unsubscribe us from your list.",
    providerMessageId: "pm-inbound-1",
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
  mockDb.lead.findMany.mockResolvedValue([]);
  mockDb.lead.update.mockResolvedValue({});
  mockDb.lead.create.mockResolvedValue({ id: "lead-new" });
  mockDb.sequenceRun.updateMany.mockResolvedValue({ count: 1 });
  mockDb.draft.updateMany.mockResolvedValue({ count: 1 });
  mockDb.globalOutreachSuppression.upsert.mockResolvedValue({ id: "global-suppression-1" });
  mockDb.outreachSuppression.upsert.mockResolvedValue({ id: "suppression-1" });
  mockDb.venue.update.mockResolvedValue({});
  mockDb.venue.updateMany.mockResolvedValue({ count: 1 });
  mockDb.venuePitch.updateMany.mockResolvedValue({ count: 1 });
  mockGenerateDraft.mockResolvedValue("draft-1");
  mockMeterState.mockResolvedValue({ overCap: false });
  mockNotify.mockResolvedValue(undefined);
});

describe("processInbound explicit opt-out hard stop", () => {
  it("atomically closes a matched Hunt lead, its venue and every queued automation", async () => {
    mockDb.lead.findFirst.mockResolvedValue({
      id: "lead-existing",
      businessId: "biz1",
      status: "ENGAGED",
      venueId: "venue-1",
      clientName: "Velvet Lounge",
      clientEmail: "events@velvet.co",
      createdAt: new Date("2026-08-15T09:00:00Z"),
      deadAt: null,
      messages: [{ createdAt: new Date("2026-08-16T08:00:00Z") }],
    });

    const result = await processInbound(inbound());

    expect(result).toEqual({
      outcome: "opted_out",
      leadId: "lead-existing",
      venueId: "venue-1",
    });
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
    expect(mockDb.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: "lead-existing",
        direction: "INBOUND",
        body: "Please unsubscribe us from your list.",
        providerMessageId: "pm-inbound-1",
      }),
    });
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-existing" },
      data: expect.objectContaining({ status: "DEAD", optedOut: true, deadAt: expect.any(Date) }),
    });
    expect(mockDb.sequenceRun.updateMany).toHaveBeenCalledWith({
      where: { leadId: "lead-existing", stoppedAt: null },
      data: expect.objectContaining({ stoppedAt: expect.any(Date), stopReason: "opted_out" }),
    });
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith({
      where: { leadId: "lead-existing", status: "PENDING" },
      data: expect.objectContaining({
        status: "EXPIRED",
        scheduledSendAt: null,
        decidedAt: expect.any(Date),
      }),
    });
    expect(mockDb.outreachSuppression.upsert).toHaveBeenCalledWith({
      where: { businessId_email: { businessId: "biz1", email: "events@velvet.co" } },
      create: { businessId: "biz1", email: "events@velvet.co", reason: "unsubscribe" },
      update: { reason: "unsubscribe" },
    });
    expect(mockDb.globalOutreachSuppression.upsert).toHaveBeenCalledWith({
      where: { email: "events@velvet.co" },
      create: {
        email: "events@velvet.co",
        reason: "unsubscribe",
        sourceBusinessId: "biz1",
      },
      update: {},
    });
    expect(mockDb.venue.updateMany).toHaveBeenCalledWith({
      where: { id: "venue-1", businessId: "biz1", status: { not: "BOOKED" } },
      data: expect.objectContaining({
        status: "SUPPRESSED",
        suppressedReason: "unsubscribe",
        contactState: "SUPPRESSED",
      }),
    });
    expect(mockDb.venuePitch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          venueId: "venue-1",
          status: { in: ["PENDING", "APPROVED"] },
        }),
        data: expect.objectContaining({ status: "EXPIRED" }),
      }),
    );
    expect(mockDb.message.count).not.toHaveBeenCalled();
    expect(mockMeterState).not.toHaveBeenCalled();
    expect(mockGenerateDraft).not.toHaveBeenCalled();
  });

  it("stores a first venue opt-out as an auditable terminal thread without counting a conversation", async () => {
    mockDb.lead.findFirst.mockResolvedValue(null);
    mockDb.venue.findFirst.mockResolvedValue({
      id: "venue-1",
      businessId: "biz1",
      name: "Velvet Lounge",
      bookingContactName: "Sam",
      bookingEmail: "events@velvet.co",
      status: "PITCHED",
      pitchedAt: new Date("2026-08-10T09:00:00Z"),
      repliedAt: null,
    });
    mockDb.venuePitch.findFirst.mockResolvedValue({
      subject: "Friday rotation",
      editedSubject: null,
      body: "Would you be open to a short intro?",
      editedBody: null,
      sentAt: new Date("2026-08-10T09:00:00Z"),
    });

    const result = await processInbound(
      inbound({
        textBody: "Please cease and desist all communications.",
        providerMessageId: "pm-inbound-2",
      }),
    );

    expect(result).toEqual({ outcome: "opted_out", leadId: "lead-new", venueId: "venue-1" });
    const leadData = mockDb.lead.create.mock.calls[0][0].data;
    expect(leadData).toMatchObject({
      businessId: "biz1",
      source: "VENUE_OUTREACH",
      status: "DEAD",
      optedOut: true,
      venueId: "venue-1",
      clientEmail: "Events@Velvet.CO",
      rawBody: "Please cease and desist all communications.",
    });
    expect(leadData.deadAt).toBeInstanceOf(Date);
    expect(leadData.messages.create).toHaveLength(2);
    expect(leadData.messages.create[0]).toMatchObject({
      direction: "OUTBOUND",
      subject: "Friday rotation",
    });
    expect(leadData.messages.create[1]).toMatchObject({
      direction: "INBOUND",
      body: "Please cease and desist all communications.",
      providerMessageId: "pm-inbound-2",
    });
    expect(mockDb.venue.updateMany).toHaveBeenCalledWith({
      where: { id: "venue-1", businessId: "biz1", status: { not: "BOOKED" } },
      data: expect.objectContaining({
        status: "SUPPRESSED",
        suppressedReason: "cease-and-desist",
      }),
    });
    // An opt-out is a response but not a successful sales conversation.
    expect(mockDb.venue.updateMany.mock.calls[0][0].data.repliedAt).toBeUndefined();
    expect(mockDb.outreachSuppression.upsert).toHaveBeenCalledWith({
      where: { businessId_email: { businessId: "biz1", email: "events@velvet.co" } },
      create: {
        businessId: "biz1",
        email: "events@velvet.co",
        reason: "cease-and-desist",
      },
      update: { reason: "cease-and-desist" },
    });
    expect(mockDb.globalOutreachSuppression.upsert).toHaveBeenCalledWith({
      where: { email: "events@velvet.co" },
      create: {
        email: "events@velvet.co",
        reason: "cease-and-desist",
        sourceBusinessId: "biz1",
      },
      update: {
        reason: "cease-and-desist",
        sourceBusinessId: "biz1",
      },
    });
    expect(mockMeterState).not.toHaveBeenCalled();
    expect(mockGenerateDraft).not.toHaveBeenCalled();
  });

  it("records an unmatched explicit stop globally without manufacturing a lead", async () => {
    mockDb.lead.findFirst.mockResolvedValue(null);
    mockDb.venue.findFirst.mockResolvedValue(null);

    const result = await processInbound(
      inbound({
        from: "Unknown@Example.COM",
        textBody: "Please unsubscribe me from all messages.",
        providerMessageId: "pm-unmatched-stop",
      }),
    );

    expect(result).toEqual({ outcome: "opted_out" });
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
    expect(mockDb.outreachSuppression.upsert).toHaveBeenCalledWith({
      where: {
        businessId_email: { businessId: "biz1", email: "unknown@example.com" },
      },
      create: {
        businessId: "biz1",
        email: "unknown@example.com",
        reason: "unsubscribe",
      },
      update: { reason: "unsubscribe" },
    });
    expect(mockDb.globalOutreachSuppression.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "unknown@example.com" },
        create: expect.objectContaining({
          email: "unknown@example.com",
          reason: "unsubscribe",
        }),
      }),
    );
    expect(mockDb.lead.create).not.toHaveBeenCalled();
    expect(mockGenerateDraft).not.toHaveBeenCalled();
  });

  it("keeps an ordinary negative reply in the normal conversation-and-draft flow", async () => {
    mockDb.lead.findMany.mockResolvedValue([{
      id: "lead-existing",
      businessId: "biz1",
      status: "ENGAGED",
      venueId: null,
      clientName: "Sam",
      clientEmail: "events@velvet.co",
      createdAt: new Date("2026-08-15T09:00:00Z"),
      deadAt: null,
      rawSubject: "Friday rotation",
      eventType: "residency",
      eventDate: null,
      messages: [{
        createdAt: new Date("2026-08-16T08:00:00Z"),
        subject: "Friday rotation",
        providerMessageId: "pm-outbound-1",
      }],
    }]);

    const result = await processInbound(
      inbound({
        textBody: "No thanks for Friday. Do not hesitate to contact me if a Wednesday opens up.",
        providerMessageId: "pm-inbound-3",
      }),
    );

    expect(result).toEqual({ outcome: "reply_attached", leadId: "lead-existing" });
    expect(mockDb.outreachSuppression.upsert).not.toHaveBeenCalled();
    expect(mockDb.globalOutreachSuppression.upsert).not.toHaveBeenCalled();
    expect(mockDb.venue.updateMany).not.toHaveBeenCalled();
    expect(mockMeterState).toHaveBeenCalledOnce();
    expect(mockGenerateDraft).toHaveBeenCalledWith("lead-existing", 0, { suppressPush: true });
  });
});
