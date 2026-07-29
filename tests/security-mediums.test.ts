import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { clientIp } from "@/lib/rate-limit";
import { isBlockedHost, resolvesToBlockedIp } from "@/lib/pdf/images";
import { checkSharedSecret } from "@/lib/auth-secret";

// P14 security mediums — the pre-cutover hardening batch.

// This invariant has been wrong twice, in opposite directions, both silently.
// Left-most XFF (the original) let anyone spoof and evade every limit.
// Right-most (14.3, the fix for that) resolved to Cloudflare's shared edge in
// production, collapsing every per-IP bucket into ONE global bucket — the
// homepage demo capped at 5 uses per day for the entire internet. Real shape,
// measured live 2026-07-29:
//   x-forwarded-for:  27.130.34.170, 172.68.232.160   (172.68.x = Cloudflare)
//   cf-connecting-ip: 27.130.34.170                   (the actual visitor)
describe("clientIp", () => {
  const req = (headers: Record<string, string | null>) => ({
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  });

  it("uses cf-connecting-ip — the real production shape", () => {
    expect(
      clientIp(req({ "x-forwarded-for": "27.130.34.170, 172.68.232.160", "cf-connecting-ip": "27.130.34.170" })),
    ).toBe("27.130.34.170");
  });

  it("keeps two visitors behind the same Cloudflare node in different buckets", () => {
    const edge = "172.68.232.160";
    const a = clientIp(req({ "x-forwarded-for": `27.130.34.170, ${edge}`, "cf-connecting-ip": "27.130.34.170" }));
    const b = clientIp(req({ "x-forwarded-for": `81.2.69.142, ${edge}`, "cf-connecting-ip": "81.2.69.142" }));
    expect(a).not.toBe(b);
  });

  it("a forged x-forwarded-for cannot override the trusted value", () => {
    expect(
      clientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 172.68.232.160", "cf-connecting-ip": "27.130.34.170" })),
    ).toBe("27.130.34.170");
  });

  it("accepts true-client-ip, the same value under Cloudflare's enterprise name", () => {
    expect(clientIp(req({ "true-client-ip": "27.130.34.170", "x-forwarded-for": "9.9.9.9, 172.68.1.1" }))).toBe(
      "27.130.34.170",
    );
  });

  it("without Cloudflare, reads the hop the trusted proxy saw — never the spoofable left-most", () => {
    expect(clientIp(req({ "x-forwarded-for": "fake, 203.0.113.9, 172.68.1.1" }))).toBe("203.0.113.9");
  });

  it("single hop and missing header behave", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-forwarded-for": "" }))).toBe("unknown");
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
