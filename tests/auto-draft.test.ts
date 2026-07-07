import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  venue: { findMany: vi.fn() },
}));
const mockDraft = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/venues/draft-pitch", () => ({ draftPitchForVenue: mockDraft }));

import { autoDraftPitches } from "@/lib/venues/auto-draft";
import type { Business } from "@/app/generated/prisma/client";

// Only plan matters to the paused gate; draftPitchForVenue (mocked) owns the rest.
const biz = (plan = "PRO") => ({ id: "biz1", plan }) as unknown as Business;

// bookings@ = high contact confidence (P10.5) so existing cases pass the gate.
const v = (
  id: string,
  temperature: "HOT" | "WARM" | "SEED",
  bookingEmail = "bookings@venue.example",
  bookingContactName: string | null = null,
) => ({ id, temperature, bookingEmail, bookingContactName });

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.venue.findMany.mockResolvedValue([]);
});

describe("autoDraftPitches (P8.1 — the agent acts, draft-only)", () => {
  it("never runs for an unsubscribed tenant — no queries, no LLM spend", async () => {
    const r = await autoDraftPitches(biz("TRIAL"));
    expect(r).toEqual({ attempted: 0, created: 0, stoppedBy: "paused" });
    expect(mockDb.venue.findMany).not.toHaveBeenCalled();
    expect(mockDraft).not.toHaveBeenCalled();
  });

  it("skips low-confidence contacts (generic info@) unless a named person is attached (P10.5)", async () => {
    mockDb.venue.findMany.mockResolvedValue([
      v("generic", "HOT", "info@venue.example"), // low -> skipped, no LLM spend
      v("named", "HOT", "info@venue.example", "Dana Ko"), // named person -> high
      v("booking", "WARM", "events@venue.example"), // booking-specific -> high
    ]);
    mockDraft.mockResolvedValue({ ok: true, created: true });
    const r = await autoDraftPitches(biz());
    expect(mockDraft.mock.calls.map((c) => c[1])).toEqual(["named", "booking"]);
    expect(r).toEqual({ attempted: 2, created: 2, stoppedBy: null });
  });

  it("drafts best-first and counts what was actually created", async () => {
    mockDb.venue.findMany.mockResolvedValue([v("a", "HOT"), v("b", "HOT"), v("c", "WARM")]);
    mockDraft
      .mockResolvedValueOnce({ ok: true, created: true })
      .mockResolvedValueOnce({ ok: true, created: false }) // deduped no-op
      .mockResolvedValueOnce({ ok: true, created: true });
    const r = await autoDraftPitches(biz());
    expect(r).toEqual({ attempted: 3, created: 2, stoppedBy: null });
  });

  it("a temperature hitting its cap stops THAT temperature; others continue", async () => {
    mockDb.venue.findMany.mockResolvedValue([
      v("h1", "HOT"),
      v("h2", "HOT"),
      v("h3", "HOT"),
      v("w1", "WARM"),
    ]);
    mockDraft
      .mockResolvedValueOnce({ ok: true, created: true }) // h1
      .mockResolvedValueOnce({ ok: false, error: "cap", reason: "cap" }) // h2 → HOT capped
      .mockResolvedValueOnce({ ok: true, created: true }); // w1 (h3 skipped without a call)
    const r = await autoDraftPitches(biz());
    expect(mockDraft).toHaveBeenCalledTimes(3);
    expect(mockDraft.mock.calls.map((c) => c[1])).toEqual(["h1", "h2", "w1"]);
    expect(r.created).toBe(2);
  });

  it("a tenant-level stop (license) aborts the whole run", async () => {
    mockDb.venue.findMany.mockResolvedValue([v("a", "HOT"), v("b", "WARM")]);
    mockDraft.mockResolvedValueOnce({ ok: false, error: "license", reason: "license" });
    const r = await autoDraftPitches(biz());
    expect(mockDraft).toHaveBeenCalledTimes(1);
    expect(r.stoppedBy).toBe("license");
  });

  it("transient LLM failures skip the venue but keep the run alive", async () => {
    mockDb.venue.findMany.mockResolvedValue([v("a", "HOT"), v("b", "HOT")]);
    mockDraft
      .mockResolvedValueOnce({ ok: false, error: "llm", reason: "llm" })
      .mockResolvedValueOnce({ ok: true, created: true });
    const r = await autoDraftPitches(biz());
    expect(r).toEqual({ attempted: 2, created: 1, stoppedBy: null });
  });
});
