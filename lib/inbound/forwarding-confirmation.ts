import type { InboundEmail } from "@/lib/inbound/types";

/**
 * Provider forwarding-confirmation detection (P2, July 2026).
 *
 * When an artist sets up Gmail auto-forwarding to their lead address, Google
 * first sends a verification email — from forwarding-noreply@google.com — to
 * that address. Onboarding step 5 tells the artist it will "arrive in your
 * Pipeline", but the LLM fallback parser is (correctly) instructed to ignore
 * automated notices, so the pipeline dropped it and self-serve activation of
 * the #1 email provider dead-ended.
 *
 * This detector runs BEFORE parse/triage. It never guesses: only exact known
 * sender addresses match, and the URL/code are extracted with conservative
 * patterns (either may be null — the step-5 card degrades to "check the
 * forwarded copy in your inbox").
 *
 * Outlook/Microsoft need no equivalent: forwarding there is confirmed inside
 * settings, not by a verification email.
 */
export type ForwardingConfirmation = {
  provider: "gmail";
  url: string | null;
  code: string | null;
};

const GMAIL_SENDERS = ["forwarding-noreply@google.com", "forwarding-noreply@googlemail.com"];

// Google's approval link lives on mail-settings.google.com (e.g. /mail/vf-…).
const GMAIL_URL_RE = /https:\/\/mail-settings\.google\.com\/mail\/[^\s"'<>)\]]+/i;
// "Confirmation code: 123456789" — appears in both the subject and the body.
const GMAIL_CODE_RE = /confirmation code:?\s*#?\s*(\d{6,12})/i;

export function detectForwardingConfirmation(email: InboundEmail): ForwardingConfirmation | null {
  const from = email.from.trim().toLowerCase();
  if (!GMAIL_SENDERS.some((s) => from === s || from.endsWith(`<${s}>`))) return null;

  const haystack = `${email.subject}\n${email.textBody}\n${email.htmlBody ?? ""}`;
  const url = haystack.match(GMAIL_URL_RE)?.[0] ?? null;
  const code = haystack.match(GMAIL_CODE_RE)?.[1] ?? null;
  return { provider: "gmail", url, code };
}
