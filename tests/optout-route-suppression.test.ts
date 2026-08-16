import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockDb = vi.hoisted(() => ({
  lead: { findUnique: vi.fn(), update: vi.fn() },
  sequenceRun: { updateMany: vi.fn() },
  outreachSuppression: { upsert: vi.fn() },
  globalOutreachSuppression: { upsert: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/optout", () => ({ verifyOptoutToken: vi.fn(() => true) }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true })),
  clientIp: vi.fn(() => "127.0.0.1"),
}));

import { POST } from "@/app/api/optout/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.lead.findUnique.mockResolvedValue({
    clientEmail: " Stop@Example.COM ",
    business: { id: "business-a", name: "First Artist" },
  });
  mockDb.lead.update.mockResolvedValue({});
  mockDb.sequenceRun.updateMany.mockResolvedValue({ count: 1 });
  mockDb.outreachSuppression.upsert.mockResolvedValue({ id: "tenant-1" });
  mockDb.globalOutreachSuppression.upsert.mockResolvedValue({ id: "global-1" });
  mockDb.$transaction.mockImplementation(
    async (callback: (tx: typeof mockDb) => Promise<unknown>) => callback(mockDb),
  );
});

describe("POST /api/optout", () => {
  it("atomically records tenant and product-wide unsubscribe rows", async () => {
    const req = new NextRequest("http://localhost/api/optout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ lead: "lead-1", token: "valid-token" }),
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
    expect(mockDb.outreachSuppression.upsert).toHaveBeenCalledWith({
      where: {
        businessId_email: { businessId: "business-a", email: "stop@example.com" },
      },
      create: {
        businessId: "business-a",
        email: "stop@example.com",
        reason: "unsubscribe",
      },
      update: { reason: "unsubscribe" },
    });
    expect(mockDb.globalOutreachSuppression.upsert).toHaveBeenCalledWith({
      where: { email: "stop@example.com" },
      create: {
        email: "stop@example.com",
        reason: "unsubscribe",
        sourceBusinessId: "business-a",
      },
      update: {},
    });
  });

  it("does not claim success when the atomic compliance write fails", async () => {
    mockDb.$transaction.mockRejectedValueOnce(new Error("database unavailable"));
    const req = new NextRequest("http://localhost/api/optout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ lead: "lead-1", token: "valid-token" }),
    });

    const response = await POST(req);

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Please try again");
  });
});
