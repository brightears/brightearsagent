import { beforeEach, describe, expect, it, vi } from "vitest";

// The 180-day re-touch arc (P12.4): a pitched venue that never replied
// returns to the feed as WARM AGAIN — QUALIFIED (draftable), retouchedAt
// stamped, and never for venues that actually replied.

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn() },
  venue: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { RETOUCH_MS, rescoreVenues } from "@/lib/venues/rescore";

const NOW = new Date("2026-07-07T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.business.findUnique.mockResolvedValue({
    genres: ["house"],
    eventTypes: ["weddings"],
    serviceCities: ["Manchester"],
    acceptsTravel: false,
  });
  mockDb.venue.groupBy.mockResolvedValue([]);
  mockDb.venue.findMany.mockResolvedValue([]); // live feed empty — retouch only
  mockDb.venue.updateMany.mockResolvedValue({ count: 2 });
});

describe("rescoreVenues re-touch arc", () => {
  it("arcs silent PITCHED venues past 180 days to QUALIFIED + WARM with the stamp", async () => {
    const r = await rescoreVenues("biz1", NOW);
    expect(r.retouched).toBe(2);
    expect(mockDb.venue.updateMany).toHaveBeenCalledWith({
      where: {
        businessId: "biz1",
        status: "PITCHED",
        repliedAt: null,
        pitchedAt: { lt: new Date(NOW.getTime() - RETOUCH_MS) },
      },
      data: { status: "QUALIFIED", temperature: "WARM", retouchedAt: NOW },
    });
  });

  it("the window really is 180 days", () => {
    expect(RETOUCH_MS).toBe(180 * 24 * 3600 * 1000);
  });
});
