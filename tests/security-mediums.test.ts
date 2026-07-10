import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { clientIp } from "@/lib/rate-limit";
import { isBlockedHost, resolvesToBlockedIp } from "@/lib/pdf/images";
import { checkSharedSecret } from "@/lib/auth-secret";

// P14 security mediums — the pre-cutover hardening batch.

describe("clientIp takes the right-most XFF hop (14.3)", () => {
  const req = (xff: string | null) => ({ headers: { get: () => xff } });
  it("a spoofed left-most entry never wins", () => {
    expect(clientIp(req("6.6.6.6, 203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(req("a, b, 198.51.100.4"))).toBe("198.51.100.4");
  });
  it("single hop and missing header behave", () => {
    expect(clientIp(req("203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(req(null))).toBe("unknown");
  });
});

describe("SSRF guard resolves DNS (14.4)", () => {
  it("a public-looking name resolving to a private IP is blocked", async () => {
    const evil = async () => [{ address: "169.254.169.254" }];
    expect(await resolvesToBlockedIp("innocent.example", evil)).toBe(true);
    const fine = async () => [{ address: "93.184.216.34" }];
    expect(await resolvesToBlockedIp("innocent.example", fine)).toBe(false);
  });
  it("mixed records block if ANY address is private; unresolvable blocks", async () => {
    const mixed = async () => [{ address: "93.184.216.34" }, { address: "10.0.0.5" }];
    expect(await resolvesToBlockedIp("mixed.example", mixed)).toBe(true);
    const boom = async () => {
      throw new Error("ENOTFOUND");
    };
    expect(await resolvesToBlockedIp("ghost.example", boom)).toBe(true);
  });
  it("IPv4-mapped IPv6 can't hide a private address", () => {
    expect(isBlockedHost("::ffff:10.0.0.1")).toBe(true);
    expect(isBlockedHost("::ffff:93.184.216.34")).toBe(false);
  });
});

describe("fail-closed independent of NODE_ENV (14.5)", () => {
  const savedAppUrl = process.env.APP_URL;
  beforeEach(() => vi.unstubAllEnvs?.());
  afterEach(() => {
    if (savedAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = savedAppUrl;
  });

  it("an unset secret is DENIED whenever a public https origin is configured", () => {
    process.env.APP_URL = "https://brightears-app.onrender.com";
    expect(checkSharedSecret(undefined, "anything")).toBe(false);
    expect(checkSharedSecret(undefined, null)).toBe(false);
  });

  it("pure local dev (no public origin) still allows unset secrets", () => {
    delete process.env.APP_URL;
    // NODE_ENV under vitest is "test", not production.
    expect(checkSharedSecret(undefined, null)).toBe(true);
  });

  it("a set secret still requires an exact match either way", () => {
    process.env.APP_URL = "https://brightears-app.onrender.com";
    expect(checkSharedSecret("s3cret", "s3cret")).toBe(true);
    expect(checkSharedSecret("s3cret", "wrong!")).toBe(false);
  });
});
