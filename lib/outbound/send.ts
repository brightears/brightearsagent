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
 * Postmark rejects a message whose total size exceeds 10 MB, and attachments
 * are base64-encoded on the wire — which costs roughly a third on top of the
 * raw bytes. So the real budget for raw attachment bytes is about 7 MB, and
 * this is enforced HERE, at the transport, because it is the only place every
 * send passes through.
 *
 * It is enforced at all because the product actively walks customers into the
 * cliff: profile galleries may contain several photos, uploads allow 8 MB each,
 * and the press-kit builder accepts 6 MB per image. A single live press kit
 * photo has reached 5.5 MB; three phone photos could produce a PDF around
 * 20 MB, ~27 MB once encoded — refused by Postmark with a 422.
 *
 * And the way it failed was the worst possible shape: the send threw, the draft
 * reverted to PENDING, and the next attempt hit exactly the same wall forever.
 * The client never received the reply, and the owner saw a draft that merely
 * looked un-sent — no error they could act on, on the one action the whole
 * product exists to perform.
 *
 * Dropping the attachment is strictly better than that. A reply that arrives
 * without its press kit still answers the client, still starts the follow-up
 * sequence, and still beats every DJ who answered a day later. The owner is
 * told, so they can send the file by hand.
 */
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;

/** Attachments that fit, plus the names of any dropped for being too large. */
export function fitAttachments(attachments: OutboundAttachment[]): {
  kept: OutboundAttachment[];
  dropped: { filename: string; bytes: number }[];
} {
  const kept: OutboundAttachment[] = [];
  const dropped: { filename: string; bytes: number }[] = [];
  let total = 0;
  for (const a of attachments) {
    const bytes = a.content.byteLength;
    if (total + bytes > MAX_ATTACHMENT_BYTES) {
      dropped.push({ filename: a.filename, bytes });
      continue;
    }
    kept.push(a);
    total += bytes;
  }
  return { kept, dropped };
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

  // Never let an oversized attachment take the whole reply down (see
  // MAX_ATTACHMENT_BYTES). Log the drop loudly — it means the press-kit builder
  // is producing files too big, which is a bug upstream worth chasing, not a
  // condition to live with quietly.
  if (email.attachments?.length) {
    const { kept, dropped } = fitAttachments(email.attachments);
    if (dropped.length) {
      console.warn(
        JSON.stringify({
          level: "warn",
          kind: "attachment_too_large_dropped",
          to: email.to,
          dropped: dropped.map((d) => `${d.filename} (${Math.round(d.bytes / 1024)}KB)`),
          message:
            "Attachment exceeded the Postmark size budget and was dropped so the reply itself could still send.",
          ts: new Date().toISOString(),
        }),
      );
      email = { ...email, attachments: kept };
    }
  }

  // Fail CLOSED in production (audit 2026-07): a missing token used to
  // silently write .eml files to the ephemeral disk — replies, notifications
  // and reports would "send" into a void nobody reads. Opting into the file
  // transport must be explicit.
  if (!token && process.env.NODE_ENV === "production" && process.env.EMAIL_TRANSPORT !== "dev") {
    throw new Error(
      "POSTMARK_SERVER_TOKEN is missing in production — outbound email would vanish into .eml files. Set the token, or set EMAIL_TRANSPORT=dev to explicitly opt into the file transport.",
    );
  }

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
