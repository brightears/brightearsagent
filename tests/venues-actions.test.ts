import { beforeEach, describe, expect, it, vi } from "vitest";

// draftVenuePitch action (10.2c slice): daily caps by temperature + the
// temperature SNAPSHOT on the created VenuePitch (the sequencing guard's
// anchor — WARM/SEED pitches must never enter a follow-up sequence, and any
// future venue-side sequence engine keys on this snapshot).

const mockDb = vi.hoisted(() => ({
  package: { count: vi.fn() },
  gig: { count: vi.fn() },
  venue: { findFirst: vi.fn(), updateMany: vi.fn() },
  venuePitch: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({
  getCurrentBusiness: vi.fn(async () => ({
    id: "biz1",
    name: "Sapphire Sounds",
    slug: "sapphire-sounds",
    ownerName: "Maya Reyes",
    performerKind: "DJ",
    timezone: "Europe/London",
    voiceSamples: null,
    headline: null,
    bio: null,
    genres: ["house"],
    eventTypes: ["weddings"],
    serviceCities: ["Manchester"],
    feeFloor: null,
    feeSweetSpot: null,
    reviewQuotes: [],
    notableVenues: [],
    pitchLanguages: ["en"],
  })),
}));
vi.mock("@/lib/profile/strength", () => ({
  profileStrength: vi.fn(() => ({ canPitch: true, percent: 100 })),
}));
// Keep epkUrlFor/pitchLanguageFor real; never let the action hit OpenRouter.
vi.mock("@/lib/agent/venue-pitch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agent/venue-pitch")>()),
  generateVenuePitch: vi.fn(async () => ({
    subject: "Intro for your rotation",
    body: "Saw you run Friday DJ sets — keep me on file.",
    model: "test/model",
  })),
}));

import { draftVenuePitch } from "@/app/actions/venues";
import { generateVenuePitch } from "@/lib/agent/venue-pitch";

const warmVenue = {
  id: "v1",
  businessId: "biz1",
  name: "Velvet Lounge",
  city: "Manchester",
  country: "GB",
  kind: "BAR",
  status: "DISCOVERED",
  temperature: "WARM",
  timingScore: 35,
  entertainmentEvidence: ["Runs Friday DJ nights per its events page"],
  linkedinUrl: null,
  fitScore: 80,
  fitReasons: ["Bar — your sound fits the room"],
  bookingEmail: null,
  signals: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.package.count.mockResolvedValue(1);
  mockDb.gig.count.mockResolvedValue(3);
  mockDb.venue.findFirst.mockResolvedValue(warmVenue);
  mockDb.venue.updateMany.mockResolvedValue({ count: 1 });
  mockDb.venuePitch.findFirst.mockResolvedValue(null);
  mockDb.venuePitch.count.mockResolvedValue(0);
  mockDb.venuePitch.create.mockResolvedValue({ id: "p1" });
});

describe("draftVenuePitch — 10.2c caps + temperature snapshot", () => {
  it("snapshots the venue's temperature onto the created VenuePitch", async () => {
    const result = await draftVenuePitch("v1");
    expect(result).toEqual({ ok: true });
    expect(mockDb.venuePitch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ temperature: "WARM" }),
      }),
    );
    // The generator received the temperature + evidence (template selection).
    const req = vi.mocked(generateVenuePitch).mock.calls[0][0];
    expect(req.venue.temperature).toBe("WARM");
    expect(req.venue.entertainmentEvidence).toEqual([
      "Runs Friday DJ nights per its events page",
    ]);
  });

  it("counts today's pitches PER temperature in the tenant's timezone", async () => {
    await draftVenuePitch("v1");
    const where = mockDb.venuePitch.count.mock.calls[0][0].where;
    expect(where.businessId).toBe("biz1");
    expect(where.temperature).toBe("WARM");
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("refuses the 6th WARM pitch of the day with the friendly cap error, before any LLM spend", async () => {
    mockDb.venuePitch.count.mockResolvedValue(5); // WARM cap = 5
    const result = await draftVenuePitch("v1");
    expect(result).toEqual({
      ok: false,
      error: "Daily warm-pitch cap reached — quality beats volume",
    });
    expect(generateVenuePitch).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.create).not.toHaveBeenCalled();
  });

  it("SEED cap is 3", async () => {
    mockDb.venue.findFirst.mockResolvedValue({ ...warmVenue, temperature: "SEED" });
    mockDb.venuePitch.count.mockResolvedValue(3);
    const result = await draftVenuePitch("v1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("intro-pitch cap");
  });

  it("HOT keeps room for 10 — the 10th-of-the-day still drafts", async () => {
    mockDb.venue.findFirst.mockResolvedValue({ ...warmVenue, temperature: "HOT" });
    mockDb.venuePitch.count.mockResolvedValue(9);
    expect(await draftVenuePitch("v1")).toEqual({ ok: true });
  });
});
