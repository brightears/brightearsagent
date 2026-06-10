import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface OutboundEmail {
  fromName: string; // the business name — white-label invariant
  to: string;
  replyTo: string; // the owner's real address
  subject: string;
  textBody: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  providerMessageId: string;
  transport: "postmark" | "dev";
}

/**
 * Outbound transport. Postmark when POSTMARK_SERVER_TOKEN is set; otherwise a
 * dev transport that writes .eml files to .dev-outbox/ so the whole
 * approve→send flow is verifiable before the founder gate clears.
 * From address: OUTBOUND_FROM (Phase 8 moves this to mail.brightears.io).
 */
export async function sendEmail(email: OutboundEmail): Promise<SendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const fromAddress = process.env.OUTBOUND_FROM ?? "replies@dev.invalid";

  if (!token) {
    const dir = join(process.cwd(), ".dev-outbox");
    mkdirSync(dir, { recursive: true });
    const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const eml = [
      `From: ${email.fromName} <${fromAddress}>`,
      `Reply-To: ${email.replyTo}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      ...Object.entries(email.headers ?? {}).map(([k, v]) => `${k}: ${v}`),
      "",
      email.textBody,
    ].join("\n");
    writeFileSync(join(dir, `${id}.eml`), eml);
    return { providerMessageId: id, transport: "dev" };
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: `${email.fromName} <${fromAddress}>`,
      ReplyTo: email.replyTo,
      To: email.to,
      Subject: email.subject,
      TextBody: email.textBody,
      MessageStream: "outbound",
      Headers: Object.entries(email.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Postmark send failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { MessageID: string };
  return { providerMessageId: data.MessageID, transport: "postmark" };
}
