import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  business: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  travelWindow: { updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/discovery/ingest", () => ({
  ingestSignals: vi.fn(async () => ({ creates: [], updates: [], skipped: [] })),
}));
vi.mock("@/lib/discovery/contacts", () => ({
  runContactPass: vi.fn(async () => ({
    eligible: 0,
    attempted: 0,
    serperQueries: 0,
    found: [],
    suppressed: [],
  })),
}));

import { runDiscoveryScan, SCAN_MIN_INTERVAL_MS } from "@/lib/discovery/scan";
import { ingestSignals } from "@/lib/discovery/ingest";
import { runContactPass } from "@/lib/discovery/contacts";
import type { DiscoveryProvider } from "@/lib/discovery/provider";

const NOW = new Date("2026-06-12T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);

const fakeProvider = (): DiscoveryProvider & { queriesUsed: number } => ({
  queriesUsed: 0,
  async searchVenueSignals() {
    this.queriesUsed += 7;
    return [];
  },
});

const business = (over: Record<string, unknown> = {}) => ({
  id: "biz1",
  country: "GB",
  serviceCities: ["Manchester", "Leeds"],
  lastDiscoveryScanAt: null,
  discoveryScanCount: 1, // not the warm wheel's turn (warm = count % 3 === 0)
  travelWindows: [], // Travel Mode: home-only by default
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.business.update.mockResolvedValue({});
  mockDb.travelWindow.updateMany.mockResolvedValue({ count: 0 });
});

describe("runDiscoveryScan budget guard", () => {
  it("refuses when the last scan was < 20h ago and spends nothing", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(business({ lastDiscoveryScanAt: hoursAgo(5) }));
    const provider = fakeProvider();
    const result = await runDiscoveryScan("biz1", { now: NOW, provider });

    expect(result.ran).toBe(false);
    expect(result.reason).toContain("20h");
    expect(provider.queriesUsed).toBe(0);
    expect(mockDb.business.update).not.toHaveBeenCalled(); // stamp untouched
    expect(ingestSignals).not.toHaveBeenCalled();
    expect(runContactPass).not.toHaveBeenCalled();
  });

  it("runs when the last scan is older than 20h, and stamps lastDiscoveryScanAt first", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(business({ lastDiscoveryScanAt: hoursAgo(25) }));
    const result = await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() });

    expect(result.ran).toBe(true);
    expect(mockDb.business.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { lastDiscoveryScanAt: NOW, discoveryScanCount: { increment: 1 } },
    });
  });

  it("exactly-20h boundary: 20h - 1ms refuses, 20h runs", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ lastDiscoveryScanAt: new Date(NOW.getTime() - SCAN_MIN_INTERVAL_MS + 1) }),
    );
    expect((await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() })).ran).toBe(false);

    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ lastDiscoveryScanAt: new Date(NOW.getTime() - SCAN_MIN_INTERVAL_MS) }),
    );
    expect((await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() })).ran).toBe(true);
  });

  it("--force bypasses the guard", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(business({ lastDiscoveryScanAt: hoursAgo(1) }));
    const result = await runDiscoveryScan("biz1", { now: NOW, force: true, provider: fakeProvider() });
    expect(result.ran).toBe(true);
  });

  it("refuses tenants without service cities", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(business({ serviceCities: [] }));
    const result = await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() });
    expect(result.ran).toBe(false);
    expect(result.reason).toContain("service cities");
  });
});

describe("runDiscoveryScan orchestration", () => {
  it("caps metros at 2, derives country from the business, and totals serper queries", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ serviceCities: ["Manchester", "Leeds", "Liverpool"] }),
    );
    vi.mocked(runContactPass).mockResolvedValue({
      eligible: 3,
      attempted: 3,
      serperQueries: 3,
      found: [],
      suppressed: [],
    });
    const provider = fakeProvider();
    const spy = vi.spyOn(provider, "searchVenueSignals");

    const result = await runDiscoveryScan("biz1", { now: NOW, provider });

    expect(result.metros.map((m) => m.city)).toEqual(["Manchester", "Leeds"]); // Liverpool capped off
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toEqual({ city: "Manchester", country: "GB" });
    expect(spy.mock.calls[0][1]).toMatchObject({ now: NOW, businessId: "biz1" });
    expect(ingestSignals).toHaveBeenCalledTimes(2);
    expect(runContactPass).toHaveBeenCalledWith("biz1", expect.objectContaining({ gl: "gb" }));
    expect(result.serperQueries).toBe(7 * 2 + 3); // discovery + contact pass
  });
});

describe("runDiscoveryScan warm wheel (10.2c)", () => {
  const warmSeenBy = async (count: number, _forceWarm = false) => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ discoveryScanCount: count, serviceCities: ["Manchester"] }),
    );
    let warmSeen: boolean | undefined;
    const provider: DiscoveryProvider = {
      async searchVenueSignals(_metro, opts) {
        warmSeen = opts.warm;
        return [];
      },
    };
    const result = await runDiscoveryScan("biz1", { now: NOW, provider });
    return { warmSeen, result };
  };

  it("fires the WARM battery on every 3rd scan (count % 3 === 0), including the first ever", async () => {
    expect((await warmSeenBy(0)).warmSeen).toBe(true);
    expect((await warmSeenBy(3)).warmSeen).toBe(true);
  });

  it("keeps the other scans hot-only and reports warm on the result", async () => {
    const { warmSeen, result } = await warmSeenBy(1);
    expect(warmSeen).toBe(false);
    expect(result.warm).toBe(false);
  });

  it("forceWarm (--warm) overrides the wheel", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ discoveryScanCount: 1, serviceCities: ["Manchester"] }),
    );
    let warmSeen: boolean | undefined;
    const provider: DiscoveryProvider = {
      async searchVenueSignals(_metro, opts) {
        warmSeen = opts.warm;
        return [];
      },
    };
    const result = await runDiscoveryScan("biz1", { now: NOW, provider, forceWarm: true });
    expect(warmSeen).toBe(true);
    expect(result.warm).toBe(true);
  });
});
