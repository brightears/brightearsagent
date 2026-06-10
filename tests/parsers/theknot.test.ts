import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { theKnotParser } from "@/lib/inbound/parsers/theknot";
import { LeadSource } from "@/app/generated/prisma/enums";
import type { InboundEmail } from "@/lib/inbound/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "..", "..", "fixtures", "inbound", "theknot");

function loadFixture(name: string): InboundEmail {
  const raw = JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8"));
  delete raw._researchNotes;
  return raw as InboundEmail;
}

describe("theKnotParser", () => {
  it("exposes the THE_KNOT source", () => {
    expect(theKnotParser.source).toBe(LeadSource.THE_KNOT);
  });

  describe("lead-complete.json (happy path, member.theknot.com)", () => {
    const email = loadFixture("lead-complete.json");

    it("matches", () => {
      expect(theKnotParser.match(email)).toBe(true);
    });

    it("extracts every field", () => {
      expect(theKnotParser.parse(email)).toEqual({
        source: LeadSource.THE_KNOT,
        clientName: "Olivia Martinez",
        clientEmail: "olivia.martinez1017@example.com",
        clientPhone: "(512) 555-0147",
        eventType: "wedding",
        eventDate: "2026-10-17",
        venue: "The Juniper Loft, Austin, TX",
        guestCount: 125,
        notes:
          "Hi! We're getting married on October 17, 2026 at The Juniper Loft and are looking for a DJ who can also MC. Your reviews looked great. Are you available, and what do your packages start at?",
        confidence: 0.97,
      });
    });
  });

  describe("lead-sparse.json (message-style, partner.theknot.com)", () => {
    const email = loadFixture("lead-sparse.json");

    it("matches", () => {
      expect(theKnotParser.match(email)).toBe(true);
    });

    it("extracts name from prose, email from reply line, long-form date; omits absent fields", () => {
      expect(theKnotParser.parse(email)).toEqual({
        source: LeadSource.THE_KNOT,
        clientName: "Marcus Webb",
        clientEmail: "marcus.webb88@example.com",
        clientPhone: undefined,
        eventType: "wedding",
        eventDate: "2027-04-05",
        venue: undefined,
        guestCount: undefined,
        notes:
          "Hey there - are you available for our wedding next spring? It's a small backyard thing, mostly open-format music. What would that run us?",
        confidence: 0.85,
      });
    });
  });

  describe("lead-edge-html-only.json (HTML-only, Re: subject, TBD date, guest range)", () => {
    const email = loadFixture("lead-edge-html-only.json");

    it("matches despite reply-style subject", () => {
      expect(theKnotParser.match(email)).toBe(true);
    });

    it("parses the HTML body, leaves TBD date unset, takes range lower bound", () => {
      expect(theKnotParser.parse(email)).toEqual({
        source: LeadSource.THE_KNOT,
        clientName: "Priya Raman",
        clientEmail: "priya.raman.weds@example.com",
        clientPhone: "312-555-0188",
        eventType: "wedding",
        eventDate: undefined,
        venue: "Chicago, IL",
        guestCount: 100,
        notes:
          "We're planning a fusion wedding and still locking the venue, so the date is flexible. Do you handle both Bollywood and Top 40 sets?",
        confidence: 0.9,
      });
    });
  });

  describe("negative cases", () => {
    it("does not match an email from a different sender (GigSalad)", () => {
      const email: InboundEmail = {
        from: "leads@gigsalad.com",
        fromName: "GigSalad",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "You have a new lead on GigSalad!",
        textBody: "A client is interested in booking you. Log in to respond.",
        providerMessageId: "neg-gigsalad-0001",
      };
      expect(theKnotParser.match(email)).toBe(false);
      expect(theKnotParser.parse(email)).toBeNull();
    });

    it("does not match a The Knot marketing email without lead markers", () => {
      const email: InboundEmail = {
        from: "hello@theknot.com",
        fromName: "The Knot Pro",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "Grow your storefront this fall",
        textBody:
          "Tips from top vendors: refresh your photos, update your pricing, and collect reviews to stand out next season.",
        providerMessageId: "neg-marketing-0001",
      };
      expect(theKnotParser.match(email)).toBe(false);
    });

    it("returns null from parse() when a matching email carries no extractable lead", () => {
      const email: InboundEmail = {
        from: "no-reply@member.theknot.com",
        fromName: "The Knot",
        to: "leads@demo-dj-co.in.brightears.io",
        subject: "New lead from The Knot",
        textBody: "Log in to your account to view this lead.",
        providerMessageId: "neg-empty-0001",
      };
      expect(theKnotParser.match(email)).toBe(true);
      expect(theKnotParser.parse(email)).toBeNull();
    });
  });
});
