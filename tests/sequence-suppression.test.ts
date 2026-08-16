import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  draft: { updateMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  lead: { findMany: vi.fn(), update: vi.fn() },
  sequenceRun: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  globalOutreachSuppression: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
const mockGenerateDraft = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/agent/generate-for-lead", () => ({
  generateDraftForLead: mockGenerateDraft,
}));
vi.mock("@/lib/agent/schedule-send", () => ({
  runScheduledSends: vi.fn(async () => ({ sent: 0, blocked: 0 })),
  scheduleAutonomousSend: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notifyBusiness: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/ops/sending-recovery", () => ({
  surfaceStuckVenuePitchClaims: vi.fn(async () => 0),
}));

import { runSequenceTick } from "@/lib/sequences/engine";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.draft.updateMany.mockResolvedValue({ count: 0 });
  mockDb.draft.findMany.mockResolvedValue([]);
  mockDb.lead.findMany.mockResolvedValue([]);
  mockDb.sequenceRun.findMany.mockResolvedValue([
    {
      id: "run-1",
      currentStep: 0,
      template: { stepsDays: [2, 5] },
      lead: {
        id: "lead-1",
        businessId: "business-b",
        clientEmail: "stop@example.com",
        clientName: "Sam",
        status: "REPLIED",
        optedOut: false,
        drafts: [],
        business: {
          id: "business-b",
          plan: "PRO",
          autoSendSources: [],
          ownerEmail: "owner@example.com",
        },
      },
    },
  ]);
  mockDb.globalOutreachSuppression.findUnique.mockResolvedValue({ id: "global-1" });
  mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.sequenceRun.update.mockResolvedValue({});
});

describe("reactive sequence suppression", () => {
  it("closes a due run before drafting when another tenant recorded the stop", async () => {
    const result = await runSequenceTick(new Date("2026-08-16T12:00:00Z"));

    expect(result.stepsFired).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockDb.sequenceRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: {
        stoppedAt: new Date("2026-08-16T12:00:00Z"),
        stopReason: "suppressed",
      },
    });
    expect(mockGenerateDraft).not.toHaveBeenCalled();
  });

  it("counts isolated draft failures so the cron can detect an all-failed tick", async () => {
    mockDb.globalOutreachSuppression.findUnique.mockResolvedValue(null);
    mockGenerateDraft.mockRejectedValueOnce(new Error("model unavailable"));

    const result = await runSequenceTick(new Date("2026-08-16T12:00:00Z"));

    expect(result.draftAttempts).toBe(1);
    expect(result.draftFailures).toBe(1);
    expect(result.stepsFired).toBe(0);
    expect(mockDb.sequenceRun.update).not.toHaveBeenCalled();
  });
});
