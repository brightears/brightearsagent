import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LeadSource } from "@/app/generated/prisma/enums";
import { barkParser } from "@/lib/inbound/parsers/bark";
import type { InboundEmail } from "@/lib/inbound/types";

const FIXTURE_DIR = fileURLToPath(
  new URL("../../fixtures/inbound/bark/", import.meta.url),
);

function loadFixture(name: string): InboundEmail {
  return JSON.parse(
    readFileSync(path.join(FIXTURE_DIR, name), "utf8"),
  ) as InboundEmail;
}

const alert = loadFixture("new-lead-alert.json");
const sparse = loadFixture("new-lead-sparse.json");
const purchased = loadFixture("purchased-lead-contacts.json");

describe("barkParser.match", () => {
  it("matches team@bark.com for every fixture", () => {
    expect(barkParser.match(alert)).toBe(true);
    expect(barkParser.match(sparse)).toBe(true);
    expect(barkParser.match(purchased)).toBe(true);
  });

  it("does not match emails from other senders", () => {
    const other: InboundEmail = {
      ...alert,
      from: "notifications@theknot.com",
      fromName: "The Knot",
    };
    expect(barkParser.match(other)).toBe(false);
  });

  it("does not match a lookalike domain", () => {
    const spoof: InboundEmail = { ...alert, from: "team@notbark.com" };
    expect(barkParser.match(spoof)).toBe(false);
  });
});

describe("barkParser.parse — new-lead alert (pre-purchase)", () => {
  it("extracts every field from the text body", () => {
    const lead = barkParser.parse(alert);
    expect(lead).not.toBeNull();
    expect(lead).toEqual({
      source: LeadSource.BARK,
      clientName: "Maya R.",
      clientEmail: undefined,
      clientPhone: undefined,
      eventType: "wedding",
      eventDate: "2026-11-14",
      venue: "Hotel / banquet hall",
      guestCount: 100,
      budgetHint: "$750 - $1,000",
      notes: [
        "Location: Austin, TX",
        "How long do you need the DJ for? 5 hours",
        "Anything else the DJ should know? Ceremony on the lawn, reception in the ballroom. We love 90s R&B and Motown.",
        "Lead price: 12 credits",
      ].join("\n"),
      confidence: 0.92,
    });
  });

  it("extracts the same lead from htmlBody when textBody is empty", () => {
    const htmlOnly: InboundEmail = { ...alert, textBody: "" };
    const lead = barkParser.parse(htmlOnly);
    expect(lead).not.toBeNull();
    expect(lead?.clientName).toBe("Maya R.");
    expect(lead?.eventType).toBe("wedding");
    expect(lead?.eventDate).toBe("2026-11-14");
    expect(lead?.venue).toBe("Hotel / banquet hall");
    expect(lead?.guestCount).toBe(100);
    expect(lead?.budgetHint).toBe("$750 - $1,000");
    expect(lead?.notes).toContain("Location: Austin, TX");
    expect(lead?.notes).toContain("Lead price: 12 credits");
    expect(lead?.confidence).toBe(0.92);
  });
});

describe("barkParser.parse — sparse alert", () => {
  it("extracts what exists and never invents a date from a vague answer", () => {
    const lead = barkParser.parse(sparse);
    expect(lead).not.toBeNull();
    expect(lead).toEqual({
      source: LeadSource.BARK,
      clientName: "Jordan P.",
      clientEmail: undefined,
      clientPhone: undefined,
      eventType: "birthday",
      eventDate: undefined,
      venue: undefined,
      guestCount: undefined,
      budgetHint: undefined,
      notes: [
        "Location: Birmingham, West Midlands",
        "When is the event? I'm not sure yet",
        "Lead price: 5 credits",
      ].join("\n"),
      confidence: 0.75,
    });
  });
});

describe("barkParser.parse — purchased lead (contact details unlocked)", () => {
  it("extracts the full contact block and US-format date", () => {
    const lead = barkParser.parse(purchased);
    expect(lead).not.toBeNull();
    expect(lead).toEqual({
      source: LeadSource.BARK,
      clientName: "Maya Rodriguez",
      clientEmail: "maya.rodriguez@example.net",
      clientPhone: "(512) 555-0184",
      eventType: "wedding",
      eventDate: "2026-11-14",
      venue: undefined,
      guestCount: 100,
      budgetHint: "$750 - $1,000",
      notes: undefined,
      confidence: 0.95,
    });
  });
});

describe("barkParser.parse — non-lead mail from bark.com", () => {
  it("returns null for promo/marketing email so the pipeline can fall through", () => {
    const promo: InboundEmail = {
      from: "team@bark.com",
      fromName: "Bark.com",
      to: "leads@demo-dj-co.in.brightears.io",
      subject: "Get 20% extra credits this week only",
      textBody:
        "Hi Demo DJ Co,\n\nTop up before Friday and we'll add 20% extra credits to your account.\n\nBuy credits: https://www.bark.com/sellers/credits/\n\n--\nBark.com Global Limited, 85 Great Portland Street, London, W1W 7LT",
      providerMessageId: "pm-bark-promo-0001",
    };
    expect(barkParser.match(promo)).toBe(true);
    expect(barkParser.parse(promo)).toBeNull();
  });

  it("returns null for an email that does not match the sender at all", () => {
    const other: InboundEmail = {
      ...alert,
      from: "no-reply@gigsalad.com",
    };
    expect(barkParser.parse(other)).toBeNull();
  });
});
