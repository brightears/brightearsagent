import type { Instrumentation } from "next";
import { reportError } from "./lib/report-error";

/**
 * Server-error observability without a third-party account: every unhandled
 * server error is structured-logged (Render captures logs) and — rate-limited
 * to one email per error signature per hour — alerted to OPS_ALERT_EMAIL via
 * the Postmark transport. The same reporter (lib/report-error.ts) is called
 * from explicit catch blocks so caught-and-swallowed errors alert too (audit
 * B10). Sentry can replace this later; see ROADMAP.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await reportError(err, {
    kind: "unhandled_request_error",
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routeType: context.routeType,
  });
};

// The production env contract (P7.5, audit 2026-07: a missing integration key
// used to mean "quietly degraded for weeks"). Boot-time assertion: one loud
// structured log line per missing var — LOGGED, not thrown, because the
// per-integration guards (lib/outbound/send.ts, lib/discovery/provider.ts,
// lib/auth-secret.ts, proxy.ts) already fail closed at USE time; killing the
// whole server on boot would take the marketing site down with it.
const PROD_ENV_CONTRACT = [
  "DATABASE_URL",
  "APP_URL",
  "POSTMARK_SERVER_TOKEN",
  "OUTBOUND_FROM",
  "SERPER_API_KEY",
  "OPENROUTER_API_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "OPS_ALERT_EMAIL",
  "INBOUND_WEBHOOK_SECRET",
  "CRON_SECRET",
  "OPTOUT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
];

export function register() {
  // Node runtime only (register also runs on the edge bundle) and prod only.
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  for (const key of PROD_ENV_CONTRACT) {
    if (!process.env[key]) {
      console.error(
        JSON.stringify({
          level: "error",
          kind: "env_contract",
          message: `${key} is not set — the integration it backs is degraded or fail-closed`,
          ts: new Date().toISOString(),
        }),
      );
    }
  }
}
