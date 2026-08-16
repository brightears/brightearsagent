import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockDb = vi.hoisted(() => ({ opsStamp: { upsert: vi.fn() } }));
const mockReports = vi.hoisted(() => vi.fn());
const mockFreshness = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/reports/weekly", () => ({ sendWeeklyReports: mockReports }));
vi.mock("@/lib/epk/freshness", () => ({ runEpkFreshnessSweep: mockFreshness }));

import { GET } from "@/app/api/cron/weekly-report/route";

const request = () =>
  new NextRequest("http://localhost/api/cron/weekly-report", {
    headers: { Authorization: "Bearer cron-test-secret" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-test-secret";
  mockReports.mockResolvedValue({ sent: 0, failed: 0 });
  mockFreshness.mockResolvedValue({ checked: 0, nagged: 0, failed: 0 });
  mockDb.opsStamp.upsert.mockResolvedValue({});
});

afterEach(() => delete process.env.CRON_SECRET);

describe("weekly cron completion semantics", () => {
  it("stamps an expected no-op completion", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mockDb.opsStamp.upsert).toHaveBeenCalledOnce();
  });

  it("returns 503 without a stamp when every report attempt fails", async () => {
    mockReports.mockResolvedValue({ sent: 0, failed: 2 });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });

  it("keeps fleet isolation when at least one report succeeds", async () => {
    mockReports.mockResolvedValue({ sent: 1, failed: 1 });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mockDb.opsStamp.upsert).toHaveBeenCalledOnce();
  });

  it("returns 503 when every EPK freshness check crashes", async () => {
    mockFreshness.mockResolvedValue({ checked: 2, nagged: 0, failed: 2 });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });
});
