import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Phase 10.5 — token encryption (AES-256-GCM) + OAuth CSRF state signing +
// MIME building. Pure modules: no DB, no network. The key is set per-test so
// absence/wrong-length paths are exercised.

const KEY = "a59e61e66ab19532710142e1fb0ecfd45e822732cb38b6aa92d3170fe12b93c4";

describe("lib/crypto/tokens — AES-256-GCM round-trip + tamper", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips a token (encrypt → decrypt = original)", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto/tokens");
    const secret = "ya29.A0ARrdaM-fake-access-token-value";
    const enc = encryptToken(secret);
    expect(enc).not.toContain(secret); // never plaintext
    expect(decryptToken(enc)).toBe(secret);
  });

  it("uses a fresh IV — same plaintext encrypts to different ciphertext", async () => {
    const { encryptToken } = await import("@/lib/crypto/tokens");
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("round-trips UTF-8 / refresh-token shapes", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto/tokens");
    const refresh = "1//09fü-refresh-tök€n-✓";
    expect(decryptToken(encryptToken(refresh))).toBe(refresh);
  });

  it("detects tampering — a flipped ciphertext byte throws on the GCM tag", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto/tokens");
    const enc = encryptToken("authentic");
    const raw = Buffer.from(enc, "base64");
    raw[raw.length - 1] ^= 0x01; // flip a ciphertext byte
    const tampered = raw.toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("detects a truncated payload", async () => {
    const { decryptToken } = await import("@/lib/crypto/tokens");
    expect(() => decryptToken(Buffer.from([1, 2, 3]).toString("base64"))).toThrow(
      /too short/i,
    );
  });

  it("throws clearly when the key is absent", async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const { encryptToken } = await import("@/lib/crypto/tokens");
    expect(() => encryptToken("x")).toThrow(/TOKEN_ENCRYPTION_KEY is not set/);
  });

  it("throws clearly when the key is the wrong length", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "deadbeef"; // 8 hex, not 64
    const { encryptToken } = await import("@/lib/crypto/tokens");
    expect(() => encryptToken("x")).toThrow(/64 hex chars/);
  });

  it("isTokenCryptoConfigured reflects key presence (no throw)", async () => {
    const { isTokenCryptoConfigured } = await import("@/lib/crypto/tokens");
    expect(isTokenCryptoConfigured()).toBe(true);
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(isTokenCryptoConfigured()).toBe(false);
  });

  it("a wrong key cannot decrypt another key's ciphertext", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto/tokens");
    const enc = encryptToken("locked");
    process.env.TOKEN_ENCRYPTION_KEY =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(() => decryptToken(enc)).toThrow();
  });
});

describe("lib/oauth/state — CSRF state sign + verify", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("verifies a freshly minted state and recovers the businessId", async () => {
    const { createState, verifyState } = await import("@/lib/oauth/state");
    const state = createState("biz1");
    expect(verifyState(state)).toBe("biz1");
    expect(verifyState(state, "biz1")).toBe("biz1");
  });

  it("rejects a state bound to a different tenant", async () => {
    const { createState, verifyState } = await import("@/lib/oauth/state");
    const state = createState("biz1");
    expect(verifyState(state, "biz2")).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const { createState, verifyState } = await import("@/lib/oauth/state");
    const state = createState("biz1");
    const tampered = state.slice(0, -2) + (state.endsWith("aa") ? "bb" : "aa");
    expect(verifyState(tampered)).toBeNull();
  });

  it("rejects a forged businessId (signature won't match)", async () => {
    const { createState, verifyState } = await import("@/lib/oauth/state");
    const [, nonce, sig] = createState("biz1").split(".");
    const forged = `attacker.${nonce}.${sig}`;
    expect(verifyState(forged)).toBeNull();
  });

  it("rejects malformed shapes", async () => {
    const { verifyState } = await import("@/lib/oauth/state");
    expect(verifyState("nope")).toBeNull();
    expect(verifyState("a.b")).toBeNull();
    expect(verifyState("")).toBeNull();
  });
});

describe("lib/outbound/gmail — MIME building", () => {
  it("builds RFC 2822 headers with the artist's name on From", async () => {
    const { buildMimeMessage } = await import("@/lib/outbound/gmail");
    const raw = buildMimeMessage({
      fromEmail: "maya@gmail.com",
      fromName: "Sapphire Sounds",
      toEmail: "events@velvet.co",
      toName: "Velvet Lounge",
      replyToEmail: "maya@gmail.com",
      subject: "Intro for your rotation",
      body: "Hi there",
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("From: Sapphire Sounds <maya@gmail.com>");
    expect(decoded).toContain("To: Velvet Lounge <events@velvet.co>");
    expect(decoded).toContain("Reply-To: maya@gmail.com");
    expect(decoded).toContain("Content-Type: text/plain; charset=UTF-8");
  });

  it("is base64url (gmail API raw) — no +, /, or = padding", async () => {
    const { buildMimeMessage } = await import("@/lib/outbound/gmail");
    const raw = buildMimeMessage({
      fromEmail: "a@b.co",
      fromName: "Name",
      toEmail: "c@d.co",
      replyToEmail: "a@b.co",
      subject: "Subject line here for length",
      body: "Body with several words to push past padding boundaries.",
    });
    expect(raw).not.toMatch(/[+/=]/);
  });

  it("RFC 2047-encodes a non-ASCII subject", async () => {
    const { buildMimeMessage, encodeHeaderValue } = await import("@/lib/outbound/gmail");
    expect(encodeHeaderValue("Grüße fürs Wochenende")).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(encodeHeaderValue("plain ascii")).toBe("plain ascii");
    const raw = buildMimeMessage({
      fromEmail: "a@b.co",
      fromName: "Café Sound",
      toEmail: "c@d.co",
      replyToEmail: "a@b.co",
      subject: "Spielst du fürs Frühlingsfest?",
      body: "x",
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("Subject: =?UTF-8?B?");
    expect(decoded).toContain("From: =?UTF-8?B?"); // non-ASCII display name encoded
  });

  it("base64-encodes the body and preserves UTF-8 round-trip", async () => {
    const { buildMimeMessage } = await import("@/lib/outbound/gmail");
    const body = "Schöne Grüße — ✓ keep me on file";
    const raw = buildMimeMessage({
      fromEmail: "a@b.co",
      fromName: "N",
      toEmail: "c@d.co",
      replyToEmail: "a@b.co",
      subject: "s",
      body,
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [, b64Body] = decoded.split("\r\n\r\n");
    expect(Buffer.from(b64Body, "base64").toString("utf8")).toBe(body);
  });
});
