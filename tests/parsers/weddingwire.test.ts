import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { weddingwireParser } from "@/lib/inbound/parsers/weddingwire";
import type { InboundEmail } from "@/lib/inbound/types";

function loadFixture(name: string): InboundEmail {
  const file = path.resolve(
    __dirname,
    "../../fixtures/inbound/weddingwire",
    `${name}.json`,
  );
  const raw = JSON.parse(readFileSync(file, "utf8"));
  delete raw._researchNotes;
  return raw as InboundEmail;
}

describe("weddingwireParser", () => {
  it("exposes the WEDDINGWIRE source", () => {
    expect(weddingwireParser.source).toBe("WEDDINGWIRE");
  });

  describe("new-lead-full fixture (official 'New lead from {Name}' subject)", () => {
    const email = loadFixture("new-lead-full");

    it("matches", () => {
      expect(weddingwireParser.match(email)).toBe(true);
    });

    it("extracts every field the email carries", () => {
      const lead = weddingwireParser.parse(email);
      expect(lead).not.toBeNull();
      expect(lead!.source).toBe("WEDDINGWIRE");
      expect(lead!.clientName).toBe("Jessica Miller");
      expect(lead!.clientEmail).toBe("jessica.miller84@example.com");
      expect(lead!.clientPhone).toBe("(312) 555-0147");
      expect(lead!.eventType).toBe("wedding");
      expect(lead!.eventDate).toBe("2026-10-17");
      expect(lead!.guestCount).toBe(150);
      expect(lead!.budgetHint).toBeUndefined();
      expect(lead!.venue).toBeUndefined();
      expect(lead!.notes).toBe(
        "Hi! We're getting married next October at the Riverwalk Pavilion and love your reviews. Are you still available on our date, and could you send over your packages and pricing?",
      );
      expect(lead!.confidence).toBe(0.95);
    });

    it("extracts the same fields from htmlBody when textBody is empty", () => {
      const htmlOnly: InboundEmail = { ...email, textBody: "" };
      const lead = weddingwireParser.parse(htmlOnly);
      expect(lead).not.toBeNull();
      expect(lead!.clientName).toBe("Jessica Miller");
      expect(lead!.clientEmail).toBe("jessica.miller84@example.com");
      expect(lead!.clientPhone).toBe("(312) 555-0147");
      expect(lead!.eventDate).toBe("2026-10-17");
      expect(lead!.guestCount).toBe(150);
      expect(lead!.eventType).toBe("wedding");
    });
  });

  describe("new-lead-sparse fixture (numeric US date, guest range, no phone)", () => {
    const email = loadFixture("new-lead-sparse");

    it("matches", () => {
      expect(weddingwireParser.match(email)).toBe(true);
    });

    it("extracts present fields and never invents the missing ones", () => {
      const lead = weddingwireParser.parse(email);
      expect(lead).not.toBeNull();
      expect(lead!.clientName).toBe("Marcus Webb");
      expect(lead!.clientEmail).toBe("m.webb.events@example.net");
      expect(lead!.clientPhone).toBeUndefined();
      expect(lead!.eventDate).toBe("2026-10-03"); // 10/03/2026, US MM/DD/YYYY
      expect(lead!.eventType).toBe("wedding");
      // "100-150" is a range bucket — must NOT become a fabricated number.
      expect(lead!.guestCount).toBeUndefined();
      expect(lead!.notes).toBe(
        "How much for 5 hours of DJ and MC? [Guests: 100-150]",
      );
      expect(lead!.confidence).toBe(0.95);
    });
  });

  describe("new-message-flexible-date fixture (Re: prefix, flexible date)", () => {
    const email = loadFixture("new-message-flexible-date");

    it("matches despite the Re: threading prefix", () => {
      expect(weddingwireParser.match(email)).toBe(true);
    });

    it("takes the client email from Reply-To and leaves the flexible date unset", () => {
      const lead = weddingwireParser.parse(email);
      expect(lead).not.toBeNull();
      expect(lead!.clientName).toBe("Olivia Tran");
      expect(lead!.clientEmail).toBe("olivia.tran.weds@example.org");
      expect(lead!.clientPhone).toBeUndefined();
      // "Wedding Date: Flexible" is not a date — never invent one.
      expect(lead!.eventDate).toBeUndefined();
      expect(lead!.eventType).toBe("wedding");
      expect(lead!.guestCount).toBeUndefined();
      expect(lead!.notes).toBe(
        "Thanks for the quick reply! We haven't locked a venue yet so our wedding date is still flexible — sometime next spring. Could we set up a call this week?",
      );
      expect(lead!.confidence).toBe(0.92);
    });
  });

  describe("negative cases", () => {
    it("does not match the same subject from a different sender", () => {
      const impostor: InboundEmail = {
        from: "notifications@theknot.com",
        fromName: "The Knot",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "New lead from John Doe",
        textBody: "You have a new lead! Reply within your account.",
      };
      expect(weddingwireParser.match(impostor)).toBe(false);
      expect(weddingwireParser.parse(impostor)).toBeNull();
    });

    it("does not match a lookalike domain (notweddingwire.com)", () => {
      const lookalike: InboundEmail = {
        from: "pros@notweddingwire.com",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "New lead from John Doe",
        textBody: "You have a new lead!",
      };
      expect(weddingwireParser.match(lookalike)).toBe(false);
    });

    it("does not match a weddingwire.com email that is not a lead/message notification", () => {
      const promo: InboundEmail = {
        from: "promotions@weddingwire.com",
        fromName: "WeddingWire",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "Boost your storefront with 20% off advertising",
        textBody: "Upgrade your WeddingWire advertising package today and reach more couples.",
      };
      expect(weddingwireParser.match(promo)).toBe(false);
      expect(weddingwireParser.parse(promo)).toBeNull();
    });

    it("matches subdomain senders (e.g. email.weddingwire.com relay)", () => {
      const subdomain: InboundEmail = {
        from: "no-reply@email.weddingwire.com",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "New message from Jane Roe",
        textBody: "You have a new message! Reply within your account.",
      };
      expect(weddingwireParser.match(subdomain)).toBe(true);
    });
  });
});
