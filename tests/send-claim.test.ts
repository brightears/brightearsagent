import { beforeEach, describe, expect, it, vi } from "vitest";

// Atomic send claim (10.10): a double-tap on Approve, or a manual approve
// racing the autopilot cron, must produce exactly ONE email. The claim is
// updateMany PENDING→SENDING with status in the WHERE — the loser sees
// count 0 and never reaches sendEmail; a thrown send releases the claim so
// the draft stays retryable.

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn(), update: vi.fn() },
  draft: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  gig: { findMany: vi.fn() },
  message: { create: vi.fn() },
  lead: { update: vi.fn() },
  globalOutreachSuppression: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
  sequenceTemplate: { findFirst: vi.fn() },
  sequenceRun: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
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
  currency: "USD",
  autoAttachProfile: false,
  autoAttachQuote: false,
  voiceSamples: "Thanks for reaching out.",
  packages: [],
  performers: [],
};

const pendingDraft = {
  id: "d1",
  status: "PENDING",
  subject: "Re: Wedding inquiry",
  body: "Hi Jess — the 14th is open.",
  isFollowUp: false,
  isConfirmation: false,
  wantsProfile: false,
  wantsQuote: false,
  lead: {
    id: "l1",
    businessId: "biz1",
    status: "DRAFTED",
    source: "PLAIN_EMAIL",
    clientEmail: "jess@example.com",
    clientName: "Jess",
    eventDate: new Date("2026-09-14T12:00:00.000Z"),
    eventType: "wedding",
    rawSubject: "Wedding inquiry",
    rawBody: "Are you free on September 14?",
    optedOut: false,
    firstReplyAt: null,
    messages: [
      {
        direction: "INBOUND",
        body: "Are you free on September 14?",
        autoReply: false,
      },
    ],
    business,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.draft.findFirst.mockResolvedValue(pendingDraft);
  mockDb.gig.findMany.mockResolvedValue([]);
  mockDb.draft.update.mockResolvedValue({});
  mockDb.business.findUnique.mockResolvedValue({ voiceSamples: business.voiceSamples });
  mockDb.business.update.mockResolvedValue({});
  mockDb.draft.updateMany.mockResolvedValue({ count: 1 });
  mockDb.message.create.mockResolvedValue({});
  mockDb.lead.update.mockResolvedValue({});
  mockDb.globalOutreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.sequenceTemplate.findFirst.mockResolvedValue(null);
  mockDb.sequenceRun.findUnique.mockResolvedValue(null);
  mockDb.sequenceRun.update.mockResolvedValue({});
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

  it("expires without claiming when another tenant recorded a recipient stop", async () => {
    mockDb.globalOutreachSuppression.findUnique.mockResolvedValue({ id: "global-1" });

    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });

    expect(result).toEqual({
      ok: false,
      error: "this lead has opted out or is closed — nothing was sent",
    });
    expect(mockDb.globalOutreachSuppression.findUnique).toHaveBeenCalledWith({
      where: { email: "jess@example.com" },
      select: { id: true },
    });
    expect(mockDb.outreachSuppression.findUnique).not.toHaveBeenCalled();
    expect(mockDb.draft.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: {
        status: "EXPIRED",
        decidedAt: expect.any(Date),
        scheduledSendAt: null,
      },
    });
    expect(mockDb.draft.updateMany).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("revalidates, sends, and persists the owner's edited subject", async () => {
    const result = await sendDraftReply({
      draftId: "d1",
      businessId: "biz1",
      editedSubject: "Your September wedding",
      editedBody: "Hi Jess — September 14 is open for your wedding.",
      saveVoiceExample: true,
    });

    expect(result.ok).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Your September wedding",
        textBody: "Hi Jess — September 14 is open for your wedding.",
      }),
    );
    expect(mockDb.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subject: "Your September wedding" }),
      }),
    );
    expect(mockDb.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "EDITED",
          editedSubject: "Your September wedding",
          editedBody: "Hi Jess — September 14 is open for your wedding.",
        }),
      }),
    );
    expect(mockDb.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { voiceSampleSavedAt: expect.any(Date) },
      }),
    );
    expect(mockDb.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { voiceSamples: expect.stringContaining("Saved reply example") },
      }),
    );
  });

  it("rejects an unsafe edited subject before claiming or sending", async () => {
    const result = await sendDraftReply({
      draftId: "d1",
      businessId: "biz1",
      editedSubject: "Hello\nBcc: other@example.com",
    });
    expect(result).toEqual({
      ok: false,
      error: "this reply no longer matches the inquiry or current calendar — review it before sending",
    });
    expect(mockDb.draft.updateMany).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
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

  it("blocks before claiming when the current calendar now contradicts the draft", async () => {
    mockDb.gig.findMany.mockResolvedValue([
      {
        date: new Date("2026-09-14T12:00:00.000Z"),
        title: "New booking",
        performerId: null,
      },
    ]);

    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });

    expect(result).toEqual({
      ok: false,
      error: "this reply no longer matches the inquiry or current calendar — review it before sending",
    });
    expect(mockDb.draft.updateMany).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("a booking confirmation sends on a BOOKED lead, keeps BOOKED, starts no sequence (11.2)", async () => {
    mockDb.draft.findFirst.mockResolvedValue({
      ...pendingDraft,
      isConfirmation: true,
      lead: { ...pendingDraft.lead, status: "BOOKED" },
    });
    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });
    expect(result.ok).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const leadData = mockDb.lead.update.mock.calls[0][0].data;
    expect(leadData.status).toBe("BOOKED");
    // The deal is closed — no follow-up sequence may ever start here.
    expect(mockDb.sequenceTemplate.findFirst).not.toHaveBeenCalled();
  });

  it("a REGULAR draft on a BOOKED lead still expires unsent (compliance hard-stop)", async () => {
    mockDb.draft.findFirst.mockResolvedValue({
      ...pendingDraft,
      lead: { ...pendingDraft.lead, status: "BOOKED" },
    });
    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });
    expect(result.ok).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDb.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED" }) }),
    );
  });

  it("stamps autoSent from the autoAttach signal (graduation honesty, P15)", async () => {
    await sendDraftReply({ draftId: "d1", businessId: "biz1" }); // manual approve
    let draftUpdate = mockDb.draft.update.mock.calls.find((c) => "autoSent" in (c[0].data ?? {}));
    expect(draftUpdate?.[0].data.autoSent).toBe(false);

    vi.clearAllMocks();
    mockDb.draft.findFirst.mockResolvedValue(pendingDraft);
    mockDb.draft.updateMany.mockResolvedValue({ count: 1 });
    mockSendEmail.mockResolvedValue({ transport: "postmark", providerMessageId: "pm1" });
    mockDb.sequenceTemplate.findFirst.mockResolvedValue(null);
    await sendDraftReply({ draftId: "d1", businessId: "biz1", autoAttach: true }); // agent send
    draftUpdate = mockDb.draft.update.mock.calls.find((c) => "autoSent" in (c[0].data ?? {}));
    expect(draftUpdate?.[0].data.autoSent).toBe(true);
  });

  it("still refuses drafts that are not PENDING at read time", async () => {
    mockDb.draft.findFirst.mockResolvedValue({ ...pendingDraft, status: "APPROVED" });
    const result = await sendDraftReply({ draftId: "d1", businessId: "biz1" });
    expect(result.ok).toBe(false);
    expect(mockDb.draft.updateMany).not.toHaveBeenCalled();
  });

  it("reopens and re-anchors a corrected follow-up only when its resend succeeds", async () => {
    mockDb.draft.findFirst.mockResolvedValue({
      ...pendingDraft,
      isFollowUp: true,
      sequenceStep: 2,
      lead: { ...pendingDraft.lead, status: "IN_SEQUENCE" },
    });
    mockDb.sequenceRun.findUnique.mockResolvedValue({
      id: "run1",
      currentStep: 2,
      stoppedAt: new Date(),
      stopReason: "email_corrected_pending_resend",
      template: { stepsDays: [2, 5, 9] },
    });
    await sendDraftReply({ draftId: "d1", businessId: "biz1" });
    expect(mockDb.sequenceRun.update).toHaveBeenCalledWith({
      where: { id: "run1" },
      data: expect.objectContaining({
        currentStep: 2,
        stoppedAt: null,
        stopReason: null,
      }),
    });
    expect(mockDb.sequenceRun.update.mock.calls[0][0].data.nextRunAt).toBeInstanceOf(Date);
  });
});
