import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  opsStamp: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { GET } from "@/app/api/health/route";

const LIVE_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://app:secret@db.internal/brightears",
  APP_URL: "https://brightears.io",
  POSTMARK_SERVER_TOKEN: "postmark-token",
  OUTBOUND_FROM: "replies@mail.brightears.io",
  SERPER_API_KEY: "serper-token",
  OPENROUTER_API_KEY: "openrouter-token",
  OPS_ALERT_EMAIL: "ops@brightears.io",
  INBOUND_WEBHOOK_SECRET: "inbound-secret",
  CRON_SECRET: "cron-secret",
  OPTOUT_SECRET: "optout-secret",
  STRIPE_SECRET_KEY: "sk_live_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
  CLERK_SECRET_KEY: "sk_live_example",
  TOKEN_ENCRYPTION_KEY: "a".repeat(64),
  GOOGLE_OAUTH_CLIENT_ID: "google-client",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "access",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "bucket",
  R2_PUBLIC_BASE_URL: "https://cdn.brightears.io",
  VAPID_PUBLIC_KEY: "public-vapid",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-vapid",
  VAPID_PRIVATE_KEY: "private-vapid",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.$queryRaw.mockResolvedValue([{ ok: 1 }]);
  mockDb.opsStamp.findMany.mockResolvedValue([]);
  for (const [key, value] of Object.entries(LIVE_ENV)) vi.stubEnv(key, value);
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health production readiness", () => {
  it("returns an actual 503 when critical runtime config is missing", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.db).toBe(true);
    expect(body.config.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: expect.stringContaining("CLERK_SECRET_KEY") })]),
    );
    expect(body.config.issueCount).toBeGreaterThan(0);
    expect(body.config.issues.every((issue: object) => Object.keys(issue).sort().join(",") === "code,key"))
      .toBe(true);
    expect(JSON.stringify(body)).not.toContain("required in production");
  });

  it("returns 200 for complete config while keeping cron freshness separate", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, db: true, clerkConfigured: true });
    expect(body.cronsHealthy).toBe(true);
  });

  it("returns 503 when a completion heartbeat is stale", async () => {
    mockDb.opsStamp.findMany.mockResolvedValue([
      { key: "cron:sequences", at: new Date(Date.now() - 60 * 60 * 1000) },
      { key: "cron:discovery", at: new Date() },
      { key: "cron:weekly-report", at: new Date() },
      { key: "cron:margin-guardrail", at: new Date() },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, db: true, cronsHealthy: false });
  });
});
