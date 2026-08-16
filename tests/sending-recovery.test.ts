import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  venuePitch: { findMany: vi.fn(), updateMany: vi.fn() },
}));
const mockReportError = vi.hoisted(() =>
  vi.fn(async (_error: unknown, _context: Record<string, unknown>) => undefined),
);

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/report-error", () => ({ reportError: mockReportError }));

import {
  STUCK_VENUE_PITCH_MS,
  surfaceStuckVenuePitchClaims,
} from "@/lib/ops/sending-recovery";

const NOW = new Date("2026-08-16T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.venuePitch.findMany.mockResolvedValue([]);
});

describe("stale VenuePitch SENDING recovery", () => {
  it("is quiet when no uncertain send is stale", async () => {
    await expect(surfaceStuckVenuePitchClaims(NOW)).resolves.toBe(0);
    expect(mockReportError).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
  });

  it("alerts with manual-recovery identifiers and never mutates or resends", async () => {
    mockDb.venuePitch.findMany.mockResolvedValue([
      {
        id: "pitch-1",
        businessId: "biz-1",
        updatedAt: new Date("2026-08-16T11:40:00.000Z"),
        business: { slug: "sapphire-sounds" },
        venue: { id: "venue-1", name: "Velvet\nLounge" },
      },
    ]);

    await expect(surfaceStuckVenuePitchClaims(NOW)).resolves.toBe(1);

    expect(mockDb.venuePitch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "SENDING",
          updatedAt: { lt: new Date(NOW.getTime() - STUCK_VENUE_PITCH_MS) },
        },
        orderBy: { updatedAt: "asc" },
        take: 20,
      }),
    );
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
    expect(mockReportError).toHaveBeenCalledOnce();

    const [, context] = mockReportError.mock.calls[0];
    expect(context).toMatchObject({
      kind: "stuck-sending-venue-pitch",
      count: 1,
      pitchIds: ["pitch-1"],
    });
    expect(context.detail).toContain("pitch-1 (sapphire-sounds / Velvet Lounge");
    expect(context.detail).toContain("never changes or resends");
  });
});
