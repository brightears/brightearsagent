// Pure helpers for the "Send test email" mailbox affordance (app/actions/venues
// → sendTestEmail). Kept OUT of the "use server" action file because a server-
// action module may only export async functions — constants and the in-memory
// rate limiter live here.

/** The unmissable banner prepended to a test email so it's never mistaken for a
 *  real pitch. */
export const TEST_EMAIL_BANNER =
  "— TEST EMAIL from your Bright Ears outreach mailbox. This is a sample of the pitches your agent sends to venues. No venue received this. —";

/** A short static sample used when the LLM generator can't be reached — the
 *  test send must still validate the transport even if generation fails. */
export const TEST_EMAIL_STATIC_SAMPLE = {
  subject: "A quick intro for your rooftop",
  body:
    "Hi there — I came across The Sample Rooftop and wanted to introduce myself. " +
    "I play weddings and events around here and thought I might be a fit for your room. " +
    "Here's a one-page look at what I do, whenever you have a moment.\n\n" +
    "If you ever need entertainment for an evening, I'd love to be on your list.",
};

// Light abuse guard — at most TEST_SEND_LIMIT sends per tenant per window.
// In-memory (owner-only, low-stakes); resets on deploy, which is fine.
const TEST_SEND_LIMIT = 5;
const TEST_SEND_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const testSendLog = new Map<string, number[]>();

/** Record a test send and report whether it's within the per-tenant rate limit. */
export function testSendAllowed(businessId: string): boolean {
  const now = Date.now();
  const recent = (testSendLog.get(businessId) ?? []).filter((t) => now - t < TEST_SEND_WINDOW_MS);
  if (recent.length >= TEST_SEND_LIMIT) {
    testSendLog.set(businessId, recent);
    return false;
  }
  recent.push(now);
  testSendLog.set(businessId, recent);
  return true;
}

/** Test-only: clear the in-memory rate-limit log (it persists across calls
 *  within a process, which would otherwise leak between test cases). */
export function __resetTestSendLog(): void {
  testSendLog.clear();
}
