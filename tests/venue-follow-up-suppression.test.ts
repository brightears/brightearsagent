import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  venuePitch: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  globalOutreachSuppression: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { draftHotFollowUps } from "@/lib/venues/follow-up";

const business = {
  id: "business-b",
  name: "Second Artist",
  ownerName: "Maya",
  plan: "PRO",
  timezone: "America/New_York",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.venuePitch.findMany.mockResolvedValue([
    {
      id: "pitch-1",
      subject: "Guest set",
      language: "en",
      venue: {
        id: "venue-1",
        name: "Stopped Room",
        country: "US",
        status: "PITCHED",
        bookingEmail: "stop@example.com",
      },
    },
  ]);
  mockDb.globalOutreachSuppression.findUnique.mockResolvedValue({ id: "global-1" });
  mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.venuePitch.count.mockResolvedValue(0);
  mockDb.venuePitch.create.mockResolvedValue({ id: "follow-up-1" });
});

describe("HOT venue follow-up suppression", () => {
  it("does not create a follow-up for a recipient stopped through another tenant", async () => {
    expect(
      await draftHotFollowUps(
        business as Parameters<typeof draftHotFollowUps>[0],
        new Date("2026-08-16T12:00:00Z"),
      ),
    ).toEqual({ drafted: 0 });
    expect(mockDb.globalOutreachSuppression.findUnique).toHaveBeenCalledWith({
      where: { email: "stop@example.com" },
      select: { id: true },
    });
    expect(mockDb.outreachSuppression.findUnique).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.count).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.create).not.toHaveBeenCalled();
  });
});
