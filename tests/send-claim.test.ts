import { beforeEach, describe, expect, it, vi } from "vitest";

// Atomic send claim (10.10): a double-tap on Approve, or a manual approve
// racing the autopilot cron, must produce exactly ONE email. The claim is
// updateMany PENDING→SENDING with status in the WHERE — the loser sees
// count 0 and never reaches sendEmail; a thrown send releases the claim so
// the draft stays retryable.

const mockDb = vi.hoisted(() => ({
  draft: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  message: { create: vi.fn() },
  lead: { update: vi.fn() },
  sequenceTemplate: { findFirst: vi.fn() },
  sequenceRun: { create: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
const mockSendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/outbound/send", () => ({ sendEmail: mockSendEmail }));

import { sendDraftReply } from "@/lib/agent/send-reply";

const business = {
  id: "biz1",
  name: "Sapphire Sounds",
  slug: "sapphire-sounds",
  ownerEmail: "owner@example.com",
  replyToEmail: null,
  autoAttachProfile: false,
  autoAttachQuote: false,
  packages: [],
};

const pendingDraft = {
  id: "d1",
  status: "PENDING",
  subject: "Re: Wedding inquiry",
  body: "Hi Jess — the 14th is open.",
  isFollowUp: false,
  wantsProfile: false,
  wantsQuote: false,
  lead: {
    id: "l1",
    businessId: "biz1",
    status: "DRAFTED",
    clientEmail: "jess@example.com",
    optedOut: false,
    firstReplyAt: null,
    business,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.draft.findFirst.mockResolvedValue(pendingDraft);
  mockDb.draft.update.mockResolvedValue({});
  mockDb.draft.updateMany.mockResolvedValue({ count: 1 });
  mockDb.message.create.mockResolvedValue({});
  mockDb.lead.update.mockResolvedValue({});
  mockDb.sequenceTemplate.findFirst.mockResolvedValue(null);
  mockSendEmail.mockResolvedValue({ transport: "postmark", providerMessageId: "pm1" });
});

describe("sendDraftReply atomic claim", () => {
  it("claims PENDING→SENDING with status in the WHERE before sending", async () => {
    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });
    expect(result.ok).toBe(true);
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "PENDING" },
      data: { status: "SENDING" },
    });
    // The claim must precede the send.
    const claimOrder = mockDb.draft.updateMany.mock.invocationCallOrder[0];
    const sendOrder = mockSendEmail.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(sendOrder);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("the racing loser (claim count 0) never sends", async () => {
    mockDb.draft.updateMany.mockResolvedValue({ count: 0 });
    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });
    expect(result).toEqual({ ok: false, error: "draft not pending" });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDb.message.create).not.toHaveBeenCalled();
  });

  it("a thrown send releases the claim (SENDING→PENDING) and rethrows", async () => {
    mockSendEmail.mockRejectedValue(new Error("postmark down"));
    await expect(sendDraftReply({ draftId: "d1", businessId: "biz1" })).rejects.toThrow(
      "postmark down",
    );
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "SENDING" },
      data: { status: "PENDING" },
    });
    // Nothing was recorded as sent.
    expect(mockDb.message.create).not.toHaveBeenCalled();
    expect(mockDb.lead.update).not.toHaveBeenCalled();
  });

  it("still refuses drafts that are not PENDING at read time", async () => {
    mockDb.draft.findFirst.mockResolvedValue({ ...pendingDraft, status: "APPROVED" });
    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });
    expect(result.ok).toBe(false);
    expect(mockDb.draft.updateMany).not.toHaveBeenCalled();
  });
});
