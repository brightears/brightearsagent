import { describe, expect, it, vi } from "vitest";

// These factories fail if the liveness route ever starts importing readiness
// dependencies. That protects Render from a database/config/cron failure loop.
vi.mock("@/lib/db", () => {
  throw new Error("/api/live must not import the database");
});
vi.mock("@/lib/ops-stamp", () => {
  throw new Error("/api/live must not import cron readiness");
});
vi.mock("@/lib/production-config", () => {
  throw new Error("/api/live must not import production configuration");
});

import { GET } from "@/app/api/live/route";

describe("GET /api/live process liveness", () => {
  it("returns an uncached 200 without readiness dependencies", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
