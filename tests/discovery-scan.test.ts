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
  plan: "STUDIO", // coverage cap 25 = effectively unlimited home cities for these tests
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

describe("runDiscoveryScan subscription gate", () => {
  it("does not scan or spend Serper for an unsubscribed tenant (plan=TRIAL)", async () => {
    // No auto trial: unsubscribed = agent paused everywhere, including the Hunt.
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ plan: "TRIAL", lastDiscoveryScanAt: hoursAgo(25) }),
    );
    const provider = fakeProvider();
    const result = await runDiscoveryScan("biz1", { now: NOW, provider });

    expect(result.ran).toBe(false);
    expect(result.reason).toMatch(/paused|subscription/i);
    expect(provider.queriesUsed).toBe(0);
    expect(mockDb.business.update).not.toHaveBeenCalled(); // never stamps / spends
  });
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

    // Per-scan spend stays 2 metros; counter 1 rotates the window to
    // [Leeds, Liverpool] — Manchester's turn comes next scan; no city is ever
    // "capped off" permanently (audit 2026-07).
    expect(result.metros.map((m) => m.city)).toEqual(["Leeds", "Liverpool"]);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toEqual({ city: "Leeds", country: "GB" });
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

// ---------------------------------------------------------------------------
// Coverage rotation (audit 2026-07): the old home-first slice meant city 3+
// NEVER scanned and 2+ home cities starved Travel Mode forever — coverage the
// pricing page sold but the scanner never delivered. Same 2-metro spend per
// scan; the counter rotates who gets it.
// ---------------------------------------------------------------------------
describe("runDiscoveryScan coverage rotation", () => {
  const cityOf = (r: Awaited<ReturnType<typeof runDiscoveryScan>>) =>
    r.metros.map((m) => m.city);

  const liveWindow = (id: string, city: string, venues = 1) => ({
    id,
    city,
    country: "PT",
    startDate: hoursAgo(24),
    endDate: new Date(NOW.getTime() + 5 * 24 * 3600 * 1000),
    status: "ACTIVE",
    _count: { venues }, // ≥1 venue = scans every time (no 1-in-3 gate)
  });

  it("rotates a Pro's 3 home cities so every city scans within days", async () => {
    const seen = new Set<string>();
    for (const count of [1, 2, 3]) {
      mockDb.business.findUniqueOrThrow.mockResolvedValue(
        business({
          plan: "PRO",
          serviceCities: ["Austin", "Dallas", "Houston"],
          discoveryScanCount: count,
        }),
      );
      const result = await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() });
      expect(result.metros).toHaveLength(2);
      for (const c of cityOf(result)) seen.add(c);
    }
    // Three consecutive daily scans cover ALL three cities (old code: Houston never).
    expect([...seen].sort()).toEqual(["Austin", "Dallas", "Houston"]);
  });

  it("never rotates past the plan's homeCityCap (legacy over-stored cities)", async () => {
    const seen = new Set<string>();
    for (const count of [0, 1, 2, 3, 4, 5]) {
      mockDb.business.findUniqueOrThrow.mockResolvedValue(
        business({
          plan: "PRO", // cap 3 — the stored 4th city must never scan
          serviceCities: ["Austin", "Dallas", "Houston", "El Paso"],
          discoveryScanCount: count,
        }),
      );
      const result = await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() });
      for (const c of cityOf(result)) seen.add(c);
    }
    expect(seen.has("El Paso")).toBe(false);
    expect(seen.size).toBe(3);
  });

  it("a live travel window reserves one slot even with 2+ home cities", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({
        serviceCities: ["Manchester", "Leeds"],
        travelWindows: [liveWindow("w1", "Lisbon")],
      }),
    );
    const result = await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() });
    const cities = cityOf(result);
    expect(cities).toHaveLength(2);
    expect(cities).toContain("Lisbon"); // old code: home filled both slots, Lisbon never scanned
    const lisbon = result.metros.find((m) => m.city === "Lisbon")!;
    expect(lisbon.travelWindowId).toBe("w1");
    expect(lisbon.country).toBe("PT"); // jurisdiction follows the destination
    // Exactly one home city rides along this scan; the other's turn comes next.
    expect(cities.filter((c) => c !== "Lisbon")).toHaveLength(1);
  });

  it("alternates WHICH home city rides along across scans", async () => {
    const homeSeen = new Set<string>();
    for (const count of [1, 2]) {
      mockDb.business.findUniqueOrThrow.mockResolvedValue(
        business({
          serviceCities: ["Manchester", "Leeds"],
          discoveryScanCount: count,
          travelWindows: [liveWindow("w1", "Lisbon")],
        }),
      );
      const result = await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() });
      for (const c of cityOf(result)) if (c !== "Lisbon") homeSeen.add(c);
    }
    expect([...homeSeen].sort()).toEqual(["Leeds", "Manchester"]);
  });

  it("with no home cities, travel windows may take every slot", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({
        serviceCities: [],
        travelWindows: [liveWindow("w1", "Lisbon"), liveWindow("w2", "Porto")],
      }),
    );
    const result = await runDiscoveryScan("biz1", { now: NOW, provider: fakeProvider() });
    expect(cityOf(result).sort()).toEqual(["Lisbon", "Porto"]);
  });
});
