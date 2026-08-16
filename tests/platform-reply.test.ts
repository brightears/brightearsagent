import { beforeEach, describe, expect, it, vi } from "vitest";

// markSentOnPlatform (P9.8): the GigSalad reply kit's record step. The owner
// pastes the draft on the platform (ToS: reply there, never send — CLAUDE.md
// rule 4), then taps "I sent it" — the action must resolve the draft, put the
// outbound on the thread WITHOUT email fields, and stamp REPLIED/first-reply.

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn(), update: vi.fn() },
  draft: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  message: { create: vi.fn(), findFirst: vi.fn() },
  lead: { findUnique: vi.fn(), updateMany: vi.fn() },
  globalOutreachSuppression: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
  $transaction: vi.fn(
    async (
      input: unknown[] | ((tx: typeof mockDb) => Promise<unknown>),
    ) =>
      typeof input === "function"
        ? input(mockDb)
        : Promise.all(input as Promise<unknown>[]),
  ),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({
  getCurrentBusiness: vi.fn(async () => ({
    id: "biz1",
    name: "Sapphire Sounds",
    voiceSamples: "Hey — thanks for reaching out.",
  })),
}));

import { markSentOnPlatform, rejectDraft } from "@/app/actions/drafts";

const pendingDraft = {
  id: "d1",
  status: "PENDING",
  subject: "Re: Wedding inquiry",
  body: "Hi Jess — the 14th is open on our side.",
  message: null,
  lead: {
    id: "l1",
    status: "DRAFTED",
    firstReplyAt: null,
    optedOut: false,
    clientEmail: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.draft.findFirst.mockResolvedValue(pendingDraft);
  mockDb.draft.update.mockResolvedValue({});
  mockDb.draft.updateMany.mockResolvedValue({ count: 1 });
  mockDb.message.findFirst.mockResolvedValue(null);
  mockDb.lead.findUnique.mockResolvedValue({
    businessId: "biz1",
    status: "DRAFTED",
    optedOut: false,
  });
  mockDb.lead.updateMany.mockResolvedValue({ count: 1 });
  mockDb.globalOutreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.business.findUnique.mockResolvedValue({
    voiceSamples: "Hey — thanks for reaching out.",
  });
  mockDb.business.update.mockResolvedValue({});
  mockDb.message.create.mockResolvedValue({});
});

describe("markSentOnPlatform", () => {
  it("tenant-scopes the draft lookup and requires PENDING", async () => {
    await markSentOnPlatform("d1");
    expect(mockDb.draft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d1", lead: { businessId: "biz1" } },
      }),
    );
    mockDb.draft.findFirst.mockResolvedValue(null);
    const missed = await markSentOnPlatform("someone-elses-draft");
    expect(missed.ok).toBe(false);
  });

  it("resolves the draft, records a no-email outbound, stamps REPLIED + first reply", async () => {
    const result = await markSentOnPlatform("d1");
    expect(result.ok).toBe(true);
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d1", status: "SENDING" },
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
    const leadData = mockDb.lead.updateMany.mock.calls[0][0].data;
    expect(leadData.status).toBe("REPLIED");
    expect(mockDb.lead.updateMany.mock.calls[1][0]).toMatchObject({
      where: { id: "l1", businessId: "biz1", firstReplyAt: null },
      data: { firstReplyAt: expect.any(Date) },
    });
  });

  it("keeps owner edits (EDITED status, edited body on the thread)", async () => {
    await markSentOnPlatform("d1", {
      body: "Hi Jess — the 14th works, here's my number too.",
    });
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith(
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

  it("persists an edited subject and saves a voice example only with explicit opt-in", async () => {
    await markSentOnPlatform("d1", {
      subject: "Your September celebration",
      body: "Hi Jess — September 14 works for me.",
      saveVoiceExample: true,
    });

    expect(mockDb.draft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "EDITED",
          editedSubject: "Your September celebration",
        }),
      }),
    );
    expect(mockDb.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { voiceSampleSavedAt: expect.any(Date) } }),
    );
    expect(mockDb.message.create.mock.calls[0][0].data.subject).toBe(
      "Your September celebration",
    );
    expect(mockDb.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          voiceSamples: expect.stringContaining("Saved reply example"),
        },
      }),
    );
  });

  it("persists edits without changing voice samples when opt-in is off", async () => {
    await markSentOnPlatform("d1", {
      subject: "Your September celebration",
    });
    expect(mockDb.business.findUnique).not.toHaveBeenCalled();
    expect(mockDb.business.update).not.toHaveBeenCalled();
  });

  it("never demotes ENGAGED (client already wrote back) and keeps an existing first-reply stamp", async () => {
    const stamped = new Date("2026-06-01T10:00:00Z");
    mockDb.draft.findFirst.mockResolvedValue({
      ...pendingDraft,
      lead: {
        ...pendingDraft.lead,
        status: "ENGAGED",
        firstReplyAt: stamped,
      },
    });
    mockDb.lead.findUnique.mockResolvedValue({
      businessId: "biz1",
      status: "ENGAGED",
      optedOut: false,
    });
    await markSentOnPlatform("d1");
    const leadData = mockDb.lead.updateMany.mock.calls[0][0].data;
    expect(leadData.status).toBe("ENGAGED");
    expect(mockDb.lead.updateMany.mock.calls[1][0].where.firstReplyAt).toBeNull();
  });

  it("is idempotent after a previous platform record", async () => {
    mockDb.draft.findFirst.mockResolvedValue({
      ...pendingDraft,
      status: "APPROVED",
      message: { id: "m1" },
    });

    expect(await markSentOnPlatform("d1")).toEqual({ ok: true });
    expect(mockDb.draft.updateMany).not.toHaveBeenCalled();
    expect(mockDb.message.create).not.toHaveBeenCalled();
  });

  it("rolls back the record when the lead became terminal after the read", async () => {
    mockDb.lead.findUnique.mockResolvedValue({
      businessId: "biz1",
      status: "DEAD",
      optedOut: false,
    });

    expect(await markSentOnPlatform("d1")).toEqual({
      ok: false,
      error: "this lead changed — refresh before recording the send",
    });
    expect(mockDb.message.create).not.toHaveBeenCalled();
  });

  it("lets only the winning PENDING claim create a message", async () => {
    mockDb.draft.updateMany.mockResolvedValueOnce({ count: 0 });

    expect(await markSentOnPlatform("d1")).toEqual({
      ok: false,
      error: "this lead changed — refresh before recording the send",
    });
    expect(mockDb.message.create).not.toHaveBeenCalled();
  });
});

describe("rejectDraft — structured owner feedback", () => {
  it("records a known reason on the tenant-scoped pending draft", async () => {
    expect(await rejectDraft("d1", "WRONG_TONE")).toEqual({ ok: true });
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "PENDING", lead: { businessId: "biz1" } },
      data: {
        status: "REJECTED",
        rejectionReason: "WRONG_TONE",
        decidedAt: expect.any(Date),
      },
    });
  });

  it("rejects an unknown reason before tenant or draft access", async () => {
    const { getCurrentBusiness } = await import("@/lib/tenant");
    expect(await rejectDraft("d1", "FREE_TEXT")).toEqual({
      ok: false,
      error: "Choose why you're rejecting this draft",
    });
    expect(getCurrentBusiness).not.toHaveBeenCalled();
    expect(mockDb.draft.updateMany).not.toHaveBeenCalled();
  });
});
