import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// (Phase 10.5 hardening — FIX 3) Config-guard graceful degradation. When OAuth
// IS configured but the token-encryption key is missing/malformed, createState
// (HMAC on the key) and encryptToken throw — the routes must redirect to
// settings with a DISTINCT "?reason=config" error, NOT surface a raw 500 and
// NOT reuse the "?mailbox=unavailable" feature-off wording. The DB and tenant
// are mocked the way the other route tests mock them.

const mockDb = vi.hoisted(() => ({
  mailboxConnection: { upsert: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

const getCurrentBusiness = vi.hoisted(() => vi.fn(async () => ({ id: "biz1" })));
vi.mock("@/lib/tenant", () => ({ getCurrentBusiness }));

import { GET as startGET } from "@/app/api/oauth/google/start/route";

const VALID_KEY = "a59e61e66ab19532710142e1fb0ecfd45e822732cb38b6aa92d3170fe12b93c4";

function location(res: Response): URL {
  return new URL(res.headers.get("location")!);
}

beforeEach(() => {
  vi.clearAllMocks();
  // OAuth client IS present...
  process.env.GOOGLE_OAUTH_CLIENT_ID = "client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret";
  // ...but the crypto key is the variable under test (set per-case).
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

afterEach(() => {
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

describe("GET /api/oauth/google/start — crypto-config guard", () => {
  it("redirects to settings ?mailbox=error&reason=config when the key is MISSING (no 500)", async () => {
    const res = await startGET(new Request("http://localhost/api/oauth/google/start"));
    expect(res.status).toBe(307); // redirect, never a thrown 500
    const url = location(res);
    expect(url.pathname).toBe("/dashboard/settings");
    expect(url.searchParams.get("mailbox")).toBe("error");
    expect(url.searchParams.get("reason")).toBe("config");
    // Distinct from the "feature off" wording.
    expect(url.searchParams.get("mailbox")).not.toBe("unavailable");
    // No state cookie was set (we bailed before minting state).
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("redirects to ?reason=config when the key is MALFORMED (wrong length)", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "deadbeef"; // not 64 hex chars
    const res = await startGET(new Request("http://localhost/api/oauth/google/start"));
    const url = location(res);
    expect(url.searchParams.get("reason")).toBe("config");
  });

  it("proceeds to Google when BOTH OAuth and crypto are configured", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
    const res = await startGET(new Request("http://localhost/api/oauth/google/start"));
    expect(res.status).toBe(307);
    // Now it 302s to Google's consent screen, with the state cookie set.
    expect(location(res).origin).toContain("accounts.google.com");
    expect(res.headers.get("set-cookie")).toContain("be_oauth_state=");
  });

  it("redirects ?mailbox=unavailable (NOT config) when OAuth itself is absent", async () => {
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = VALID_KEY;
    const res = await startGET(new Request("http://localhost/api/oauth/google/start"));
    const url = location(res);
    expect(url.searchParams.get("mailbox")).toBe("unavailable");
    expect(url.searchParams.get("reason")).toBeNull();
  });
});

describe("GET /api/oauth/google/callback — crypto-config guard", () => {
  it("redirects to ?reason=config when the key is missing (no 500, before any token work)", async () => {
    const { GET: callbackGET } = await import("@/app/api/oauth/google/callback/route");
    const res = await callbackGET(
      new Request("http://localhost/api/oauth/google/callback?code=abc&state=xyz"),
    );
    expect(res.status).toBe(307);
    const url = location(res);
    expect(url.pathname).toBe("/dashboard/settings");
    expect(url.searchParams.get("mailbox")).toBe("error");
    expect(url.searchParams.get("reason")).toBe("config");
    // We never reached the DB upsert.
    expect(mockDb.mailboxConnection.upsert).not.toHaveBeenCalled();
  });
});
