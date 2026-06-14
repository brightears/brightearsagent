// Shared server-error reporter (audit B10).
//
// Structured-logs an error (Render captures stdout) and — rate-limited to one
// email per error signature per hour — alerts OPS_ALERT_EMAIL via the existing
// Postmark transport. Used by instrumentation.ts for UNHANDLED request errors
// and by explicit catch blocks (e.g. the inbound pipeline) for CAUGHT errors
// that would otherwise be logged-and-swallowed with no alert. Sentry can
// replace this later (see ROADMAP); the call sites stay the same.
const emailedSignatures = new Map<string, number>();
const HOUR = 3600_000;

type ErrorContext = {
  kind: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
};

export async function reportError(err: unknown, context: ErrorContext): Promise<void> {
  const error = err as Error | undefined;

  console.error(
    JSON.stringify({
      level: "error",
      ...context,
      name: error?.name,
      message: error?.message,
      stack: error?.stack?.split("\n").slice(0, 8).join(" | "),
      ts: new Date().toISOString(),
    }),
  );

  // Email alerting needs Node APIs — skip on the edge runtime (the structured
  // log above still reaches stdout). Also skip when no destination is set.
  const opsEmail = process.env.OPS_ALERT_EMAIL;
  if (!opsEmail) return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;

  const signature = `${error?.name}:${error?.message?.slice(0, 120)}:${context.path ?? context.kind}`;
  const last = emailedSignatures.get(signature) ?? 0;
  if (Date.now() - last < HOUR) return;
  emailedSignatures.set(signature, Date.now());
  if (emailedSignatures.size > 200) {
    const cutoff = Date.now() - HOUR;
    for (const [k, v] of emailedSignatures) if (v < cutoff) emailedSignatures.delete(k);
  }

  try {
    const { sendEmail } = await import("./outbound/send");
    await sendEmail({
      fromName: "Bright Ears Ops",
      to: opsEmail,
      replyTo: opsEmail,
      subject: `[brightears-app] ${error?.name ?? "Error"}: ${error?.message?.slice(0, 80) ?? "unknown"}`,
      textBody: `${context.kind} ${context.method ?? ""} ${context.path ?? ""}\n\n${error?.stack ?? error?.message ?? String(err)}`,
    });
  } catch {
    // Alerting must never crash the caller.
  }
}
