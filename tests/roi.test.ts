import { beforeEach, describe, expect, it, vi } from "vitest";

// Monthly ROI receipt (P11.4): real data only, artist's own currency, no
// conversion, no projections; nothing-happened months send nothing; TRIAL
// tenants are never emailed an "ROI" for a $0 plan.

const mockDb = vi.hoisted(() => ({
  business: { findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
  message: { count: vi.fn() },
  venuePitch: { count: vi.fn() },
  venue: { count: vi.fn() },
  lead: { count: vi.fn() },
  gig: { aggregate: vi.fn() },
}));
const mockSend = vi.hoisted(() => vi.fn(async () => ({ transport: "postmark" })));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/outbound/send", () => ({ sendEmail: mockSend }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn(async () => {}) }));

import {
  computeMonthlyRoi,
  priorMonthWindow,
  renderRoiEmail,
  sendMonthlyRoiReceipts,
} from "@/lib/reports/roi";

const biz = { id: "biz1", name: "Sapphire Sounds", currency: "THB", plan: "PRO", ownerEmail: "o@x.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.business.findUniqueOrThrow.mockResolvedValue(biz);
  mockDb.business.findMany.mockResolvedValue([biz]);
  mockDb.message.count.mockResolvedValue(14);
  mockDb.venuePitch.count.mockResolvedValue(9);
  mockDb.venue.count.mockResolvedValue(22);
  mockDb.lead.count.mockResolvedValue(2);
  mockDb.gig.aggregate.mockResolvedValue({ _sum: { value: 4500000 } });
});

describe("priorMonthWindow", () => {
  it("gives the full prior UTC calendar month", () => {
    const { start, end } = priorMonthWindow(new Date("2026-07-01T02:00:00Z"));
    expect(start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("computeMonthlyRoi + renderRoiEmail", () => {
  it("puts the work next to the price — value in the artist's currency, plan in USD", async () => {
    const { start, end } = priorMonthWindow(new Date("2026-07-01T02:00:00Z"));
    const roi = await computeMonthlyRoi("biz1", start, end);
    expect(roi).toMatchObject({ answered: 14, pitched: 9, won: 2, bookedValueMinor: 4500000, planUsd: 79 });
    const { subject, body } = renderRoiEmail(roi);
    expect(subject).toContain("June 2026");
    expect(body).toContain("THB 45,000");
    expect(body).toContain("$79/month");
    expect(body).toContain("nothing projected");
  });

  it("omits the value amount when no fees were captured (honesty, not padding)", async () => {
    mockDb.gig.aggregate.mockResolvedValue({ _sum: { value: null } });
    const { start, end } = priorMonthWindow(new Date("2026-07-01T02:00:00Z"));
    const { body } = renderRoiEmail(await computeMonthlyRoi("biz1", start, end));
    expect(body).not.toContain("THB");
    expect(body).toContain("2 gigs booked");
  });
});

describe("sendMonthlyRoiReceipts", () => {
  it("emails paying tenants with activity", async () => {
    const r = await sendMonthlyRoiReceipts(new Date("2026-07-01T02:00:00Z"));
    expect(r).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(mockDb.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { plan: { not: "TRIAL" } } }),
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("a nothing-happened month sends nothing", async () => {
    mockDb.message.count.mockResolvedValue(0);
    mockDb.venuePitch.count.mockResolvedValue(0);
    mockDb.venue.count.mockResolvedValue(0);
    mockDb.lead.count.mockResolvedValue(0);
    mockDb.gig.aggregate.mockResolvedValue({ _sum: { value: null } });
    const r = await sendMonthlyRoiReceipts(new Date("2026-07-01T02:00:00Z"));
    expect(r).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
