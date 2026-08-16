import type { Instrumentation } from "next";
import { reportError } from "./lib/report-error";
import { validateProductionRuntimeConfig } from "./lib/production-config";

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

export function register() {
  // Node runtime only (register also runs on the edge bundle) and prod only.
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  for (const issue of validateProductionRuntimeConfig(process.env).issues) {
    console.error(
      JSON.stringify({
        level: "error",
        kind: "env_contract",
        key: issue.key,
        code: issue.code,
        message: issue.message,
        ts: new Date().toISOString(),
      }),
    );
  }
}
