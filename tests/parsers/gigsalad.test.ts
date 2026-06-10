import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gigsaladParser } from "@/lib/inbound/parsers/gigsalad";
import type { InboundEmail } from "@/lib/inbound/types";

function loadFixture(name: string): InboundEmail {
  const file = path.resolve(
    __dirname,
    "../../fixtures/inbound/gigsalad",
    `${name}.json`,
  );
  const raw = JSON.parse(readFileSync(file, "utf8"));
  delete raw._researchNotes;
  return raw as InboundEmail;
}

describe("gigsaladParser", () => {
  it("exposes the GIGSALAD source", () => {
    expect(gigsaladParser.source).toBe("GIGSALAD");
  });

  describe("full-details fixture (additional-details variant)", () => {
    const email = loadFixture("full-details");

    it("matches", () => {
      expect(gigsaladParser.match(email)).toBe(true);
    });

    it("extracts every field the email carries — and never contact info", () => {
      const lead = gigsaladParser.parse(email);
      expect(lead).not.toBeNull();
      expect(lead!.source).toBe("GIGSALAD");
      expect(lead!.clientName).toBe("Marisol G.");
      expect(lead!.eventType).toBe("wedding");
      expect(lead!.eventDate).toBe("2026-06-14");
      expect(lead!.venue).toBe("Austin, TX");
      expect(lead!.guestCount).toBe(120);
      expect(lead!.budgetHint).toBe("$800 - $1,200");
      expect(lead!.notes).toBe(
        "Marisol G. is looking for a DJ for a Wedding Reception.",
      );
      // GigSalad withholds these by design — must never be set.
      expect(lead!.clientEmail).toBeUndefined();
      expect(lead!.clientPhone).toBeUndefined();
      expect(lead!.confidence).toBe(0.95);
    });

    it("extracts the same fields from htmlBody when textBody is empty", () => {
      const htmlOnly: InboundEmail = { ...email, textBody: "" };
      const lead = gigsaladParser.parse(htmlOnly);
      expect(lead).not.toBeNull();
      expect(lead!.eventType).toBe("wedding");
      expect(lead!.eventDate).toBe("2026-06-14");
      expect(lead!.venue).toBe("Austin, TX");
      expect(lead!.guestCount).toBe(120);
      expect(lead!.budgetHint).toBe("$800 - $1,200");
      expect(lead!.clientName).toBe("Marisol G.");
    });
  });

  describe("minimal-notification fixture (documented default: details withheld)", () => {
    const email = loadFixture("minimal-notification");

    it("matches", () => {
      expect(gigsaladParser.match(email)).toBe(true);
    });

    it("still classifies as a high-confidence GigSalad lead with no invented fields", () => {
      const lead = gigsaladParser.parse(email);
      expect(lead).not.toBeNull();
      expect(lead!.source).toBe("GIGSALAD");
      expect(lead!.confidence).toBe(0.9);
      expect(lead!.clientName).toBeUndefined();
      expect(lead!.clientEmail).toBeUndefined();
      expect(lead!.clientPhone).toBeUndefined();
      expect(lead!.eventType).toBeUndefined();
      expect(lead!.eventDate).toBeUndefined();
      expect(lead!.venue).toBeUndefined();
      expect(lead!.guestCount).toBeUndefined();
      expect(lead!.budgetHint).toBeUndefined();
    });
  });

  describe("reminder-numeric-date fixture (reminder + US MM/DD/YYYY)", () => {
    const email = loadFixture("reminder-numeric-date");

    it("matches", () => {
      expect(gigsaladParser.match(email)).toBe(true);
    });

    it("extracts the summary-sentence fields and converts the US date to ISO", () => {
      const lead = gigsaladParser.parse(email);
      expect(lead).not.toBeNull();
      expect(lead!.source).toBe("GIGSALAD");
      expect(lead!.clientName).toBe("Derrick T.");
      expect(lead!.eventType).toBe("quinceanera");
      expect(lead!.eventDate).toBe("2026-07-03");
      expect(lead!.venue).toBe("San Antonio, TX");
      expect(lead!.notes).toBe(
        "Derrick T. needs a DJ for a Quinceanera on 07/03/2026 in San Antonio, TX.",
      );
      expect(lead!.guestCount).toBeUndefined();
      expect(lead!.budgetHint).toBeUndefined();
      expect(lead!.clientEmail).toBeUndefined();
      expect(lead!.clientPhone).toBeUndefined();
      expect(lead!.confidence).toBe(0.95);
    });
  });

  describe("negative cases", () => {
    it("does not match an email from a different sender", () => {
      const other: InboundEmail = {
        from: "notifications@theknot.com",
        fromName: "The Knot",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "You have a new lead!",
        textBody: "A couple is interested in your services. View lead.",
        providerMessageId: "negative-001",
      };
      expect(gigsaladParser.match(other)).toBe(false);
      expect(gigsaladParser.parse(other)).toBeNull();
    });

    it("does not match a non-lead email from gigsalad.com", () => {
      const newsletter: InboundEmail = {
        from: "yourfriends@gigsalad.com",
        fromName: "GigSalad",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "5 tips to improve your PromoKit this spring",
        textBody:
          "Hey there! Here are some ideas to spruce up your profile photos and videos this season.",
        providerMessageId: "negative-002",
      };
      expect(gigsaladParser.match(newsletter)).toBe(false);
      expect(gigsaladParser.parse(newsletter)).toBeNull();
    });
  });
});
