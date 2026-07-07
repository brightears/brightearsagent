import { beforeEach, describe, expect, it, vi } from "vitest";

// Booking-confirmation draft (P11.2): DETERMINISTIC — a confirmation is a
// contractual email, so no LLM anywhere in this path; the artist's saved
// greeting/signoff wraps grounded facts only (date in the tenant tz, venue,
// captured fee, booking link).

const mockDb = vi.hoisted(() => ({
  lead: { findUnique: vi.fn() },
  draft: { findFirst: vi.fn(), create: vi.fn() },
}));
const mockNotify = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/notify", () => ({ notifyBusiness: mockNotify }));

import { draftBookingConfirmation } from "@/lib/agent/confirmation";

const business = {
  id: "biz1",
  name: "Sapphire Sounds",
  currency: "THB",
  timezone: "Asia/Bangkok",
  voiceGreeting: "Hey [name]!",
  voiceSignoff: "Talk soon —",
  bookingLinkUrl: "https://book.sapphire.example",
};

const bookedLead = {
  id: "l1",
  clientName: "Jess Park",
  clientEmail: "jess@example.com",
  optedOut: false,
  eventType: "wedding",
  eventDate: new Date("2026-09-14T12:00:00Z"),
  venue: "The Glasshouse",
  business,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.lead.findUnique.mockResolvedValue(bookedLead);
  mockDb.draft.findFirst.mockResolvedValue(null);
  mockDb.draft.create.mockResolvedValue({ id: "d9" });
});

describe("draftBookingConfirmation", () => {
  it("writes a grounded confirmation: voice greeting, real date/venue, fee, booking link", async () => {
    const id = await draftBookingConfirmation("l1", 1500000);
    expect(id).toBe("d9");
    const data = mockDb.draft.create.mock.calls[0][0].data;
    expect(data.isConfirmation).toBe(true);
    expect(data.wantsQuote).toBe(true);
    expect(data.body).toContain("Hey Jess!");
    expect(data.body).toContain("Monday, September 14, 2026");
    expect(data.body).toContain("at The Glasshouse");
    expect(data.body).toContain("THB 15,000");
    expect(data.body).toContain("https://book.sapphire.example");
    expect(data.body).toContain("Talk soon —");
    expect(data.body).toContain("Sapphire Sounds");
    // White-label invariant: no AI, no Bright Ears (CLAUDE.md rule 7).
    expect(data.body).not.toMatch(/\bAI\b/i);
    expect(data.body).not.toContain("Bright Ears");
    expect(mockNotify).toHaveBeenCalled();
  });

  it("omits the fee and booking-link lines when there's nothing to ground them", async () => {
    mockDb.lead.findUnique.mockResolvedValue({
      ...bookedLead,
      business: { ...business, bookingLinkUrl: null },
    });
    await draftBookingConfirmation("l1", null);
    const data = mockDb.draft.create.mock.calls[0][0].data;
    expect(data.body).not.toContain("fee is");
    expect(data.body).not.toContain("complete the booking");
  });

  it("returns null (no draft) without a reachable email, on opt-out, or when a draft is pending", async () => {
    mockDb.lead.findUnique.mockResolvedValue({ ...bookedLead, clientEmail: null });
    expect(await draftBookingConfirmation("l1", null)).toBeNull();

    mockDb.lead.findUnique.mockResolvedValue({ ...bookedLead, optedOut: true });
    expect(await draftBookingConfirmation("l1", null)).toBeNull();

    mockDb.lead.findUnique.mockResolvedValue(bookedLead);
    mockDb.draft.findFirst.mockResolvedValue({ id: "existing" });
    expect(await draftBookingConfirmation("l1", null)).toBeNull();
    expect(mockDb.draft.create).not.toHaveBeenCalled();
  });
});
