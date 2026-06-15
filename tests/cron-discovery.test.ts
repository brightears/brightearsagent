import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockDb = vi.hoisted(() => ({
  business: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/discovery/scan", () => ({ runDiscoveryScan: vi.fn() }));

import { GET } from "@/app/api/cron/discovery/route";
import { runDiscoveryScan } from "@/lib/discovery/scan";

const scanMock = vi.mocked(runDiscoveryScan);
const req = (secret?: string) =>
  new NextRequest(`http://localhost/api/cron/discovery${secret ? `?secret=${secret}` : ""}`);

const ranResult = (businessId: string) => ({
  businessId,
  ran: true,
  warm: false,
  metros: [{ city: "Manchester", country: "GB", rawSignals: 2, created: 1, updated: 1, skipped: 0, travelWindowId: null }],
  contacts: { eligible: 1, attempted: 1, serperQueries: 1, found: [], suppressed: [] },
  serperQueries: 8,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-test-secret";
  mockDb.business.findMany.mockResolvedValue([
    { id: "b1", slug: "alpha" },
    { id: "b2", slug: "beta" },
  ]);
  scanMock.mockImplementation(async (id: string) => ranResult(id));
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/discovery", () => {
  it("rejects a missing or wrong secret without touching the DB", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("wrong"))).status).toBe(401);
    expect(mockDb.business.findMany).not.toHaveBeenCalled();
    expect(scanMock).not.toHaveBeenCalled();
  });

  it("scans every tenant with service cities, sequentially", async () => {
    const res = await GET(req("cron-test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenants).toBe(2);
    expect(scanMock).toHaveBeenCalledTimes(2);
    // Tenants with a home base OR an active travel window (Travel Mode) are queried.
    expect(mockDb.business.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { serviceCities: { isEmpty: false } },
        { travelWindows: { some: { status: "ACTIVE" } } },
      ],
    });
    expect(body.results[0]).toMatchObject({ slug: "alpha", ran: true, serperQueries: 8 });
  });

  it("isolates per-tenant failures — one crash never blocks the rest", async () => {
    scanMock.mockRejectedValueOnce(new Error("serper down"));
    const res = await GET(req("cron-test-secret"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results[0]).toMatchObject({ slug: "alpha", ran: false });
    expect(body.results[0].error).toContain("serper down");
    expect(body.results[1]).toMatchObject({ slug: "beta", ran: true });
  });

  it("reports a budget-guard refusal as ran=false with the reason", async () => {
    scanMock.mockResolvedValue({
      businessId: "b1",
      ran: false,
      reason: "scan budget: last scan ... is < 20h ago",
      warm: false,
      metros: [],
      contacts: null,
      serperQueries: 0,
    });
    const body = await (await GET(req("cron-test-secret"))).json();
    expect(body.results[0]).toMatchObject({ slug: "alpha", ran: false });
    expect(body.results[0].reason).toContain("20h");
  });
});
