import { describe, expect, it } from "vitest";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";

// Minimal stand-in for the parts of NextRequest providedSecret() reads.
function req(headers: Record<string, string>, query?: Record<string, string>) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const q = new Map(Object.entries(query ?? {}));
  return {
    headers: { get: (n: string) => h.get(n.toLowerCase()) ?? null },
    nextUrl: { searchParams: { get: (n: string) => q.get(n) ?? null } },
  };
}

describe("providedSecret — prefer headers over the leaky ?secret= query param (B4)", () => {
  it("reads Authorization: Bearer first", () => {
    expect(providedSecret(req({ Authorization: "Bearer s3cret" }, { secret: "fromquery" }))).toBe("s3cret");
  });

  it("is case-insensitive on the Bearer scheme and trims", () => {
    expect(providedSecret(req({ authorization: "bearer  spaced " }))).toBe("spaced");
  });

  it("falls back to x-webhook-secret header", () => {
    expect(providedSecret(req({ "x-webhook-secret": "hv" }, { secret: "q" }))).toBe("hv");
  });

  it("falls back to the legacy ?secret= query param", () => {
    expect(providedSecret(req({}, { secret: "legacy" }))).toBe("legacy");
  });

  it("returns null when nothing is provided", () => {
    expect(providedSecret(req({}))).toBeNull();
  });
});

describe("checkSharedSecret integrates with providedSecret", () => {
  it("accepts a matching header secret and rejects a wrong one", () => {
    expect(checkSharedSecret("expected", providedSecret(req({ Authorization: "Bearer expected" })))).toBe(true);
    expect(checkSharedSecret("expected", providedSecret(req({ Authorization: "Bearer nope" })))).toBe(false);
  });
});
