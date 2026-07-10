import { beforeEach, describe, expect, it, vi } from "vitest";

// The EPK availability form (P12.5): submissions become synthetic form
// notifications into the tenant's OWN inbound pipeline — system sender +
// labeled fields (the exact shape the fallback classifies WEBSITE_FORM).

const mockProcess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inbound/pipeline", () => ({ processInbound: mockProcess }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn(async () => {}) }));
// Server-action headers() (14.2 rate limit reads the client IP). Unique IP
// per test run keeps the in-process limiter from cross-test interference.
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) =>
      name.toLowerCase() === "x-forwarded-for" ? `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` : null,
  }),
}));

import { submitEpkInquiry } from "@/app/actions/epk";

const fd = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockProcess.mockResolvedValue({ outcome: "lead_created", leadId: "l1", status: "NEW" });
});

describe("submitEpkInquiry", () => {
  it("feeds the tenant's own pipeline as a labeled form notification", async () => {
    const r = await submitEpkInquiry(
      "sapphire-sounds",
      null,
      fd({
        name: "Jess Park",
        email: "jess@example.com",
        eventType: "wedding",
        eventDate: "2026-09-14",
        message: "Evening reception, ~120 guests.",
      }),
    );
    expect(r).toEqual({ ok: true });
    const email = mockProcess.mock.calls[0][0];
    expect(email.to).toBe("leads@sapphire-sounds.in.brightears.io");
    // System sender = the fallback parser's WEBSITE_FORM classification.
    expect(email.from).toContain("notification@");
    expect(email.textBody).toContain("Name: Jess Park");
    expect(email.textBody).toContain("Email: jess@example.com");
    expect(email.textBody).toContain("Event date: 2026-09-14");
  });

  it("honeypot submissions get a fake success and never touch the pipeline", async () => {
    const r = await submitEpkInquiry(
      "sapphire-sounds",
      null,
      fd({ name: "Bot", email: "bot@spam.example", message: "hi", website: "http://spam" }),
    );
    expect(r).toEqual({ ok: true });
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("validates name, email shape, and some event substance", async () => {
    expect((await submitEpkInquiry("s", null, fd({ email: "a@b.co", message: "x" })))?.ok).toBe(false);
    expect((await submitEpkInquiry("s", null, fd({ name: "A", email: "nope", message: "x" })))?.ok).toBe(false);
    expect((await submitEpkInquiry("s", null, fd({ name: "A", email: "a@b.co" })))?.ok).toBe(false);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it("an unknown slug reports failure without leaking internals", async () => {
    mockProcess.mockResolvedValue({ outcome: "no_tenant" });
    const r = await submitEpkInquiry(
      "ghost",
      null,
      fd({ name: "A", email: "a@b.co", message: "hello there" }),
    );
    expect(r?.ok).toBe(false);
  });
});
