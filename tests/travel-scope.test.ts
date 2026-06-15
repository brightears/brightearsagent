import { beforeEach, describe, expect, it, vi } from "vitest";

// Travel Mode scan-scoping: liveness/expiry/cancelled, lead-time inclusion, the
// speculative-window reduced cadence, and the scan-orchestration wiring
// (travel-window metros carry the WINDOW's country + tag discovered venues with
// travelWindowId; auto-expire marks past windows EXPIRED).

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

import { runDiscoveryScan, TRAVEL_WINDOW_LEAD_MS } from "@/lib/discovery/scan";
import {
  isWindowExpired,
  isWindowLive,
  shouldScanWindowThisScan,
  startOfUtcDay,
} from "@/lib/discovery/travel";
import { ingestSignals } from "@/lib/discovery/ingest";
import type { DiscoveryProvider } from "@/lib/discovery/provider";

const NOW = new Date("2026-06-15T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

const fakeProvider = (): DiscoveryProvider & { queriesUsed: number } => ({
  queriesUsed: 0,
  async searchVenueSignals() {
    this.queriesUsed += 7;
    return [];
  },
});

// A travel window for the scan-orchestration tests (Lisbon, PT). _count.venues
// drives the cold-cadence skip.
const window = (over: Record<string, unknown> = {}) => ({
  id: "tw1",
  city: "Lisbon",
  country: "PT",
  startDate: day("2026-07-01"),
  endDate: day("2026-07-10"),
  status: "ACTIVE",
  _count: { venues: 1 }, // has a venue → scans every time, by default
  ...over,
});

// A tenant with one home city (so the MAX_METROS cap of 2 leaves room for a
// travel target) + a travel window. discoveryScanCount divisible by 3 so the
// cold-cadence gate would also pass for 0-venue windows.
const business = (over: Record<string, unknown> = {}) => ({
  id: "biz1",
  country: "GB",
  serviceCities: ["Manchester"],
  lastDiscoveryScanAt: null,
  discoveryScanCount: 0,
  travelWindows: [window()],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.business.update.mockResolvedValue({});
  mockDb.travelWindow.updateMany.mockResolvedValue({ count: 0 });
});

// ---------------------------------------------------------------------------
// Pure liveness helpers
// ---------------------------------------------------------------------------

describe("isWindowLive / isWindowExpired (lead-time + status)", () => {
  it("a window starting within the lead time is live before its start date", () => {
    // start = NOW + (lead - 1 day) → inside the lead window → live.
    const start = new Date(startOfUtcDay(NOW).getTime() + TRAVEL_WINDOW_LEAD_MS - 24 * 3600 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
    expect(isWindowLive({ id: "x", city: "L", country: "PT", startDate: start, endDate: end, status: "ACTIVE" }, NOW)).toBe(true);
  });

  it("a window starting JUST beyond the lead time is NOT yet live", () => {
    // start = today + lead + 2 days → still outside the lead window.
    const start = new Date(startOfUtcDay(NOW).getTime() + TRAVEL_WINDOW_LEAD_MS + 2 * 24 * 3600 * 1000);
    const end = new Date(start.getTime() + 7 * 24 * 3600 * 1000);
    expect(isWindowLive({ id: "x", city: "L", country: "PT", startDate: start, endDate: end, status: "ACTIVE" }, NOW)).toBe(false);
  });

  it("stays live through the whole endDate calendar day, expires the day after", () => {
    const w = { endDate: day("2026-06-15") };
    expect(isWindowExpired(w, new Date("2026-06-15T23:59:00Z"))).toBe(false); // still Jun 15
    expect(isWindowExpired(w, new Date("2026-06-16T00:00:00Z"))).toBe(true); // Jun 16
  });

  it("a currently-running window (start passed, end in future) is live", () => {
    const w = { id: "x", city: "L", country: "PT", startDate: day("2026-06-10"), endDate: day("2026-06-20"), status: "ACTIVE" };
    expect(isWindowLive(w, NOW)).toBe(true);
  });

  it("CANCELLED and EXPIRED windows are never live, even when in range", () => {
    const base = { id: "x", city: "L", country: "PT", startDate: day("2026-06-10"), endDate: day("2026-06-20") };
    expect(isWindowLive({ ...base, status: "CANCELLED" }, NOW)).toBe(false);
    expect(isWindowLive({ ...base, status: "EXPIRED" }, NOW)).toBe(false);
  });
});

describe("shouldScanWindowThisScan (reduced cadence for speculative windows)", () => {
  it("a window with venues scans every time, regardless of the wheel", () => {
    expect(shouldScanWindowThisScan(true, 0)).toBe(true);
    expect(shouldScanWindowThisScan(true, 1)).toBe(true);
    expect(shouldScanWindowThisScan(true, 2)).toBe(true);
  });

  it("a 0-venue window scans only 1-in-3 (skip 2 of every 3)", () => {
    expect(shouldScanWindowThisScan(false, 0)).toBe(true);
    expect(shouldScanWindowThisScan(false, 1)).toBe(false);
    expect(shouldScanWindowThisScan(false, 2)).toBe(false);
    expect(shouldScanWindowThisScan(false, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scan orchestration wiring
// ---------------------------------------------------------------------------

describe("runDiscoveryScan travel scoping", () => {
  it("scans home + the live travel window; the travel metro carries the WINDOW country and tags venues with its id", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(business());
    const provider = fakeProvider();
    const spy = vi.spyOn(provider, "searchVenueSignals");

    const result = await runDiscoveryScan("biz1", { now: NOW, provider });

    expect(result.ran).toBe(true);
    // Home (Manchester/GB) then travel (Lisbon/PT — the WINDOW's country).
    expect(spy.mock.calls[0][0]).toEqual({ city: "Manchester", country: "GB" });
    expect(spy.mock.calls[1][0]).toEqual({ city: "Lisbon", country: "PT" });

    // ingestSignals(businessId, metro, raw, now, travelWindowId): home tags
    // null, the travel metro tags the window id.
    expect(vi.mocked(ingestSignals).mock.calls[0][4]).toBeNull();
    expect(vi.mocked(ingestSignals).mock.calls[1][4]).toBe("tw1");

    // The summary records which window each metro came from.
    expect(result.metros.map((m) => m.travelWindowId)).toEqual([null, "tw1"]);
  });

  it("auto-expires ACTIVE windows whose endDate passed, and never scans them", async () => {
    const past = window({ id: "old", endDate: day("2026-06-01") }); // ended Jun 1 < Jun 15
    mockDb.business.findUniqueOrThrow.mockResolvedValue(business({ travelWindows: [past] }));
    const provider = fakeProvider();
    const spy = vi.spyOn(provider, "searchVenueSignals");

    const result = await runDiscoveryScan("biz1", { now: NOW, provider });

    // The expired window is flipped to EXPIRED in a single updateMany…
    expect(mockDb.travelWindow.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["old"] }, businessId: "biz1", status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    // …and never scanned (only home Manchester).
    expect(spy.mock.calls.map((c) => c[0].city)).toEqual(["Manchester"]);
    expect(result.metros.every((m) => m.travelWindowId === null)).toBe(true);
  });

  it("does NOT scan a CANCELLED window and never auto-expires it", async () => {
    const cancelled = window({ id: "cx", status: "CANCELLED" });
    mockDb.business.findUniqueOrThrow.mockResolvedValue(business({ travelWindows: [cancelled] }));
    const provider = fakeProvider();
    const spy = vi.spyOn(provider, "searchVenueSignals");

    await runDiscoveryScan("biz1", { now: NOW, provider });

    expect(mockDb.travelWindow.updateMany).not.toHaveBeenCalled();
    expect(spy.mock.calls.map((c) => c[0].city)).toEqual(["Manchester"]);
  });

  it("skips a speculative (0-venue) travel window when it's not the cadence turn", async () => {
    const cold = window({ _count: { venues: 0 } });
    // discoveryScanCount = 1 → not divisible by 3 → cold window skipped.
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ travelWindows: [cold], discoveryScanCount: 1 }),
    );
    const provider = fakeProvider();
    const spy = vi.spyOn(provider, "searchVenueSignals");

    await runDiscoveryScan("biz1", { now: NOW, provider });

    expect(spy.mock.calls.map((c) => c[0].city)).toEqual(["Manchester"]);
  });

  it("scans a tenant with NO home base but a live travel window", async () => {
    mockDb.business.findUniqueOrThrow.mockResolvedValue(
      business({ serviceCities: [], travelWindows: [window()] }),
    );
    const provider = fakeProvider();
    const spy = vi.spyOn(provider, "searchVenueSignals");

    const result = await runDiscoveryScan("biz1", { now: NOW, provider });

    expect(result.ran).toBe(true);
    expect(spy.mock.calls.map((c) => c[0])).toEqual([{ city: "Lisbon", country: "PT" }]);
  });
});
