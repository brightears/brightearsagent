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

export function register() {
  // No-op: required export for the instrumentation hook.
}
