import { NextRequest, NextResponse } from "next/server";
import type { InboundEmail } from "@/lib/inbound/types";
import { processInbound } from "@/lib/inbound/pipeline";
import { checkSharedSecret } from "@/lib/auth-secret";

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
  // Shared-secret check (set the same value in the Postmark webhook URL ?secret=...).
  // Fail-closed in production if the secret is unset.
  if (!checkSharedSecret(process.env.INBOUND_WEBHOOK_SECRET, req.nextUrl.searchParams.get("secret"))) {
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
    console.error("inbound pipeline error", err);
    // 500 → Postmark retries later; transient LLM/DB failures self-heal.
    return NextResponse.json({ error: "pipeline failure" }, { status: 500 });
  }
}
