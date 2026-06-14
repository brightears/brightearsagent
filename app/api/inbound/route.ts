import { NextRequest, NextResponse } from "next/server";
import type { InboundEmail } from "@/lib/inbound/types";
import { processInbound } from "@/lib/inbound/pipeline";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/report-error";

/** Postmark inbound webhook payload (the fields we use). */
interface PostmarkInbound {
  FromFull?: { Email?: string; Name?: string };
  From?: string;
  OriginalRecipient?: string;
  ToFull?: Array<{ Email?: string }>;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Headers?: Array<{ Name: string; Value: string }>;
  MessageID?: string;
  Date?: string;
}

export async function POST(req: NextRequest) {
  // Abuse guard (audit B10): generous per-IP cap so a leaked secret or a flood
  // can't run away with LLM spend. Normal Postmark delivery stays well under it.
  const rl = rateLimit(`inbound:${clientIp(req)}`, 300, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } },
    );
  }

  // Shared-secret check. Prefer sending the secret as a header that does NOT
  // leak into request logs: `Authorization: Bearer <INBOUND_WEBHOOK_SECRET>` (or
  // `x-webhook-secret`). The legacy `?secret=` query param still works for an
  // already-configured Postmark webhook, but migrate it to the header.
  // Fail-closed in production if the secret is unset.
  if (!checkSharedSecret(process.env.INBOUND_WEBHOOK_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PostmarkInbound;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const to =
    payload.OriginalRecipient ??
    payload.ToFull?.map((t) => t.Email ?? "").find((e) => /leads@/i.test(e)) ??
    payload.ToFull?.[0]?.Email ??
    "";

  const email: InboundEmail = {
    from: payload.FromFull?.Email ?? payload.From ?? "",
    fromName: payload.FromFull?.Name || undefined,
    to,
    subject: payload.Subject ?? "",
    textBody: payload.TextBody ?? "",
    htmlBody: payload.HtmlBody || undefined,
    headers: Object.fromEntries((payload.Headers ?? []).map((h) => [h.Name, h.Value])),
    providerMessageId: payload.MessageID,
    receivedAt: payload.Date,
  };

  if (!email.from || !email.to) {
    return NextResponse.json({ error: "missing addresses" }, { status: 400 });
  }

  try {
    const result = await processInbound(email);
    // Always 200 for processed outcomes — Postmark retries non-2xx, and
    // "no_tenant"/"ignored" are final states, not transient failures.
    return NextResponse.json(result);
  } catch (err) {
    // Alert, don't just swallow (audit B10): a silently-failing inbound means
    // lost leads. 500 → Postmark retries later; transient LLM/DB failures heal.
    await reportError(err, { kind: "inbound_pipeline_error", path: "/api/inbound", method: "POST" });
    return NextResponse.json({ error: "pipeline failure" }, { status: 500 });
  }
}
