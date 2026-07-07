import { pushToBusiness } from "@/lib/push";
import { sendEmail } from "@/lib/outbound/send";
import { appUrl } from "@/lib/oauth/google";
import { reportError } from "@/lib/report-error";

/**
 * Owner notification, dual-channel (audit 2026-07: every critical alert rode
 * on opt-in web push — buried in settings, impossible on iOS without the PWA —
 * so an artist who skipped the toggle heard NOTHING; the only email they ever
 * got was the weekly report).
 *
 * Sends web push to every registered device AND a plain email to ownerEmail
 * with a deep link. This is a BRIGHT EARS → OWNER channel — the white-label
 * invariant (rule 7) governs client-facing mail, not the product talking to
 * its own customer.
 *
 * Per-channel failures are reported, never thrown: a notification must not
 * break the pipeline that triggered it.
 */
export async function notifyBusiness(
  business: { id: string; ownerEmail: string },
  msg: {
    title: string;
    body: string;
    /** App-relative path (e.g. /dashboard/leads/abc) — absolutized for email. */
    url?: string;
    /** Longer email body; falls back to `body`. */
    emailBody?: string;
    /** Skip the email channel (e.g. the event is only useful in-app). */
    pushOnly?: boolean;
  },
): Promise<void> {
  const link = msg.url ? `${appUrl()}${msg.url}` : undefined;

  const push = pushToBusiness(business.id, {
    title: msg.title,
    body: msg.body,
    url: msg.url,
  }).catch((err) => reportError(err, { kind: "notify-push", businessId: business.id }));

  const email = msg.pushOnly
    ? Promise.resolve()
    : sendEmail({
        fromName: "Bright Ears",
        to: business.ownerEmail,
        replyTo: "support@brightears.io",
        subject: msg.title,
        textBody: [msg.emailBody ?? msg.body, link ? `\n${link}` : ""].join("\n").trim(),
      })
        .then(() => undefined)
        .catch((err) => reportError(err, { kind: "notify-email", businessId: business.id }));

  await Promise.all([push, email]);
}
