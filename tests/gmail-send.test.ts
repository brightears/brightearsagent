import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Phase 10.5 — Gmail transport (token refresh-when-expired, send + error
// mapping) and the Google OAuth exchange/refresh helpers. DB is mocked the way
// the other action tests mock it; fetch is INJECTED (the modules take a
// fetchImpl seam) so no real network call is ever made.

const KEY = "a59e61e66ab19532710142e1fb0ecfd45e822732cb38b6aa92d3170fe12b93c4";

const mockDb = vi.hoisted(() => ({
  mailboxConnection: { findUnique: vi.fn(), update: vi.fn() },
  business: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { encryptToken } from "@/lib/crypto/tokens";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TOKEN_ENCRYPTION_KEY = KEY;
  process.env.GOOGLE_OAUTH_CLIENT_ID = "client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret";
});
afterEach(() => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
});

describe("getValidAccessToken — refresh-when-expiring", () => {
  it("returns the stored token when it's well within its lifetime (no refresh call)", async () => {
    const { getValidAccessToken } = await import("@/lib/outbound/gmail");
    mockDb.mailboxConnection.findUnique.mockResolvedValue({
      status: "CONNECTED",
      accessTokenEnc: encryptToken("live-access"),
      refreshTokenEnc: encryptToken("refresh"),
      expiresAt: new Date(Date.now() + 10 * 60_000), // 10 min out
    });
    const fetchSpy = vi.fn();
    const token = await getValidAccessToken("biz1", fetchSpy as unknown as typeof fetch);
    expect(token).toBe("live-access");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes and persists when the token expires within 60s", async () => {
    const { getValidAccessToken } = await import("@/lib/outbound/gmail");
    mockDb.mailboxConnection.findUnique.mockResolvedValue({
      status: "CONNECTED",
      accessTokenEnc: encryptToken("stale-access"),
      refreshTokenEnc: encryptToken("the-refresh-token"),
      expiresAt: new Date(Date.now() + 30_000), // 30s — inside the skew
    });
    mockDb.mailboxConnection.update.mockResolvedValue({});
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "fresh-access", expires_in: 3600 }),
    );
    const token = await getValidAccessToken("biz1", fetchImpl as unknown as typeof fetch);
    expect(token).toBe("fresh-access");
    // Refreshed token persisted (encrypted — never the plaintext).
    const update = mockDb.mailboxConnection.update.mock.calls[0][0];
    expect(update.where).toEqual({ businessId: "biz1" });
    expect(update.data.status).toBe("CONNECTED");
    expect(update.data.accessTokenEnc).not.toBe("fresh-access");
  });

  it("marks the mailbox ERROR and throws reconnect when refresh fails", async () => {
    const { getValidAccessToken, MailboxError } = await import("@/lib/outbound/gmail");
    mockDb.mailboxConnection.findUnique.mockResolvedValue({
      status: "CONNECTED",
      accessTokenEnc: encryptToken("stale"),
      refreshTokenEnc: encryptToken("dead-refresh"),
      expiresAt: new Date(Date.now() - 1000), // already expired
    });
    mockDb.mailboxConnection.update.mockResolvedValue({});
    const fetchImpl = vi.fn(async () => jsonResponse(400, { error: "invalid_grant" }));
    await expect(
      getValidAccessToken("biz1", fetchImpl as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(MailboxError);
    expect(mockDb.mailboxConnection.update.mock.calls[0][0].data.status).toBe("ERROR");
  });

  it("throws reconnect when no mailbox is connected", async () => {
    const { getValidAccessToken, MailboxError } = await import("@/lib/outbound/gmail");
    mockDb.mailboxConnection.findUnique.mockResolvedValue(null);
    await expect(getValidAccessToken("biz1")).rejects.toBeInstanceOf(MailboxError);
  });
});

