import { describe, expect, it, vi } from "vitest";
import { renderGigBriefPdf, type GigBriefData } from "@/lib/pdf/gig-brief";

// Gig brief (P11.3): grounded one-pager. Render smoke + the extraction
// contract (mocked LLM) — empty sections stay empty, items are capped/trimmed.

const full: GigBriefData = {
  artistName: "Sapphire Sounds",
  performerLabel: "Maya",
  clientName: "Jess Park",
  clientEmail: "jess@example.com",
  clientPhone: "+44 7700 900123",
  eventType: "Wedding",
  eventDateLabel: "Monday, 14 September 2026",
  venue: "The Glasshouse",
  guestCount: 120,
  setTimes: "18:00–23:00",
  feeLabel: "GBP 1,500",
  specialRequests: ["First dance: 'At Last'", "No heavy metal"],
  practicalNotes: ["Load-in from 15:00 via the rear entrance", "Day-of contact: Sam (venue manager)"],
  briefRef: "GB-20260707-AB12",
  issuedLabel: "7 July 2026",
};

describe("renderGigBriefPdf", () => {
  it("renders a full brief to a real PDF", async () => {
    const buf = await renderGigBriefPdf(full);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders with everything optional missing (sections omitted, never padded)", async () => {
    const buf = await renderGigBriefPdf({
      ...full,
      performerLabel: null,
      clientEmail: null,
      clientPhone: null,
      setTimes: null,
      feeLabel: null,
      guestCount: null,
      specialRequests: [],
      practicalNotes: [],
    });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

const mockLlmObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm", () => ({ llmObject: mockLlmObject }));

describe("extractGigBrief", () => {
  it("trims, drops blanks, caps at 6 per section, nulls empty setTimes", async () => {
    const { extractGigBrief } = await import("@/lib/agent/gig-brief-extract");
    mockLlmObject.mockResolvedValue({
      setTimes: "  ",
      specialRequests: [" First dance ", "", ...Array(8).fill("another request")],
      practicalNotes: [],
    });
    const r = await extractGigBrief({
      businessId: "biz1",
      thread: [{ direction: "INBOUND", body: "Can you play our first dance?" }],
    });
    expect(r.setTimes).toBeNull();
    expect(r.specialRequests[0]).toBe("First dance");
    expect(r.specialRequests.length).toBe(6);
    expect(r.practicalNotes).toEqual([]);
    // Extraction-only discipline lives in the system prompt.
    expect(mockLlmObject.mock.calls[0][0].system).toContain("never invent");
  });
});
