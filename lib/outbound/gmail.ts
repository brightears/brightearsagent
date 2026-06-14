// Gmail send transport (Phase 10.5) — sends proactive venue pitches from the
// ARTIST'S own connected mailbox. NOT Postmark: that's the whole point of
// own-mailbox sending (one artist's cold pitches must never touch the reactive
// product's shared deliverability — ADR-004 D4).
//
// Flow: getValidAccessToken decrypts the stored token, refreshes it if it's
// expiring within 60s (persisting the new one), and hands it to sendGmail,
// which builds a proper RFC 2822 MIME message and POSTs the base64url payload
// to the Gmail users.messages.send endpoint.

import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { refreshAccessToken } from "@/lib/oauth/google";

const SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const REFRESH_SKEW_MS = 60_000; // refresh if the token dies within a minute

/** fetch seam — tests inject a stub so no real network call is made. */
type FetchLike = typeof fetch;

/** Thrown when the connection is unusable and the artist must reconnect. */
export class MailboxError extends Error {
  constructor(
    message: string,
    readonly reconnect = false,
  ) {
    super(message);
    this.name = "MailboxError";
  }
}

/**
 * A valid (fresh-enough) Gmail access token for a tenant. Decrypts the stored
 * token; if it expires within REFRESH_SKEW_MS, refreshes via the refresh token
 * and persists the new access token + expiry. A dead/revoked refresh token
 * marks the mailbox ERROR and throws a friendly MailboxError(reconnect).
 */
export async function getValidAccessToken(
  businessId: string,
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const conn = await db.mailboxConnection.findUnique({ where: { businessId } });
  if (!conn) throw new MailboxError("No mailbox connected", true);
  if (conn.status === "REVOKED") {
    throw new MailboxError("Mailbox disconnected — reconnect to send", true);
  }

  if (conn.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
    return decryptToken(conn.accessTokenEnc);
  }

  // Expiring (or expired) — refresh and persist.
  let refreshed;
  try {
    refreshed = await refreshAccessToken(decryptToken(conn.refreshTokenEnc), fetchImpl);
  } catch {
    await db.mailboxConnection.update({
      where: { businessId },
      data: { status: "ERROR", lastError: "Token refresh failed — please reconnect" },
    });
    throw new MailboxError("Couldn't refresh your mailbox token — reconnect to send", true);
  }

  await db.mailboxConnection.update({
    where: { businessId },
    data: {
      accessTokenEnc: encryptToken(refreshed.access),
      expiresAt: refreshed.expiresAt,
      status: "CONNECTED",
      lastError: null,
    },
  });
  return refreshed.access;
}

export interface GmailSendInput {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string; // text/plain, UTF-8
  /** Reply-To override; defaults to the connected sending address. */
  replyToEmail?: string;
}

/**
 * Strip every control character (CR, LF, and the rest of \x00-\x1F + DEL) from
 * a header component BEFORE it is assembled into the MIME message. This is the
 * header-injection guard: the To display name is a SCRAPED venue name, the From
 * display name is business.name, the Subject is LLM output — all
 * attacker-influenceable. An ASCII value carrying "\r\nBcc: evil@x.com" would
 * otherwise inject a real header line. Applied to EVERY component regardless of
 * ASCII/non-ASCII, and BEFORE any RFC 2047 encoding.
 */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\x00-\x1F\x7F]/g, "");
}

/**
 * Validate a bare email ADDRESS for use in a To/From/Reply-To header. Beyond
 * stripping control chars we reject anything that could smuggle a second
 * recipient or break out of the address: whitespace, commas, angle brackets,
 * quotes, semicolons. A value failing the basic shape throws — we will NOT send
 * to a malformed/injected address.
 */
function sanitizeEmailAddress(email: string): string {
  const clean = sanitizeHeaderValue(email).trim();
  // Basic shape: local@domain with no whitespace, commas, angle brackets,
  // quotes or semicolons — so no "a@b.co, evil@x.com" / "<...>" injection.
  if (!/^[^\s,<>"';@]+@[^\s,<>"';@]+\.[^\s,<>"';@]+$/.test(clean)) {
    throw new MailboxError(`Invalid email address — refusing to send (${clean.slice(0, 40)})`);
  }
  return clean;
}