describe("sendGmail — send + error mapping", () => {
  function connectedMailbox() {
    mockDb.mailboxConnection.findUnique.mockResolvedValue({
      email: "maya@gmail.com",
      status: "CONNECTED",
      accessTokenEnc: encryptToken("live-access"),
      refreshTokenEnc: encryptToken("refresh"),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    mockDb.business.findUnique.mockResolvedValue({ name: "Sapphire Sounds" });
  }

  it("posts the MIME message and returns the Gmail message id", async () => {
    const { sendGmail } = await import("@/lib/outbound/gmail");
    connectedMailbox();
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        jsonResponse(200, { id: "gmail-msg-123" }),
    );
    const result = await sendGmail(
      "biz1",
      { toEmail: "events@velvet.co", subject: "Intro", body: "hi" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.messageId).toBe("gmail-msg-123");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/gmail/v1/users/me/messages/send");
    expect(init!.headers).toMatchObject({ authorization: "Bearer live-access" });
    // The From display name is the business name (white-label).
    const sentRaw = JSON.parse(init!.body as string).raw;
    const decoded = Buffer.from(sentRaw, "base64url").toString("utf8");
    expect(decoded).toContain("From: Sapphire Sounds <maya@gmail.com>");
  });

  it("401 → marks ERROR and throws a reconnect MailboxError", async () => {
    const { sendGmail, MailboxError } = await import("@/lib/outbound/gmail");
    connectedMailbox();
    mockDb.mailboxConnection.update.mockResolvedValue({});
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: "unauthorized" }));
    await expect(
      sendGmail("biz1", { toEmail: "x@y.co", subject: "s", body: "b" }, fetchImpl as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(MailboxError);
    expect(mockDb.mailboxConnection.update.mock.calls[0][0].data.status).toBe("ERROR");
  });

  it("429 → friendly rate-limit error (no ERROR flag)", async () => {
    const { sendGmail } = await import("@/lib/outbound/gmail");
    connectedMailbox();
    const fetchImpl = vi.fn(async () => jsonResponse(429, {}));
    await expect(
      sendGmail("biz1", { toEmail: "x@y.co", subject: "s", body: "b" }, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/rate-limit/i);
    expect(mockDb.mailboxConnection.update).not.toHaveBeenCalled();
  });
});

describe("lib/oauth/google — exchange + refresh", () => {
  it("exchangeCode returns tokens + the connected email, requires a refresh token", async () => {
    const { exchangeCode } = await import("@/lib/oauth/google");
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/token")) {
        return jsonResponse(200, {
          access_token: "acc",
          refresh_token: "ref",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/gmail.send openid email",
        });
      }
      return jsonResponse(200, { email: "Maya@Gmail.com" });
    });
    const tokens = await exchangeCode("the-code", fetchImpl as unknown as typeof fetch);
    expect(tokens.access).toBe("acc");
    expect(tokens.refresh).toBe("ref");
    expect(tokens.email).toBe("maya@gmail.com"); // lowercased
    expect(tokens.scope).toContain("gmail.send");
  });

  it("exchangeCode throws when Google omits the refresh token", async () => {
    const { exchangeCode } = await import("@/lib/oauth/google");
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "acc", expires_in: 3600 }),
    );
    await expect(
      exchangeCode("code", fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/refresh token/i);
  });

  it("refreshAccessToken returns a fresh access token + expiry", async () => {
    const { refreshAccessToken } = await import("@/lib/oauth/google");
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "new-acc", expires_in: 3600 }),
    );
    const out = await refreshAccessToken("ref", fetchImpl as unknown as typeof fetch);
    expect(out.access).toBe("new-acc");
    expect(out.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("isConfigured reflects both env vars", async () => {
    const { isConfigured } = await import("@/lib/oauth/google");
    expect(isConfigured()).toBe(true);
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    expect(isConfigured()).toBe(false);
  });

  it("buildAuthUrl requests offline access, consent prompt, and gmail.send only", async () => {
    const { buildAuthUrl, GMAIL_SEND_SCOPE } = await import("@/lib/oauth/google");
    const url = new URL(buildAuthUrl("state-token"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-token");
    const scope = url.searchParams.get("scope") ?? "";
    expect(scope).toContain(GMAIL_SEND_SCOPE);
    expect(scope).not.toContain("gmail.readonly");
    expect(scope).not.toContain("gmail.modify");
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/api\/oauth\/google\/callback$/);
  });
});
