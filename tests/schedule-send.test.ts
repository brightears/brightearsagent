import { beforeEach, describe, expect, it, vi } from "vitest";

// The "sending soon" buffer (P10.4): autonomous sends schedule 15 minutes
// out instead of firing instantly; the tick fires what elapsed. The owner
// always wins races — approve/reject/hold beat the buffer via 10.10's
// atomic claim, and the tick skips silently when they did.

const mockDb = vi.hoisted(() => ({
  draft: { updateMany: vi.fn(), findMany: vi.fn() },
}));
const mockSend = vi.hoisted(() => vi.fn());
const mockNotify = vi.hoisted(() => vi.fn(async () => ({})));
const mockReport = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/agent/send-reply", () => ({
  sendDraftReply: mockSend,
  // Keep the real error-string constants — schedule-send branches on them.
  SEND_ERR: {
    notPending: "draft not pending",
    noEmail: "lead has no reachable email (reply on the platform instead)",
    compliance: "this lead has opted out or is closed — nothing was sent",
  },
}));
vi.mock("@/lib/notify", () => ({ notifyBusiness: mockNotify }));
vi.mock("@/lib/report-error", () => ({ reportError: mockReport }));

import {
  SEND_BUFFER_MS,
  runScheduledSends,
  scheduleAutonomousSend,
} from "@/lib/agent/schedule-send";

const now = new Date("2026-07-07T12:00:00Z");
const dueDraft = {
  id: "d1",
  leadId: "l1",
  isFollowUp: false,
  scheduledSendAt: new Date(now.getTime() - 60_000),
  lead: {
    id: "l1",
    clientName: "Jess",
    source: "PLAIN_EMAIL",
    business: {
      id: "biz1",
      name: "Sapphire Sounds",
      plan: "PRO",
      autoSendSources: ["PLAIN_EMAIL"],
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.draft.updateMany.mockResolvedValue({ count: 1 });
  mockDb.draft.findMany.mockResolvedValue([dueDraft]);
  mockSend.mockResolvedValue({ ok: true, transport: "postmark" });
});

describe("scheduleAutonomousSend", () => {
  it("stamps now + 15 minutes on a PENDING, unscheduled draft", async () => {
    const at = await scheduleAutonomousSend("d1", now);
    expect(at).toEqual(new Date(now.getTime() + SEND_BUFFER_MS));
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "PENDING", scheduledSendAt: null },
      data: { scheduledSendAt: at },
    });
  });

  it("returns null when the draft already moved (approved early / rejected)", async () => {
    mockDb.draft.updateMany.mockResolvedValue({ count: 0 });
    expect(await scheduleAutonomousSend("d1", now)).toBeNull();
  });
});

describe("runScheduledSends", () => {
  it("fires elapsed buffers through sendDraftReply (autoAttach) and receipts push-only", async () => {
    const r = await runScheduledSends(now);
    expect(r).toEqual({ sent: 1, blocked: 0 });
    expect(mockSend).toHaveBeenCalledWith({ draftId: "d1", businessId: "biz1", autoAttach: true, requireScheduled: true });
    expect(mockNotify).toHaveBeenCalledWith(
      dueDraft.lead.business,
      expect.objectContaining({ title: "Auto-replied: Jess", pushOnly: true }),
    );
  });

  it("skips silently when the owner beat the buffer (draft not pending)", async () => {
    mockSend.mockResolvedValue({ ok: false, error: "draft not pending" });
    const r = await runScheduledSends(now);
    expect(r).toEqual({ sent: 0, blocked: 0 });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("a compliance-blocked send (opted out / closed) skips silently — no nudge to a closed lead", async () => {
    mockSend.mockResolvedValue({
      ok: false,
      error: "this lead has opted out or is closed — nothing was sent",
    });
    const r = await runScheduledSends(now);
    expect(r).toEqual({ sent: 0, blocked: 0 });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("autonomy revoked during the buffer (source untrusted) clears schedule, never sends", async () => {
    mockDb.draft.findMany.mockResolvedValue([
      { ...dueDraft, lead: { ...dueDraft.lead, business: { ...dueDraft.lead.business, autoSendSources: [] } } },
    ]);
    const r = await runScheduledSends(now);
    expect(r).toEqual({ sent: 0, blocked: 0 });
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "PENDING" },
      data: { scheduledSendAt: null },
    });
  });

  it("a blocked send clears its schedule and degrades to the approve flow", async () => {
    mockSend.mockResolvedValue({ ok: false, error: "lead has no reachable email (reply on the platform instead)" });
    const r = await runScheduledSends(now);
    expect(r).toEqual({ sent: 0, blocked: 1 });
    expect(mockDb.draft.updateMany).toHaveBeenCalledWith({
      where: { id: "d1", status: "PENDING" },
      data: { scheduledSendAt: null },
    });
    expect(mockNotify).toHaveBeenCalledWith(
      dueDraft.lead.business,
      expect.objectContaining({ title: "Reply ready: Jess" }),
    );
  });

  it("a thrown transport clears the schedule, reports, and pings for manual send", async () => {
    mockSend.mockRejectedValue(new Error("postmark down"));
    const r = await runScheduledSends(now);
    expect(r).toEqual({ sent: 0, blocked: 1 });
    expect(mockReport).toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(
      dueDraft.lead.business,
      expect.objectContaining({ title: "Reply needs you: Jess" }),
    );
  });
});
