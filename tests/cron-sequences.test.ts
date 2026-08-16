import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockDb = vi.hoisted(() => ({ opsStamp: { upsert: vi.fn() } }));
const mockTick = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/sequences/engine", () => ({ runSequenceTick: mockTick }));

import { GET } from "@/app/api/cron/sequences/route";

const req = (secret?: string) =>
  new NextRequest(`http://localhost/api/cron/sequences${secret ? `?secret=${secret}` : ""}`);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-test-secret";
  mockTick.mockResolvedValue({ stepsFired: 0, draftAttempts: 0, draftFailures: 0 });
  mockDb.opsStamp.upsert.mockResolvedValue({});
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/sequences completion heartbeat", () => {
  it("records the heartbeat only after the tick finishes", async () => {
    const response = await GET(req("cron-test-secret"));

    expect(response.status).toBe(200);
    expect(mockTick).toHaveBeenCalledOnce();
    expect(mockDb.opsStamp.upsert).toHaveBeenCalledOnce();
    expect(mockTick.mock.invocationCallOrder[0]).toBeLessThan(
      mockDb.opsStamp.upsert.mock.invocationCallOrder[0],
    );
    expect(mockDb.opsStamp.upsert.mock.calls[0][0]).toMatchObject({
      where: { key: "cron:sequences" },
    });
  });

  it("does not write a false-green completion when the tick crashes", async () => {
    mockTick.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(GET(req("cron-test-secret"))).rejects.toThrow("database unavailable");
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });

  it("returns 503 and does not stamp when every draft attempt fails", async () => {
    mockTick.mockResolvedValueOnce({
      stepsFired: 0,
      draftAttempts: 3,
      draftFailures: 3,
    });

    const response = await GET(req("cron-test-secret"));

    expect(response.status).toBe(503);
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });

  it("rejects unauthorized calls before work or heartbeat writes", async () => {
    expect((await GET(req("wrong"))).status).toBe(401);
    expect(mockTick).not.toHaveBeenCalled();
    expect(mockDb.opsStamp.upsert).not.toHaveBeenCalled();
  });
});
