import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  lead: { findFirst: vi.fn(), update: vi.fn() },
  draft: { updateMany: vi.fn(), create: vi.fn() },
  sequenceRun: { deleteMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/tenant", () => ({
  getCurrentBusiness: vi.fn().mockResolvedValue({ id: "biz1" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { correctLeadEmail } from "@/app/actions/delivery";

const originalDraft = {
  subject: "Re: your event",
  body: "The date is open.",
  isFollowUp: false,
  isConfirmation: false,
  sequenceStep: null,
  wantsProfile: false,
  wantsQuote: true,
};

const lead = {
  id: "lead1",
  businessId: "biz1",
  status: "REPLIED",
  clientEmail: "wrong@example.com",
  firstReplyAt: new Date("2026-07-30T10:00:00Z"),
  optedOut: false,
  undeliverableAt: new Date("2026-07-30T10:01:00Z"),
  undeliverableReason: "Hard bounce",
  sequenceRun: { id: "run1", currentStep: 0 },
  messages: [
    {
      subject: "Re: your event",
      body: "The date is open.",
      draft: originalDraft,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.lead.findFirst.mockResolvedValue(lead);
  mockDb.lead.update.mockResolvedValue({});
  mockDb.draft.updateMany.mockResolvedValue({ count: 0 });
  mockDb.draft.create.mockResolvedValue({});
  mockDb.sequenceRun.deleteMany.mockResolvedValue({ count: 1 });
  mockDb.sequenceRun.updateMany.mockResolvedValue({ count: 1 });
});

describe("correctLeadEmail", () => {
  it("prepares the failed initial reply again and deletes the stopped unique run", async () => {
    expect(await correctLeadEmail("lead1", "right@example.com")).toEqual({ ok: true });
    expect(mockDb.draft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: "lead1",
        subject: originalDraft.subject,
        body: originalDraft.body,
        isFollowUp: false,
      }),
    });
    expect(mockDb.lead.update).toHaveBeenCalledWith({
      where: { id: "lead1" },
      data: expect.objectContaining({
        clientEmail: "right@example.com",
        undeliverableAt: null,
        firstReplyAt: null,
        status: "DRAFTED",
      }),
    });
    expect(mockDb.sequenceRun.deleteMany).toHaveBeenCalledWith({ where: { leadId: "lead1" } });
  });

  it("keeps a follow-up run staged for atomic reopen after the replacement send", async () => {
    mockDb.lead.findFirst.mockResolvedValue({
      ...lead,
      status: "IN_SEQUENCE",
      sequenceRun: { id: "run1", currentStep: 2 },
      messages: [
        {
          ...lead.messages[0],
          draft: { ...originalDraft, isFollowUp: true, sequenceStep: 2 },
        },
      ],
    });
    expect(await correctLeadEmail("lead1", "right@example.com")).toEqual({ ok: true });
    expect(mockDb.sequenceRun.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.sequenceRun.updateMany).toHaveBeenCalledWith({
      where: { leadId: "lead1" },
      data: { stopReason: "email_corrected_pending_resend" },
    });
    expect(mockDb.draft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isFollowUp: true, sequenceStep: 2 }),
    });
  });

  it("never overrides a spam complaint", async () => {
    mockDb.lead.findFirst.mockResolvedValue({
      ...lead,
      optedOut: true,
      undeliverableReason: "Spam complaint: recipient complaint",
    });
    const result = await correctLeadEmail("lead1", "right@example.com");
    expect(result).toEqual({
      ok: false,
      error: "A spam complaint is a permanent stop and cannot be overridden.",
    });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});
