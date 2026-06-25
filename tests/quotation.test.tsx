import { describe, it, expect } from "vitest";
import { renderQuotationForLead, type BusinessForQuote, type LeadForQuote } from "@/lib/pdf/build";

const business: BusinessForQuote = {
  name: "DJ Midnight", timezone: "Asia/Bangkok", currency: "THB",
  feeFloor: 1_500_000, feeSweetSpot: 2_000_000, residencyRate: 800_000,
  replyToEmail: "hi@dj.example", ownerEmail: "owner@dj.example",
  websiteUrl: "https://dj.example", bookingLinkUrl: "https://book.dj.example",
  packages: [{ name: "Wedding package", description: "4h", priceMin: 2_500_000, priceMax: 3_000_000, eventTypes: ["wedding"] }],
};
const lead: LeadForQuote = {
  id: "lead_abcd1234", clientName: "Sarah", eventType: "wedding",
  eventDate: new Date("2026-09-12T00:00:00Z"), venue: "The Grand", guestCount: 120,
};
const NOW = new Date("2026-06-24T00:00:00Z");

describe("renderQuotationForLead", () => {
  it("renders a firm package quote to a valid PDF", async () => {
    const buf = await renderQuotationForLead(lead, business, NOW);
    expect(buf).not.toBeNull();
    expect(buf!.subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("renders an estimate when no package matches", async () => {
    const buf = await renderQuotationForLead({ ...lead, eventType: "corporate gala" }, { ...business }, NOW);
    expect(buf!.subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("returns null when there's no pricing to quote from", async () => {
    const buf = await renderQuotationForLead(
      { ...lead, eventType: "gala" },
      { ...business, feeFloor: null, feeSweetSpot: null, residencyRate: null, packages: [] },
      NOW,
    );
    expect(buf).toBeNull();
  });
});
