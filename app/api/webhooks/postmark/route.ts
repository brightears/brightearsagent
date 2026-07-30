import { NextRequest, NextResponse } from "next/server";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  applyPostmarkDeliveryEvent,
  type PostmarkBouncePayload,
} from "@/lib/postmark/bounce";
import { reportError } from "@/lib/report-error";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`postmark-events:${clientIp(req)}`, 300, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  if (!checkSharedSecret(process.env.INBOUND_WEBHOOK_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PostmarkBouncePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // A webhook can be configured for multiple Postmark event types. Unknown
  // types are final no-ops and must be acknowledged so Postmark does not retry.
  if (payload.RecordType !== "Bounce" && payload.RecordType !== "SpamComplaint") {
    return NextResponse.json({ outcome: "ignored", reason: "unsupported event" });
  }
  if (!payload.MessageID) {
    return NextResponse.json({ outcome: "ignored", reason: "missing MessageID" });
  }

  try {
    return NextResponse.json(await applyPostmarkDeliveryEvent(payload));
  } catch (err) {
    // If the ops mailbox itself bounced, using the email-based reporter here
    // would recurse. Structured logging still reaches Render in that case.
    const recipient = payload.Email?.trim().toLowerCase();
    const ops = process.env.OPS_ALERT_EMAIL?.trim().toLowerCase();
    if (recipient && ops && recipient === ops) {
      const error = err as Error;
      console.error(
        JSON.stringify({
          level: "error",
          kind: "postmark_webhook_error",
          message: error?.message,
          ts: new Date().toISOString(),
        }),
      );
    } else {
      await reportError(err, {
        kind: "postmark_webhook_error",
        path: "/api/webhooks/postmark",
        method: "POST",
      });
    }
    // Unlike final classification outcomes, a DB failure is transient.
    return NextResponse.json({ error: "webhook processing failed" }, { status: 500 });
  }
}
