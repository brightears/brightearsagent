import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockDb = vi.hoisted(() => ({ opsStamp: { upsert: vi.fn() } }));
const mockMargins = vi.hoisted(() => vi.fn());
const mockReconcile = vi.hoisted(() => vi.fn());
const mockHeartbeat = vi.hoisted(() => vi.fn());
const mockSend = vi.hoisted(() => vi.fn());
const mockRoi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/billing/margin", () => ({ computeMargins: mockMargins }));
vi.mock("@/lib/ops/nightly", () => ({
  reconcileStripe: mockReconcile,
  computeHeartbeat: mockHeartbeat,
  renderHeartbeat: vi.fn(() => "heartbeat"),
}));
vi.mock("@/lib/outbound/send", () => ({ sendEmail: mockSend }));
vi.mock("@/lib/reports/roi", () => ({ sendMonthlyRoiReceipts: mockRoi }));
vi.mock("@/lib/reports/hunt-quality", () => ({ huntQualityNeedsAttention: vi.fn(() => false) }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

import { GET } from "@/app/api/cron/margin-guardrail/route";

const request = () =>
  new NextRequest("http://localhost/api/cron/margin-guardrail", {
    headers: { Authorization: "Bearer cron-test-secret" },
  });

const HEARTBEAT = {
  leadsIn: 0,
  repliesSent: 0,
  pitchesSent: 0,
  staleCrons: [],
  silentTenants: [],
  unrouted: { nearMisses: [] },
  huntQuality: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-test-secret";
  process.env.OPS_ALERT_EMAIL = "ops@brightears.io";
  mockMargins.mockResolvedValue([]);
  mockReconcile.mockResolvedValue({
    checked: 0,
    failed: 0,
    complete: true,
    healed: [],
    issues: [],
  });
  mockHeartbeat.mockResolvedValue(HEARTBEAT);
  mockSend.mockResolvedValue({ providerMessageId: "pm_1", transport: "postmark" });
  mockRoi.mockResolvedValue({ sent: 0, skipped: 0, failed: 0 });
  mockDb.opsStamp.upsert.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.OPS_ALERT_EMAIL;
});

describe("nightly cron completion semantics", () => {
  it("stamps only after its mandatory heartbeat is delivered", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockDb.opsStamp.upsert).toHaveBeenCalledOnce();
  });

  it("returns 503 and no stamp when heartbeat delivery fails", async () => {
    mockSend.mockRejectedValue(new Error("Postmark unavailable"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });

  it("returns 503 and no stamp when Stripe reconciliation is incomplete", async () => {
    mockReconcile.mockResolvedValue({
      checked: 1,
      failed: 1,
      complete: false,
      healed: [],
      issues: ["Stripe timeout"],
    });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });

  it("isolates one tenant reconciliation issue when the global pass completed", async () => {
    mockReconcile.mockResolvedValue({
      checked: 3,
      failed: 1,
      complete: true,
      healed: [],
      issues: ["one tenant timed out"],
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mockDb.opsStamp.upsert).toHaveBeenCalledOnce();
  });

  it("cannot look healthy without an ops destination", async () => {
    delete process.env.OPS_ALERT_EMAIL;
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });
});
