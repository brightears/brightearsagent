import { beforeEach, describe, expect, it, vi } from "vitest";

// markSentOnPlatform (P9.8): the GigSalad reply kit's record step. The owner
// pastes the draft on the platform (ToS: reply there, never send — CLAUDE.md
// rule 4), then taps "I sent it" — the action must resolve the draft, put the
// outbound on the thread WITHOUT email fields, and stamp REPLIED/first-reply.

const mockDb = vi.hoisted(() => ({
  draft: { findFirst: vi.fn(), update: vi.fn() },
  message: { create: vi.fn() },
  lead: { update: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({
  getCurrentBusiness: vi.fn(async () => ({ id: "biz1", name: "Sapphire Sounds" })),
}));

import { markSentOnPlatform } from "@/app/actions/drafts";

const pendingDraft = {
  id: "d1",
  status: "PENDING",
  subject: "Re: Wedding inquiry",
  body: "Hi Jess — the 14th is open on our side.",
  lead: { id: "l1", status: "DRAFTED", firstReplyAt: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.draft.findFirst.mockResolvedValue(pendingDraft);
  mockDb.draft.update.mockResolvedValue({});
  mockDb.message.create.mockResolvedValue({});
  mockDb.lead.update.mockResolvedValue({});
});

describe("markSentOnPlatform", () => {
  it("tenant-scopes the draft lookup and requires PENDING", async () => {
    await markSentOnPlatform("d1");
    expect(mockDb.draft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d1", status: "PENDING", lead: { businessId: "biz1" } },
      }),
    );
    mockDb.draft.findFirst.mockResolvedValue(null);
    const missed = await markSentOnPlatform("someone-elses-draft");
    expect(missed.ok).toBe(false);
  });

  it("resolves the draft, records a no-email outbound, stamps REPLIED + first reply", async () => {
    const result = await markSentOnPlatform("d1");
    expect(result.ok).toBe(true);
    expect(mockDb.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED", editedBody: null }),
      }),
    );
    const message = mockDb.message.create.mock.calls[0][0].data;
    expect(message).toMatchObject({
      leadId: "l1",
      direction: "OUTBOUND",
      body: pendingDraft.body,
      draftId: "d1",
    });
    // It went out on the platform — no email addresses to record.
    expect(message.fromEmail).toBeUndefined();
    expect(message.toEmail).toBeUndefined();
    const leadData = mockDb.lead.update.mock.calls[0][0].data;
    expect(leadData.status).toBe("REPLIED");
    expect(leadData.firstReplyAt).toBeInstanceOf(Date);
  });

  it("keeps owner edits (EDITED status, edited body on the thread)", async () => {
    await markSentOnPlatform("d1", "Hi Jess — the 14th works, here's my number too.");
    expect(mockDb.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "EDITED",
          editedBody: "Hi Jess — the 14th works, here's my number too.",
        }),
      }),
    );
    expect(mockDb.message.create.mock.calls[0][0].data.body).toBe(
      "Hi Jess — the 14th works, here's my number too.",
    );
  });

  it("never demotes ENGAGED (client already wrote back) and keeps an existing first-reply stamp", async () => {
    const stamped = new Date("2026-06-01T10:00:00Z");
    mockDb.draft.findFirst.mockResolvedValue({
      ...pendingDraft,
      lead: { id: "l1", status: "ENGAGED", firstReplyAt: stamped },
    });
    await markSentOnPlatform("d1");
    const leadData = mockDb.lead.update.mock.calls[0][0].data;
    expect(leadData.status).toBe("ENGAGED");
    expect(leadData.firstReplyAt).toBe(stamped);
  });
});