/**
 * RFC 2047 encoded-word for a header value when it contains non-ASCII. Control
 * chars are stripped FIRST (sanitizeHeaderValue) so an injected CRLF can never
 * survive into either the raw or the base64-encoded form.
 */
export function encodeHeaderValue(value: string): string {
  const safe = sanitizeHeaderValue(value);
  // ASCII-only (code points < 128) → no encoding needed.
  if (![...safe].some((ch) => ch.charCodeAt(0) > 127)) return safe;
  return `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

/**
 * "Display Name <addr>" — the address is validated (throws on anything that
 * could inject a header or a second recipient), the name has control chars
 * stripped then RFC 2047-encoded when non-ASCII.
 */
function formatAddress(email: string, name?: string): string {
  const addr = sanitizeEmailAddress(email);
  if (!name) return addr;
  return `${encodeHeaderValue(name)} <${addr}>`;
}

/**
 * Build the raw RFC 2822 MIME message, base64url-encoded for the Gmail API.
 * Pure + exported so tests can assert the headers and encoding without a send.
 * - From: the connected address, display name = the artist's business name
 * - To / Reply-To, Subject (RFC 2047 when non-ASCII)
 * - text/plain; charset=UTF-8, body base64-encoded (safe for any bytes)
 */
export function buildMimeMessage(opts: {
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName?: string;
  replyToEmail: string;
  subject: string;
  body: string;
}): string {
  const headers = [
    `From: ${formatAddress(opts.fromEmail, opts.fromName)}`,
    `To: ${formatAddress(opts.toEmail, opts.toName)}`,
    // Reply-To is a bare address — validated (no CRLF / extra-recipient inject).
    `Reply-To: ${formatAddress(opts.replyToEmail)}`,
    `Subject: ${encodeHeaderValue(opts.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  // CRLF line endings (RFC 2822); body base64 so UTF-8 / long lines are safe.
  const bodyB64 = Buffer.from(opts.body, "utf8").toString("base64");
  const raw = `${headers.join("\r\n")}\r\n\r\n${bodyB64}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

export interface GmailSendResult {
  /** The Gmail message id (VenuePitch.providerMessageId). */
  messageId: string;
}

/**
 * Send a single plain-text email from the tenant's connected Gmail mailbox.
 * From display name = business.name (white-label: venues hear from the artist).
 * Reply-To defaults to the connected address. Returns the Gmail message id.
 * 401 → token dead (mark ERROR, throw reconnect); 403/429 → friendly throw.
 */
export async function sendGmail(
  businessId: string,
  input: GmailSendInput,
  fetchImpl: FetchLike = fetch,
): Promise<GmailSendResult> {
  const conn = await db.mailboxConnection.findUnique({ where: { businessId } });
  if (!conn) throw new MailboxError("No mailbox connected", true);

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  const fromName = business?.name ?? conn.email;

  const accessToken = await getValidAccessToken(businessId, fetchImpl);
  const raw = buildMimeMessage({
    fromEmail: conn.email,
    fromName,
    toEmail: input.toEmail,
    toName: input.toName,
    replyToEmail: input.replyToEmail ?? conn.email,
    subject: input.subject,
    body: input.body,
  });

  const res = await fetchImpl(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (res.status === 401) {
    // Access token dead despite our refresh window — mark ERROR, ask reconnect.
    await db.mailboxConnection.update({
      where: { businessId },
      data: { status: "ERROR", lastError: "Mailbox authorization expired — please reconnect" },
    });
    throw new MailboxError("Your mailbox authorization expired — reconnect to send", true);
  }
  if (res.status === 403) {
    throw new MailboxError("Gmail refused the send (permission or scope) — reconnect your mailbox", true);
  }
  if (res.status === 429) {
    throw new MailboxError("Gmail is rate-limiting sends right now — try again shortly");
  }
  if (!res.ok) {
    throw new MailboxError(`Gmail send failed (${res.status})`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new MailboxError("Gmail send returned no message id");
  return { messageId: data.id };
}
