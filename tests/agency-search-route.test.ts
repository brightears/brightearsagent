import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  rateLimit: vi.fn(),
  searchAgencyWeb: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ currentUser: mocks.currentUser }));
vi.mock("@/lib/rate-limit", () => ({
  clientIp: () => "203.0.113.1",
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/agency/search", () => ({
  searchAgencyWeb: mocks.searchAgencyWeb,
  SearchLimitError: class extends Error {
    constructor(readonly status: number, message: string) { super(message); }
  },
}));
import { POST } from "@/app/api/agency-search/route";
import { SearchLimitError } from "@/lib/agency/search";

const input = { mode: "opportunities", city: "Bangkok", country: "th" };
const output = { results: [], fetchedAt: "2026-09-09T00:00:00.000Z", partial: false, cached: false, mode: "opportunities" };
function user(id = "user_one", status = "verified") {
  return { id, primaryEmailAddressId: "primary", emailAddresses: [{ id: "primary", verification: { status } }] };
}
function request(body: unknown = input, headers: Record<string, string> = {}) {
  return new Request("https://brightears.io/api/agency-search", { method: "POST", headers, body: JSON.stringify(body) });
}
function streamedRequest(chunks: string[], headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const cancel = vi.fn();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++]));
      else controller.close();
    },
    cancel,
  }, { highWaterMark: 0 });
  return {
    request: new Request("https://brightears.io/api/agency-search", {
      method: "POST", body, headers, duplex: "half",
    } as RequestInit & { duplex: "half" }),
    cancel,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture");
  mocks.currentUser.mockResolvedValue(user());
  mocks.rateLimit.mockReturnValue({ ok: true, retryAfterSec: 0 });
  mocks.searchAgencyWeb.mockResolvedValue(output);
});
afterEach(() => vi.unstubAllEnvs());

describe("search route access and input boundaries", () => {
  it.each(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"])("fails closed without %s", async key => {
    vi.stubEnv(key, "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.currentUser).not.toHaveBeenCalled();
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("requires a signed-in user", async () => {
    mocks.currentUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it.each(["unverified", "failed"])("rejects a %s primary email even with a verified secondary email", async status => {
    const account = user("user_one", status);
    account.emailAddresses.push({ id: "secondary", verification: { status: "verified" } });
    mocks.currentUser.mockResolvedValue(account);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("rejects a missing primary email", async () => {
    mocks.currentUser.mockResolvedValue({ ...user(), primaryEmailAddressId: "missing" });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("uses the authenticated Clerk identity and parsed defaults", async () => {
    const response = await POST(request({ ...input, city: "  Bangkok  " }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(output);
    expect(mocks.searchAgencyWeb).toHaveBeenCalledExactlyOnceWith({ ...input, city: "Bangkok", language: "en" }, "user_one");
  });
  it("rejects oversized Content-Length before reading a body", async () => {
    const req = request(input, { "Content-Length": "2049" });
    expect((await POST(req)).status).toBe(400);
    expect(req.bodyUsed).toBe(false);
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it.each([{}, { "Content-Length": "1" }] as Record<string, string>[])("cancels an oversized streamed body with headers %j", async headers => {
    const streamed = streamedRequest([" ".repeat(2048), " ", "unread"], headers);
    expect((await POST(streamed.request)).status).toBe(400);
    expect(streamed.cancel).toHaveBeenCalledOnce();
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("enforces byte length when Unicode characters cross chunks", async () => {
    const streamed = streamedRequest(["ก".repeat(400), "ก".repeat(400), "unread"]);
    expect((await POST(streamed.request)).status).toBe(400);
    expect(streamed.cancel).toHaveBeenCalledOnce();
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("accepts a valid body exactly at the byte limit", async () => {
    const text = JSON.stringify(input);
    const streamed = streamedRequest([text, " ".repeat(2048 - new TextEncoder().encode(text).length)]);
    expect((await POST(streamed.request)).status).toBe(200);
    expect(mocks.searchAgencyWeb).toHaveBeenCalledOnce();
  });
  it.each([
    { ...input, userId: "another_user" },
    { ...input, city: 'Bangkok" OR site:example.com' },
    { ...input, mode: "email" },
    { ...input, country: "unknown" },
    null,
  ])("rejects invalid input before paid search: %j", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON before search", async () => {
    const streamed = streamedRequest(["{"]);
    expect((await POST(streamed.request)).status).toBe(400);
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("applies an IP burst limit before invoking Clerk", async () => {
    mocks.rateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 17 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(mocks.currentUser).not.toHaveBeenCalled();
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it("applies the user burst limit before paid search", async () => {
    mocks.rateLimit.mockReturnValueOnce({ ok: true }).mockReturnValueOnce({ ok: false, retryAfterSec: 11 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("11");
    expect(mocks.searchAgencyWeb).not.toHaveBeenCalled();
  });
  it.each([409, 429, 503])("preserves a search service refusal with status %i", async status => {
    mocks.searchAgencyWeb.mockRejectedValue(new SearchLimitError(status, "Public refusal"));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "Public refusal" });
  });
  it("does not expose internal provider or database errors", async () => {
    mocks.searchAgencyWeb.mockRejectedValue(new Error("PRIVATE_INTERNAL_DETAIL"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_INTERNAL_DETAIL");
  });
});

describe("one search in flight per user", () => {
  it("blocks a second search for the same user while allowing another user and releases after success", async () => {
    let resolveFirst!: (value: typeof output) => void;
    mocks.searchAgencyWeb.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    const first = POST(request());
    await vi.waitFor(() => expect(mocks.searchAgencyWeb).toHaveBeenCalledOnce());
    try {
      expect((await POST(request({ ...input, city: "Phuket" }))).status).toBe(409);
      expect(mocks.searchAgencyWeb).toHaveBeenCalledOnce();
      mocks.currentUser.mockResolvedValueOnce(user("user_two"));
      expect((await POST(request({ ...input, city: "Singapore", country: "sg" }))).status).toBe(200);
    } finally {
      resolveFirst(output);
      await first;
    }
    expect((await POST(request())).status).toBe(200);
  });
  it("releases the in-flight gate after a rejected search", async () => {
    mocks.searchAgencyWeb.mockRejectedValueOnce(new Error("Provider unavailable"));
    expect((await POST(request())).status).toBe(503);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.searchAgencyWeb).toHaveBeenCalledTimes(2);
  });
});
