/**
 * Pure validation for the production runtime contract.
 *
 * This module deliberately performs no validation at import/build time. Next
 * builds and CI do not carry production secrets; the live health route calls
 * this function at request time, after Render has injected runtime values.
 */

export type RuntimeEnv = Readonly<Record<string, string | undefined>>;

export type ProductionConfigIssue = {
  key: string;
  code:
    | "missing"
    | "invalid"
    | "mode_mismatch"
    | "pair_incomplete"
    | "forbidden";
  message: string;
};

export type ProductionConfigResult = {
  ok: boolean;
  issues: ProductionConfigIssue[];
};

const REQUIRED = [
  "DATABASE_URL",
  "POSTMARK_SERVER_TOKEN",
  "OUTBOUND_FROM",
  "SERPER_API_KEY",
  "OPENROUTER_API_KEY",
  "OPS_ALERT_EMAIL",
  "INBOUND_WEBHOOK_SECRET",
  "CRON_SECRET",
  "OPTOUT_SECRET",
  "STRIPE_WEBHOOK_SECRET",
] as const;

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

function value(env: RuntimeEnv, key: string): string {
  return env[key]?.trim() ?? "";
}

function addMissing(
  issues: ProductionConfigIssue[],
  env: RuntimeEnv,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (!value(env, key)) {
      issues.push({ key, code: "missing", message: `${key} is required in production` });
    }
  }
}

function validatePair(
  issues: ProductionConfigIssue[],
  env: RuntimeEnv,
  left: string,
  right: string,
  opts: { required?: boolean } = {},
): void {
  const hasLeft = !!value(env, left);
  const hasRight = !!value(env, right);
  if (opts.required && !hasLeft && !hasRight) {
    addMissing(issues, env, [left, right]);
    return;
  }
  if (hasLeft !== hasRight) {
    issues.push({
      key: `${left},${right}`,
      code: "pair_incomplete",
      message: `${left} and ${right} must be configured together`,
    });
  }
}

function isCanonicalAppUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "brightears.io" &&
      (parsed.pathname === "/" || parsed.pathname === "") &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port
    );
  } catch {
    return false;
  }
}

/**
 * Validate the configuration needed for a first paying customer.
 *
 * In non-production environments the contract is intentionally inactive so
 * CI, unit tests and local builds stay secretless. Issues contain internal
 * operator guidance but never secret values; public callers must project them
 * to keys/codes, as /api/health does.
 */
export function validateProductionRuntimeConfig(env: RuntimeEnv): ProductionConfigResult {
  if (env.NODE_ENV !== "production") return { ok: true, issues: [] };

  const issues: ProductionConfigIssue[] = [];
  addMissing(issues, env, REQUIRED);

  const appUrl = value(env, "APP_URL");
  if (!appUrl) {
    issues.push({ key: "APP_URL", code: "missing", message: "APP_URL is required in production" });
  } else if (!isCanonicalAppUrl(appUrl)) {
    issues.push({
      key: "APP_URL",
      code: "invalid",
      message: "APP_URL must be the canonical https://brightears.io origin",
    });
  }

  validatePair(
    issues,
    env,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    { required: true },
  );
  const clerkPublic = value(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const clerkSecret = value(env, "CLERK_SECRET_KEY");
  if (clerkPublic && !clerkPublic.startsWith("pk_live_")) {
    issues.push({
      key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      code: "mode_mismatch",
      message: "Production Clerk publishable key must be live-mode",
    });
  }
  if (clerkSecret && !clerkSecret.startsWith("sk_live_")) {
    issues.push({
      key: "CLERK_SECRET_KEY",
      code: "mode_mismatch",
      message: "Production Clerk secret key must be live-mode",
    });
  }

  const stripeSecret = value(env, "STRIPE_SECRET_KEY");
  if (!stripeSecret) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      code: "missing",
      message: "STRIPE_SECRET_KEY is required in production",
    });
  } else if (!stripeSecret.startsWith("sk_live_")) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      code: "mode_mismatch",
      message: "Production Stripe secret key must be live-mode",
    });
  }
  const stripeWebhook = value(env, "STRIPE_WEBHOOK_SECRET");
  if (stripeWebhook && !stripeWebhook.startsWith("whsec_")) {
    issues.push({
      key: "STRIPE_WEBHOOK_SECRET",
      code: "invalid",
      message: "STRIPE_WEBHOOK_SECRET must be a Stripe endpoint signing secret",
    });
  }

  const tokenKey = value(env, "TOKEN_ENCRYPTION_KEY");
  if (!tokenKey) {
    issues.push({
      key: "TOKEN_ENCRYPTION_KEY",
      code: "missing",
      message: "TOKEN_ENCRYPTION_KEY is required in production",
    });
  } else if (!/^[0-9a-fA-F]{64}$/.test(tokenKey)) {
    issues.push({
      key: "TOKEN_ENCRYPTION_KEY",
      code: "invalid",
      message: "TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters",
    });
  }

  validatePair(issues, env, "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", {
    required: true,
  });

  addMissing(issues, env, R2_KEYS);
  const r2PublicBase = value(env, "R2_PUBLIC_BASE_URL");
  if (r2PublicBase && !/^https:\/\//i.test(r2PublicBase)) {
    issues.push({
      key: "R2_PUBLIC_BASE_URL",
      code: "invalid",
      message: "R2_PUBLIC_BASE_URL must be HTTPS",
    });
  }

  validatePair(issues, env, "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", { required: true });
  const vapidPublic = value(env, "VAPID_PUBLIC_KEY");
  const vapidBrowserPublic = value(env, "NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!vapidBrowserPublic) {
    issues.push({
      key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      code: "missing",
      message: "NEXT_PUBLIC_VAPID_PUBLIC_KEY is required in production",
    });
  } else if (vapidPublic && vapidBrowserPublic !== vapidPublic) {
    issues.push({
      key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY,VAPID_PUBLIC_KEY",
      code: "mode_mismatch",
      message: "Browser and server VAPID public keys must match",
    });
  }

  const betaEmails = value(env, "BETA_COMP_EMAILS")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  if (betaEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    issues.push({
      key: "BETA_COMP_EMAILS",
      code: "invalid",
      message: "BETA_COMP_EMAILS must contain only comma-separated email addresses",
    });
  }

  if (value(env, "EMAIL_TRANSPORT").toLowerCase() === "dev") {
    issues.push({
      key: "EMAIL_TRANSPORT",
      code: "forbidden",
      message: "EMAIL_TRANSPORT=dev is forbidden in production",
    });
  }
  if (value(env, "DISCOVERY_PROVIDER").toLowerCase() === "stub") {
    issues.push({
      key: "DISCOVERY_PROVIDER",
      code: "forbidden",
      message: "DISCOVERY_PROVIDER=stub is forbidden in production",
    });
  }

  return { ok: issues.length === 0, issues };
}
