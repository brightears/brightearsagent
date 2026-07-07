import { beforeEach, describe, expect, it, vi } from "vitest";

// computeResults aggregates the dashboard "Results" proof surface. db is mocked;
// count calls are routed by their `where` so the test isn't order-brittle.

const mockDb = vi.hoisted(() => ({
  lead: { count: vi.fn(), findMany: vi.fn() },
  message: { count: vi.fn() },
  venue: { count: vi.fn() },
  venuePitch: { count: vi.fn() },
  gig: { aggregate: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { computeResults, hasResults, formatReplyTime } from "@/lib/reports/results";

beforeEach(() => {
  vi.clearAllMocks();
  // Route lead.count by the shape of its where clause.
  mockDb.lead.count.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    const status = where.status as { not?: string } | string | undefined;
    const bookedAt = where.bookedAt as { gte?: Date; not?: null } | undefined;
    if (status === "SPAM") return Promise.resolve(2);
    if (status === "ENGAGED") return Promise.resolve(4);
    if (bookedAt?.gte) return Promise.resolve(1);
    if (bookedAt && "not" in bookedAt) return Promise.resolve(6);
    if (typeof status === "object" && status?.not === "SPAM") return Promise.resolve(9);
    return Promise.resolve(0);
  });
  mockDb.venue.count.mockImplementation(({ where }: { where: { createdAt?: unknown } }) =>
    Promise.resolve(where.createdAt ? 7 : 20),
  );
  mockDb.venuePitch.count.mockImplementation(({ where }: { where: { sentAt?: { gte?: Date } } }) =>
    Promise.resolve(where.sentAt?.gte ? 5 : 12),
  );
  mockDb.message.count.mockResolvedValue(8);
  // Booked value (11.1): month window (lead.bookedAt gte) vs all-time.
  mockDb.gig.aggregate.mockImplementation(({ where }: { where: { lead?: unknown } }) =>
    Promise.resolve({ _sum: { value: where.lead ? 1500000 : 4200000 } }),
  );
  // Three leads first-replied this month: 10, 50, 30 minutes → median 30.
  const base = new Date("2026-06-10T00:00:00Z").getTime();
  mockDb.lead.findMany.mockResolvedValue([
    { createdAt: new Date(base), firstReplyAt: new Date(base + 10 * 60000) },
    { createdAt: new Date(base), firstReplyAt: new Date(base + 50 * 60000) },
    { createdAt: new Date(base), firstReplyAt: new Date(base + 30 * 60000) },
  ]);
});

describe("computeResults", () => {
  it("maps both halves + all-time totals from real rows", async () => {
    const r = await computeResults("biz1", new Date("2026-06-16T12:00:00Z"));
    expect(r).toMatchObject({
      newInquiries: 9,
      spamFiltered: 2,
      repliesSent: 8,
      conversationsActive: 4,
      venuesFound: 7,
      pitchesSent: 5,
      gigsBookedThisMonth: 1,
      bookedValueThisMonth: 1500000,
      gigsBookedAllTime: 6,
      venuesFoundAllTime: 20,
      pitchesSentAllTime: 12,
      bookedValueAllTime: 4200000,
    });
    expect(r.monthStart.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("computes the median first-reply time (minutes)", async () => {
    const r = await computeResults("biz1");
    expect(r.medianFirstReplyMinutes).toBe(30);
  });

  it("median is null when nothing was replied to", async () => {
    mockDb.lead.findMany.mockResolvedValueOnce([]);
    const r = await computeResults("biz1");
    expect(r.medianFirstReplyMinutes).toBeNull();
  });
});

describe("hasResults", () => {
  const empty = {
    monthStart: new Date(),
    newInquiries: 0, spamFiltered: 0, repliesSent: 0, medianFirstReplyMinutes: null,
    conversationsActive: 0, venuesFound: 0, pitchesSent: 0, gigsBookedThisMonth: 0,
    bookedValueThisMonth: 0,
    gigsBookedAllTime: 0, venuesFoundAllTime: 0, pitchesSentAllTime: 0,
    bookedValueAllTime: 0,
  };
  it("false for a brand-new account, true once anything happened", () => {
    expect(hasResults(empty)).toBe(false);
    expect(hasResults({ ...empty, venuesFoundAllTime: 3 })).toBe(true);
    expect(hasResults({ ...empty, repliesSent: 1 })).toBe(true);
  });
});

describe("formatReplyTime", () => {
  it("renders minutes / hours / days, and — for null", () => {
    expect(formatReplyTime(null)).toBe("—");
    expect(formatReplyTime(45)).toBe("45 min");
    expect(formatReplyTime(180)).toBe("3 hr");
    expect(formatReplyTime(60 * 24 * 2)).toBe("2 d");
  });
});
