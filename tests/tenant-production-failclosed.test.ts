import { afterEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({
  db: {
    business: { findFirst: mockFindFirst },
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), currentUser: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());

describe("production tenant boundary", () => {
  it("never falls back to the demo tenant when the Clerk server key is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("DEV_TENANT_SLUG", "");
    vi.resetModules();
    const { getCurrentBusiness } = await import("@/lib/tenant");

    await expect(getCurrentBusiness()).rejects.toThrow(/refusing demo tenant fallback/i);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
