import { beforeEach, describe, expect, it, vi } from "vitest";

// EPK freshness (P12.6): only hard 404/410 or a dead host is BROKEN — bot
// walls (403/429) and slow hosts must never train the owner to ignore nags.

const mockDb = vi.hoisted(() => ({ business: { findMany: vi.fn() } }));
const mockNotify = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/notify", () => ({ notifyBusiness: mockNotify }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn(async () => {}) }));

import { checkEpkFreshness, checkUrl, runEpkFreshnessSweep } from "@/lib/epk/freshness";

const res = (status: number) => ({ status }) as Response;

describe("checkUrl", () => {
  it("404/410 are broken; 200/403/500 are not", async () => {
    expect((await checkUrl("https://x.example/a", vi.fn(async () => res(404)) as never)).broken).toBe(true);
    expect((await checkUrl("https://x.example/b", vi.fn(async () => res(410)) as never)).broken).toBe(true);
    expect((await checkUrl("https://x.example/c", vi.fn(async () => res(200)) as never)).broken).toBe(false);
    expect((await checkUrl("https://x.example/d", vi.fn(async () => res(403)) as never)).broken).toBe(false);
    expect((await checkUrl("https://x.example/e", vi.fn(async () => res(500)) as never)).broken).toBe(false);
  });

  it("retries HEAD-refusing hosts as GET before judging", async () => {
    const fetchFn = vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "HEAD" ? res(405) : res(404),
    );
    expect((await checkUrl("https://x.example/f", fetchFn as never)).broken).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("timeouts are unknown (not broken); dead DNS is broken", async () => {
    const timeoutFn = vi.fn(async () => {
      throw new Error("aborted");
    });
    expect((await checkUrl("https://slow.example", timeoutFn as never)).broken).toBe(false);
    const dnsFn = vi.fn(async () => {
      throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
    });
    expect((await checkUrl("https://gone.example", dnsFn as never)).broken).toBe(true);
  });
});

describe("checkEpkFreshness + sweep", () => {
  const biz = {
    id: "biz1",
    videoLinks: ["https://youtu.be/abc123def45"],
    photoUrls: ["https://cdn.example/dead.jpg"],
    websiteUrl: "https://site.example",
    bookingLinkUrl: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.business.findMany.mockResolvedValue([biz]);
  });

  it("flags missing video when no link is embeddable", async () => {
    const ok = vi.fn(async () => res(200));
    const r = await checkEpkFreshness({ ...biz, videoLinks: ["https://example.com/notavideo"] }, ok as never);
    expect(r.missingVideo).toBe(true);
    const r2 = await checkEpkFreshness(biz, ok as never);
    expect(r2.missingVideo).toBe(false);
  });

  it("the sweep nags only tenants with real problems", async () => {
    const fetchFn = vi.fn(async (u: string) => (u.includes("dead.jpg") ? res(404) : res(200)));
    const r = await runEpkFreshnessSweep(fetchFn as never);
    expect(r).toEqual({ checked: 1, nagged: 1 });
    const notifyArgs = mockNotify.mock.calls[0] as unknown as [unknown, { emailBody: string }];
    expect(notifyArgs[1].emailBody).toContain("dead.jpg");
    // Clean tenant → silence.
    vi.clearAllMocks();
    mockDb.business.findMany.mockResolvedValue([biz]);
    const clean = vi.fn(async () => res(200));
    const r2 = await runEpkFreshnessSweep(clean as never);
    expect(r2).toEqual({ checked: 1, nagged: 0 });
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
