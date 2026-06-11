import type { Instrumentation } from "next";

/**
 * Server-error observability without a third-party account: every unhandled
 * server error is logged as structured JSON (Render captures logs) and — rate-
 * limited to one email per error-signature per hour — alerted to
 * OPS_ALERT_EMAIL via the existing Postmark transport.
 * (Sentry can replace this later; see ROADMAP.)
 */
const emailedSignatures = new Map<string, number>();
const HOUR = 3600_000;

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const error = err as Error;
  const signature = `${error?.name}:${error?.message?.slice(0, 120)}:${request.path}`;

  console.error(
    JSON.stringify({
      level: "error",
      kind: "unhandled_request_error",
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routeType: context.routeType,
      name: error?.name,
      message: error?.message,
      stack: error?.stack?.split("\n").slice(0, 8).join(" | "),
      ts: new Date().toISOString(),
    }),
  );

  const opsEmail = process.env.OPS_ALERT_EMAIL;
  if (!opsEmail) return;
  const last = emailedSignatures.get(signature) ?? 0;
  if (Date.now() - last < HOUR) return;
  emailedSignatures.set(signature, Date.now());
  // Prune so the map can't grow unbounded.
  if (emailedSignatures.size > 200) {
    const cutoff = Date.now() - HOUR;
    for (const [k, v] of emailedSignatures) if (v < cutoff) emailedSignatures.delete(k);
  }

  try {
    const { sendEmail } = await import("./lib/outbound/send");
    await sendEmail({
      fromName: "Bright Ears Ops",
      to: opsEmail,
      replyTo: opsEmail,
      subject: `[brightears-app] ${error?.name ?? "Error"}: ${error?.message?.slice(0, 80) ?? "unknown"}`,
      textBody: `Path: ${request.method} ${request.path}\nRoute: ${context.routerKind} ${context.routeType}\n\n${error?.stack ?? error?.message ?? String(err)}`,
    });
  } catch {
    // Alerting must never crash the app.
  }
};

export function register() {
  // No-op: required export for the instrumentation hook.
}
