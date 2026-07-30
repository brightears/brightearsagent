import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  message: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  lead: { update: vi.fn() },
  sequenceRun: { updateMany: vi.fn() },
  draft: { updateMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
const mockNotify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/notify", () => ({ notifyBusiness: mockNotify }));

import {
  applyPostmarkDeliveryEvent,
  classifyPostmarkDeliveryEvent,
} from "@/lib/postmark/bounce";

const storedMessage = {
  id: "m1",
  leadId: "lead1",
  subject: "Re: your event",
  body: "The date is open.",
  bounceType: null,
  bouncedAt: null,
  draft: { id: "d1" },
  lead: {
    id: "lead1",
    clientName: "Jess",
    clientEmail: "jess@example.com",
    business: { id: "biz1", ownerEmail: "owner@example.com" },
  },
};

const hardBounce = {
  RecordType: "Bounce",
  ID: 42,
  Type: "HardBounce",
  TypeCode: 1,
  MessageID: "pm-message-1",
  Name: "Hard bounce",
  Description: "Mailbox not found",
  Email: "jess@example.com",
  From: "replies@mail.brightears.io",
  BouncedAt: "2026-07-30T12:00:00Z",
  Inactive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.message.findUnique.mockResolvedValue(storedMessage);
  mockDb.message.update.mockResolvedValue({});
  mockDb.message.create.mockResolvedValue({});
  mockDb.lead.update.mockResolvedValue({});
  mockDb.sequenceRun.updateMany.mockResolvedValue({ count: 1 });
  mockDb.draft.updateMany.mockResolvedValue({ count: 0 });
  mockNotify.mockResolvedValue(undefined);
});

describe("classifyPostmarkDeliveryEvent", () => {
  it("keeps autoresponders, complaints, sender faults, permanent and transient states distinct", () => {
    expect(classifyPostmarkDeliveryEvent({ Type: "AutoResponder" })).toBe("auto_reply");
    expect(classifyPostmarkDeliveryEvent({ RecordType: "SpamComplaint" })).toBe("complaint");
    expect(classifyPostmarkDeliveryEvent({ Type: "DMARCPolicy" })).toBe("sender_fault");
    expect(classifyPostmarkDeliveryEvent({ Type: "BadEmailAddress" })).toBe("permanent");
    expect(classifyPostmarkDeliveryEvent({ Type: "SoftBounce" })).toBe("transient");
  });

  it("treats a provider-deactivated recipient as permanent unless it is a sender fault", () => {
    expect(classifyPostmarkDeliveryEvent({ Type: "SoftBounce", Inactive: true })).toBe(
      "permanent",
    );
    expect(classifyPostmarkDeliveryEvent({ Type: "Blocked", Inactive: true })).toBe(
      "sender_fault",
    );
  });
});

describe("applyPostmarkDeliveryEvent", () => {
  it("matches only by provider MessageID and stops a permanently undeliverable lead", async () => {
    const result = await applyPostmarkDeliveryEvent(hardBounce);
    expect(result).toEqual({ outcome: "recorded", eventClass: "permanent", leadId: "lead1" });
    expect(mockDb.message.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerMessageId: "pm-message-1" } }),
    );
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: expect.objectContaining({
        undeliverableAt: new Date("2026-07-30T12:00:00Z"),
        undeliverableReason: expect.stringContaining("Mailbox not found"),
      }),
    });
    expect(mockDb.sequenceRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stopReason: "undeliverable" }),
      }),
    );
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED" }) }),
    );
  });

  it("turns a Postmark AutoResponder event into an inbound autoReply message", async () => {
    const result = await applyPostmarkDeliveryEvent({
      ...hardBounce,
      Type: "AutoResponder",
      TypeCode: 64,
      Inactive: false,
    });
    expect(result.eventClass).toBe("auto_reply");
    expect(mockDb.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: "lead1",
        direction: "INBOUND",
        autoReply: true,
        providerMessageId: "postmark-autoresponder:42",
      }),
    });
    expect(mockDb.lead.update).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("makes spam complaints a permanent consent stop", async () => {
    await applyPostmarkDeliveryEvent({
      ...hardBounce,
      RecordType: "SpamComplaint",
      Type: "SpamComplaint",
      TypeCode: 512,
    });
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: expect.objectContaining({ optedOut: true }),
    });
    expect(mockDb.sequenceRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stopReason: "spam_complaint" }),
      }),
    );
  });

  it("records sender faults without blaming the recipient and alerts by push only", async () => {
    const result = await applyPostmarkDeliveryEvent({
      ...hardBounce,
      Type: "DMARCPolicy",
      TypeCode: 100009,
      Inactive: false,
    });
    expect(result.eventClass).toBe("sender_fault");
    expect(mockDb.lead.update).not.toHaveBeenCalled();
    expect(mockDb.sequenceRun.updateMany).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(
      storedMessage.lead.business,
      expect.objectContaining({ pushOnly: true }),
    );
  });

  it("is idempotent for a redelivered event", async () => {
    mockDb.message.findUnique.mockResolvedValue({
      ...storedMessage,
      bounceType: "HardBounce",
      bouncedAt: new Date("2026-07-30T12:00:00Z"),
    });
    expect(await applyPostmarkDeliveryEvent(hardBounce)).toEqual({
      outcome: "duplicate",
      eventClass: "permanent",
    });
    expect(mockDb.message.update).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
