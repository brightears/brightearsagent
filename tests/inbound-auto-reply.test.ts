import { describe, expect, it } from "vitest";
import { detectAutoReply } from "@/lib/inbound/auto-reply";
import type { InboundEmail } from "@/lib/inbound/types";

// An out-of-office used to be handled as a genuine prospect reply, which by hard
// rule 5 stops the follow-up sequence permanently — and on the Hunt side flipped
// the venue PITCHED → REPLIED, cancelling the one +6-day bump. Both silent.
//
// The asymmetry these tests protect: missing an auto-reply stalls a sequence;
// misclassifying a REAL reply as an auto-reply means we keep emailing someone who
// already answered, which is worse. The "must NOT fire" cases matter more than
// the "must fire" ones.

const mail = (over: Partial<InboundEmail> = {}): InboundEmail =>
  ({
    from: "client@example.com",
    to: "leads@norbert.in.brightears.io",
    subject: "Re: DJ for our wedding",
    textBody: "Yes, the 14th works.",
    headers: {},
    ...over,
  }) as InboundEmail;

describe("detectAutoReply — authoritative headers (tier A)", () => {
  it("catches RFC 3834 Auto-Submitted in all its wild forms", () => {
    for (const v of ["auto-replied", "auto-generated", "auto-notified", "auto-replied; owner-email=x@y.z"]) {
      expect(detectAutoReply(mail({ headers: { "Auto-Submitted": v } })), v).not.toBeNull();
    }
  });

  it('treats Auto-Submitted: "no" as a HUMAN message — that is what it means', () => {
    expect(detectAutoReply(mail({ headers: { "Auto-Submitted": "no" } }))).toBeNull();
  });

  it("reads headers case-insensitively, since relays keep their own casing", () => {
    expect(detectAutoReply(mail({ headers: { "AUTO-SUBMITTED": "auto-replied" } }))).not.toBeNull();
    expect(detectAutoReply(mail({ headers: { "auto-submitted": "auto-replied" } }))).not.toBeNull();
  });

  it("catches the cPanel/Exim/Zimbra responder headers", () => {
    for (const h of ["X-Autoreply", "X-Autorespond", "X-Autoreply-From", "X-Auto-Reply-From"]) {
      expect(detectAutoReply(mail({ headers: { [h]: "yes" } })), h).not.toBeNull();
    }
  });

  it("catches Precedence: auto_reply but NOT bulk/list/junk", () => {
    expect(detectAutoReply(mail({ headers: { Precedence: "auto_reply" } }))).not.toBeNull();
    // Newsletters, corporate relays AND The Knot/WeddingWire/Bark lead
    // notifications are all Precedence: bulk. Treating these as auto-replies
    // would silently drop real leads.
    for (const v of ["bulk", "list", "junk"]) {
      expect(detectAutoReply(mail({ headers: { Precedence: v } })), v).toBeNull();
    }
  });

  it("catches Microsoft OOF / rules-generated mail", () => {
    expect(detectAutoReply(mail({ headers: { "X-MS-Exchange-Inbox-Rules-Loop": "a@b.c" } }))).not.toBeNull();
    expect(
      detectAutoReply(mail({ headers: { "X-MS-Exchange-Generated-Message-Source": "Mailbox Rules Agent" } })),
    ).not.toBeNull();
  });

  it("catches a null envelope sender", () => {
    expect(detectAutoReply(mail({ headers: { "Return-Path": "<>" } }))).not.toBeNull();
    // A normal Return-Path says nothing either way — forwarders rewrite it.
    expect(detectAutoReply(mail({ headers: { "Return-Path": "<client@example.com>" } }))).toBeNull();
  });

  it("treats X-Auto-Response-Suppress as evidence AGAINST, never for", () => {
    // It means "do not auto-reply TO me" — set by transactional senders.
    expect(detectAutoReply(mail({ headers: { "X-Auto-Response-Suppress": "All" } }))).toBeNull();
  });
});

describe("detectAutoReply — heuristic tier B needs subject AND a weak header", () => {
  const vacation = "Automatic reply: Out of the office";

  it("does NOT fire on a vacation subject alone", () => {
    // Phrasing alone is never enough: a human can legitimately title a reply
    // this way, or forward one.
    expect(detectAutoReply(mail({ subject: vacation }))).toBeNull();
  });

  it("fires on a vacation subject plus one corroborating header", () => {
    expect(detectAutoReply(mail({ subject: vacation, headers: { Precedence: "bulk" } }))).not.toBeNull();
    expect(
      detectAutoReply(mail({ subject: vacation, headers: { "X-Auto-Response-Suppress": "All" } })),
    ).not.toBeNull();
    expect(detectAutoReply(mail({ subject: vacation, headers: { "Return-Path": "<>" } }))).not.toBeNull();
    expect(detectAutoReply(mail({ subject: vacation, from: "no-reply@venue.com" }))).not.toBeNull();
  });

  it("recognises the common non-English vacation subjects", () => {
    for (const s of ["Automatische Antwort: Urlaub", "Abwesenheitsnotiz", "Réponse automatique", "Respuesta automática"]) {
      expect(detectAutoReply(mail({ subject: s, headers: { Precedence: "bulk" } })), s).not.toBeNull();
    }
  });
});

describe("detectAutoReply — the messages that must NEVER be misclassified", () => {
  it("a real booking reply that MENTIONS being out of office still engages", () => {
    // The counterexample that sets the whole design: this is money.
    const real = mail({
      subject: "Re: DJ for our wedding",
      textBody:
        "Sorry for the slow reply, I was out of the office last week — yes, the 14th works. What would you charge?",
    });
    expect(detectAutoReply(real)).toBeNull();
  });

  it("a plain human reply with no headers at all", () => {
    expect(detectAutoReply(mail({ headers: undefined }))).toBeNull();
    expect(detectAutoReply(mail({ headers: {} }))).toBeNull();
  });

  it("a venue answering a pitch properly", () => {
    expect(
      detectAutoReply(
        mail({
          from: "events@rooftop.com",
          subject: "Re: DJ for The Rooftop",
          textBody: "Interesting — can you do Fridays in September?",
        }),
      ),
    ).toBeNull();
  });

  it("a lead-notification email (Precedence: bulk) is not an auto-reply", () => {
    expect(
      detectAutoReply(
        mail({
          from: "notify@theknot.com",
          subject: "You have a new lead!",
          headers: { Precedence: "bulk" },
        }),
      ),
    ).toBeNull();
  });
});
