import { beforeEach, describe, expect, it, vi } from "vitest";

// Travel Mode actions: addTravelWindow / cancelTravelWindow / updateHomeBase.
// Tenant-scoped + zod-validated — both dates required, end ≥ start, valid ISO-2
// country, past windows rejected. updateHomeBase owns serviceCities + radius
// (the Control Room "Where you hunt" section). The DB + tenant are mocked
// (mirrors tests/venues-actions.test.ts).

const mockDb = vi.hoisted(() => ({
  travelWindow: { create: vi.fn(), updateMany: vi.fn() },
  business: { update: vi.fn() },
}));
// Tenant mock is hoisted so individual tests can vary the plan (the coverage cap
// in updateHomeBase reads business.plan). Default STUDIO = effectively unlimited
// home cities, so the existing assertions don't trip the cap.
const mockTenant = vi.hoisted(() => ({
  getCurrentBusiness: vi.fn(async () => ({ id: "biz1", plan: "STUDIO" })),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => mockTenant);

import {
  addTravelWindow,
  cancelTravelWindow,
  updateHomeBase,
} from "@/app/actions/travel";

// "Today" for the past-window guard. The action reads new Date() directly, so
// tests use dates safely in the future / past relative to a fixed clock.
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  mockDb.travelWindow.create.mockResolvedValue({ id: "tw1" });
  mockDb.travelWindow.updateMany.mockResolvedValue({ count: 1 });
  mockDb.business.update.mockResolvedValue({});
});

const fd = (entries: Record<string, string | string[]>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach((item) => f.append(k, item));
    else f.set(k, v);
  }
  return f;
};

const validWindow = {
  city: "Lisbon",
  country: "PT",
  startDate: "2026-08-04",
  endDate: "2026-08-11",
};

describe("addTravelWindow", () => {
  it("creates an ACTIVE window with the parsed UTC-midnight dates, ISO-2 country, role tags", async () => {
    const res = await addTravelWindow(
      fd({ ...validWindow, country: "pt", radiusKm: "50", roleTags: ["guest-spot", "residency"] }),
    );
    expect(res).toEqual({ ok: true });
    expect(mockDb.travelWindow.create).toHaveBeenCalledTimes(1);
    const data = mockDb.travelWindow.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      businessId: "biz1",
      city: "Lisbon",
      country: "PT", // uppercased
      radiusKm: 50,
      roleTags: ["guest-spot", "residency"],
      status: "ACTIVE",
    });
    expect((data.startDate as Date).toISOString()).toBe("2026-08-04T00:00:00.000Z");
    expect((data.endDate as Date).toISOString()).toBe("2026-08-11T00:00:00.000Z");
  });

  it("requires BOTH dates", async () => {
    expect((await addTravelWindow(fd({ ...validWindow, startDate: "" }))).ok).toBe(false);
    expect((await addTravelWindow(fd({ ...validWindow, endDate: "" }))).ok).toBe(false);
    expect(mockDb.travelWindow.create).not.toHaveBeenCalled();
  });

  it("rejects end before start", async () => {
    const res = await addTravelWindow(fd({ ...validWindow, startDate: "2026-08-11", endDate: "2026-08-04" }));
    expect(res).toEqual({ ok: false, error: "End date must be on or after the start date" });
    expect(mockDb.travelWindow.create).not.toHaveBeenCalled();
  });

  it("allows a single-day window (end === start)", async () => {
    const res = await addTravelWindow(fd({ ...validWindow, startDate: "2026-08-04", endDate: "2026-08-04" }));
    expect(res).toEqual({ ok: true });
  });

  it("rejects a non-ISO-2 country", async () => {
    expect((await addTravelWindow(fd({ ...validWindow, country: "Portugal" }))).ok).toBe(false);
    expect((await addTravelWindow(fd({ ...validWindow, country: "" }))).ok).toBe(false);
    expect(mockDb.travelWindow.create).not.toHaveBeenCalled();
  });

  it("rejects an impossible date", async () => {
    const res = await addTravelWindow(fd({ ...validWindow, startDate: "2026-02-31", endDate: "2026-03-05" }));
    expect(res.ok).toBe(false);
    expect(mockDb.travelWindow.create).not.toHaveBeenCalled();
  });

  it("rejects a window that has already ended (past)", async () => {
    const res = await addTravelWindow(fd({ ...validWindow, startDate: "2026-05-01", endDate: "2026-05-10" }));
    expect(res).toEqual({ ok: false, error: "That window is already in the past" });
    expect(mockDb.travelWindow.create).not.toHaveBeenCalled();
  });

  it("accepts a currently-running window (ends today)", async () => {
    const res = await addTravelWindow(fd({ ...validWindow, startDate: "2026-06-10", endDate: "2026-06-15" }));
    expect(res).toEqual({ ok: true });
  });

  it("requires a city", async () => {
    expect((await addTravelWindow(fd({ ...validWindow, city: "  " }))).ok).toBe(false);
  });
});

describe("cancelTravelWindow", () => {
  it("flips a window to CANCELLED, tenant-scoped, never re-cancelling", async () => {
    const res = await cancelTravelWindow("tw1");
    expect(res).toEqual({ ok: true });
    expect(mockDb.travelWindow.updateMany).toHaveBeenCalledWith({
      where: { id: "tw1", businessId: "biz1", status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" },
    });
  });

  it("rejects an empty id without touching the DB", async () => {
    const res = await cancelTravelWindow("");
    expect(res.ok).toBe(false);
    expect(mockDb.travelWindow.updateMany).not.toHaveBeenCalled();
  });
});

describe("updateHomeBase", () => {
  it("saves a positive radius and the parsed, de-duped service cities", async () => {
    const res = await updateHomeBase(
      fd({ homeRadiusKm: "120", serviceCities: "Austin, San Antonio, Austin" }),
    );
    expect(res).toEqual({ ok: true });
    expect(mockDb.business.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { serviceCities: ["Austin", "San Antonio"], homeRadiusKm: 120 },
    });
  });

  it("clears the radius when left blank and empties cities when absent", async () => {
    await updateHomeBase(fd({ homeRadiusKm: "" }));
    expect(mockDb.business.update.mock.calls[0][0].data).toEqual({
      serviceCities: [],
      homeRadiusKm: null,
    });
  });

  it("rejects a non-numeric radius without touching the DB", async () => {
    expect((await updateHomeBase(fd({ homeRadiusKm: "far" }))).ok).toBe(false);
    expect(mockDb.business.update).not.toHaveBeenCalled();
  });

  it("trims home cities to the plan's coverage cap and flags the trim", async () => {
    // Starter covers 1 home city — saving three keeps only the first.
    mockTenant.getCurrentBusiness.mockResolvedValueOnce({ id: "biz1", plan: "STARTER" });
    const res = await updateHomeBase(fd({ homeRadiusKm: "", serviceCities: "Austin, Dallas, Houston" }));
    expect(res.ok).toBe(true);
    expect((res as { notice?: string }).notice).toMatch(/1 city/);
    expect(mockDb.business.update.mock.calls[0][0].data.serviceCities).toEqual(["Austin"]);
  });
});
