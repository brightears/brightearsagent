/**
 * Deliverability probe for ROADMAP 5b — inbox PLACEMENT, not authentication.
 *
 * Authentication (SPF/DKIM/DMARC) is already verified green by
 * scripts/preflight-live.ts. That is necessary but not sufficient: a perfectly
 * authenticated message still lands in spam if the CONTENT trips filters, the
 * sending IP has a poor reputation, or the message looks nothing like real mail.
 * mail-tester.com scores all of that, and it needs a real message to score.
 *
 * So this deliberately sends through the REAL sendEmail() with the REAL
 * complianceFooter, in the exact shape lib/agent/send-reply.ts produces:
 * text-only, fromName = the business name (white-label invariant), Reply-To =
 * the owner. A synthetic "test test test" body would score a fiction.
 *
 * Usage, in the Render shell (needs the live Postmark token + OUTBOUND_FROM):
 *   npx tsx scripts/mail-tester.ts <address> [reply|followup]
 *
 * Get <address> from https://www.mail-tester.com (a fresh one per test), then
 * read the score back at https://www.mail-tester.com/<id>
 *
 * `reply` (default) is the flagship first reply a client receives — no footer,
 * because a first reply to someone who just inquired is solicited 1:1 mail.
 * `followup` is the sequence email, which carries the who/why/opt-out footer.
 * They are materially different messages and worth scoring separately.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { sendEmail } from "../lib/outbound/send";
import { complianceFooter } from "../lib/optout";

// Representative copy. This is the product's actual voice — availability-aware,
// personal, no marketing language — because that is what gets scored.
const REPLY_BODY = `Hi Sarah,

Thanks for getting in touch about your wedding on 12 September at Sala Rim Naam
— that's a beautiful room to play, the acoustics over the water are lovely.

Good news: I'm free that evening. For a 120-guest reception I'd normally suggest
the full evening package — ceremony background music, drinks reception, then DJ
from dinner through to close, with all sound and lighting included.

A couple of things that would help me put an exact quote together:

  - What time would you like music to start, and when does the venue close?
  - Any first-dance song or must-play list you already have in mind?
  - Is there a separate ceremony space, or is it all in the one room?

Happy to jump on a quick call this week if that's easier.

Best,
Norbert
Bright Ears`;

async function main() {
  const to = process.argv[2];
  const mode = (process.argv[3] ?? "reply") as "reply" | "followup";
  if (!to || !to.includes("@")) {
    console.error("usage: npx tsx scripts/mail-tester.ts <address> [reply|followup]");
    console.error("get a fresh address from https://www.mail-tester.com");
    process.exit(1);
  }
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    console.error(
      "POSTMARK_SERVER_TOKEN unset — this would write a .eml file instead of sending, and score nothing. Run it in the Render shell.",
    );
    process.exit(1);
  }

  // Follow-ups append the footer at send time, exactly as send-reply.ts does.
  // The lead id is fake, so the opt-out link 404s rather than killing a real
  // lead if anyone clicks it — the point is to score the footer's SHAPE.
  const body =
    mode === "followup" ? REPLY_BODY + complianceFooter("Bright Ears", "mailtester-probe") : REPLY_BODY;

  console.log(`mode        : ${mode}`);
  console.log(`from        : ${process.env.OUTBOUND_FROM}`);
  console.log(`to          : ${to}`);
  console.log(`body bytes  : ${body.length}`);

  const res = await sendEmail({
    fromName: "Bright Ears",
    to,
    replyTo: "norbert@brightears.io",
    subject: "Re: DJ for our wedding, 12 September",
    textBody: body,
  });
  console.log(`\nsent via ${res.transport}, id ${res.providerMessageId}`);
  console.log("now open https://www.mail-tester.com/<your-id> to read the score");
}

main().catch((e) => {
  console.error("send failed:", (e as Error).message);
  process.exit(1);
});
