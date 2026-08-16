import { describe, expect, it } from "vitest";
import { validateProductionRuntimeConfig, type RuntimeEnv } from "@/lib/production-config";

const LIVE_ENV: RuntimeEnv = {
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
};

describe("production runtime configuration", () => {
  it("does nothing in CI/local environments without secrets", () => {
    expect(validateProductionRuntimeConfig({ NODE_ENV: "test" })).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("accepts a complete live configuration", () => {
    expect(validateProductionRuntimeConfig(LIVE_ENV)).toEqual({ ok: true, issues: [] });
  });

  it("allows an inert beta promotion before the founder supplies invite emails", () => {
    expect(
      validateProductionRuntimeConfig({ ...LIVE_ENV, BETA_PROMO_CODE: "BETA_TEST_CODE" }),
    ).toEqual({ ok: true, issues: [] });
  });

  it("rejects test-mode auth/billing and a non-canonical origin", () => {
    const result = validateProductionRuntimeConfig({
      ...LIVE_ENV,
      APP_URL: "https://brightears-app.onrender.com",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
      STRIPE_SECRET_KEY: "sk_test_example",
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toEqual(
      expect.arrayContaining([
        "APP_URL",
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY",
        "STRIPE_SECRET_KEY",
      ]),
    );
  });

  it("rejects incomplete provider pairs, unsafe overrides and key mismatches", () => {
    const result = validateProductionRuntimeConfig({
      ...LIVE_ENV,
      GOOGLE_OAUTH_CLIENT_SECRET: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "different",
      BETA_COMP_EMAILS: "tester@example.com",
      EMAIL_TRANSPORT: "dev",
      DISCOVERY_PROVIDER: "stub",
      TOKEN_ENCRYPTION_KEY: "too-short",
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["pair_incomplete", "missing", "mode_mismatch", "forbidden", "invalid"]),
    );
    expect(result.issues.some((issue) => issue.message.includes("secret-token-value"))).toBe(false);
  });
});
