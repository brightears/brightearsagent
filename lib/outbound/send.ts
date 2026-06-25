export interface OutboundAttachment {
  filename: string;
  content: Buffer; // raw bytes; base64-encoded for Postmark
  contentType: string; // e.g. "application/pdf"
}

export interface OutboundEmail {
  fromName: string; // the business name — white-label invariant
  to: string;
  replyTo: string; // the owner's real address
  subject: string;
  textBody: string;
  headers?: Record<string, string>;
  attachments?: OutboundAttachment[]; // e.g. the artist's press kit / a quote PDF
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

  // EMAIL_TRANSPORT=dev forces the file transport even when a token exists —
  // test scripts set this so they never hit the real Postmark API.
  if (!token || process.env.EMAIL_TRANSPORT === "dev") {
    // node:fs imported lazily so this module stays Edge-bundle-safe
    // (instrumentation.ts pulls it into the edge graph).
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), ".dev-outbox");
    mkdirSync(dir, { recursive: true });
    const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const eml = [
      `From: ${email.fromName} <${fromAddress}>`,
      `Reply-To: ${email.replyTo}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      ...Object.entries(email.headers ?? {}).map(([k, v]) => `${k}: ${v}`),
      ...(email.attachments ?? []).map(
        (a) => `X-Attachment: ${a.filename} (${a.contentType}, ${a.content.length} bytes)`,
      ),
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
      ...(email.attachments && email.attachments.length > 0
        ? {
            Attachments: email.attachments.map((a) => ({
              Name: a.filename,
              Content: a.content.toString("base64"),
              ContentType: a.contentType,
            })),
          }
        : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Postmark send failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { MessageID: string };
  return { providerMessageId: data.MessageID, transport: "postmark" };
}
