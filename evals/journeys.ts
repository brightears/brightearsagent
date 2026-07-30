/**
 * Journey evals — the INBOUND PIPELINE, end to end.
 *
 * evals/scenarios.ts covers draft *wording* by calling the drafter directly.
 * This file covers everything that happens before and around that: which
 * tenant a message routes to, whether it becomes a new lead or attaches to an
 * old one, what the parser pulled out, and what the lifecycle does next.
 *
 * That distinction is not academic. Every defect found on launch day lived
 * here, not in the wording, and each one was invisible from the outside:
 *   - a real inquiry filed itself as a reply to a year-old lead and vanished;
 *   - a corrupt row swallowed every future message from one address;
 *   - mail to a mistyped recipient was accepted and destroyed with no bounce.
 * A draft-quality eval cannot see any of those, because no draft is produced.
 *
 * Each journey seeds its OWN tenant, so journeys cannot contaminate each other
 * and the whole file can run in any order.
 */
import type { LeadStatus } from "@/app/generated/prisma/enums";

export interface JourneyStep {
  label: string;
  from: string;
  fromName?: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  /** Override the recipient to test routing. Defaults to the tenant's parse address. */
  to?: string;
  headers?: Record<string, string>;
  /**
   * Backdate every message on the matched lead by this many days BEFORE running
   * the step — the only way to exercise the reply-match window without waiting.
   */
  ageExistingLeadDays?: number;
  expect: {
    outcome:
      | "lead_created" | "reply_attached" | "duplicate" | "no_tenant"
      | "ignored" | "forwarding_confirmation" | "venue_reply";
    /** Assert the lead this step touched is (or is not) the one from an earlier step. */
    sameLeadAs?: string;
    differentLeadFrom?: string;
    status?: LeadStatus;
    eventType?: RegExp;
    /** ISO yyyy-mm-dd. */
    eventDate?: string;
    clientEmail?: string;
    clientName?: RegExp;
    /** Fields that must NOT contain model reasoning leakage. */
    venueSane?: boolean;
  };
}

export interface Journey {
  id: string;
  /** Why this journey exists — the failure it is here to catch. */
  why: string;
  steps: JourneyStep[];
}

const WEDDING = `Hi there, we found you through a friend who saw you play last year. We are getting married on 12 September 2027 at The Siam Hotel in Bangkok, riverside, with about 140 guests. We would need a DJ from 8pm through to around 1am, plus a microphone for the speeches. We love deep house and 90s disco. Could you let us know if you are free and roughly what your fee would be. Thanks so much, Amara Lindqvist`;

export const JOURNEYS: Journey[] = [
  {
    id: "new-inquiry",
    why: "The baseline. A plain wedding inquiry must become a NEW lead with the date and event type actually extracted.",
    steps: [
      {
        label: "first contact",
        from: "amara.lindqvist@example.com",
        fromName: "Amara Lindqvist",
        subject: "DJ for our wedding, 12 September 2027",
        textBody: WEDDING,
        expect: {
          outcome: "lead_created",
          status: "NEW",
          eventType: /wedding/i,
          eventDate: "2027-09-12",
          clientEmail: "amara.lindqvist@example.com",
          clientName: /amara/i,
          venueSane: true,
        },
      },
    ],
  },

  {
    id: "double-email-before-reply",
    why: "A client who writes twice before we answer must land on ONE lead — not two — and must not be marked ENGAGED, which would kill their follow-up sequence.",
    steps: [
      {
        label: "first contact",
        from: "priya@example.com",
        subject: "Wedding DJ enquiry",
        textBody: WEDDING,
        expect: { outcome: "lead_created", status: "NEW" },
      },
      {
        label: "chases two days later, we still have not replied",
        from: "priya@example.com",
        subject: "Re: Wedding DJ enquiry",
        textBody: "Sorry to chase — did this reach you? Still very keen. Amara",
        expect: { outcome: "reply_attached", sameLeadAs: "first contact", status: "NEW" },
      },
    ],
  },

  {
    id: "returning-client-new-event",
    why: "THE LAUNCH-DAY BUG. A past client writing about a DIFFERENT event a year later must get a NEW lead. Matching on address alone, forever, made every un-replied lead a permanent black hole for that sender.",
    steps: [
      {
        label: "last year's enquiry",
        from: "repeat@example.com",
        subject: "DJ for our engagement party",
        textBody: "Hi, we would like a DJ for our engagement party on 4 May 2027 in Bangkok, around 60 guests. Thanks, Kessara",
        expect: { outcome: "lead_created", status: "NEW" },
      },
      {
        label: "a year later, brand new event",
        from: "repeat@example.com",
        subject: "Different event — corporate night",
        textBody: "Hello again! Completely separate booking this time: our company year-end party on 18 December 2027, about 200 people at a hotel ballroom in Sathorn. Are you free? Kessara",
        ageExistingLeadDays: 400,
        expect: {
          outcome: "lead_created",
          differentLeadFrom: "last year's enquiry",
          eventType: /corporate|party/i,
        },
      },
    ],
  },

  {
    id: "genuine-thread-continues",
    why: "The other side of the same coin: an ACTIVE back-and-forth must keep attaching however long it runs, or a live negotiation fragments into duplicate leads.",
    steps: [
      {
        label: "enquiry",
        from: "thread@example.com",
        subject: "Wedding 12 Sept 2027",
        textBody: WEDDING,
        expect: { outcome: "lead_created" },
      },
      {
        label: "still talking 40 days on",
        from: "thread@example.com",
        subject: "Re: Wedding 12 Sept 2027",
        textBody: "Thanks for the details. One more question — can you also cover the ceremony music?",
        ageExistingLeadDays: 40,
        expect: { outcome: "reply_attached", sameLeadAs: "enquiry" },
      },
    ],
  },

  {
    id: "unroutable-recipient",
    why: "A mistyped forwarding rule (lead@ instead of leads@) is accepted by the wildcard MX. Today it is 200'd and destroyed with no lead, no log and no bounce — a customer's inquiries vanish and nothing anywhere says so.",
    steps: [
      {
        label: "typo in the forwarding address",
        from: "typo@example.com",
        subject: "Wedding enquiry",
        textBody: WEDDING,
        to: "lead@__SLUG__.in.brightears.io",
        expect: { outcome: "no_tenant" },
      },
    ],
  },

  {
    id: "not-an-inquiry",
    why: "Newsletters and one-line notes must be ignored rather than manufactured into leads — but silently dropping them is how a customer's real test message disappears during onboarding.",
    steps: [
      {
        label: "a bare test message",
        from: "someone@example.com",
        subject: "test email",
        textBody: "test email",
        expect: { outcome: "ignored" },
      },
    ],
  },

  {
    id: "out-of-office",
    why: "An autoreply must not be treated as the client engaging. ENGAGED stops the sequence and expires the draft, and nothing moves a lead back out of ENGAGED — so one OOO permanently stranded the lead. NOTE: until 2026-07-30 this journey asserted `reply_attached`, i.e. it DESCRIBED the hazard in this comment while its expectation locked in the buggy behaviour. The third step exists so the assertion can never drift back: a real reply after the autoreply must still engage the thread.",
    steps: [
      {
        label: "enquiry",
        from: "ooo@example.com",
        subject: "Wedding DJ",
        textBody: WEDDING,
        expect: { outcome: "lead_created" },
      },
      {
        label: "automatic reply",
        from: "ooo@example.com",
        subject: "Automatic reply: Wedding DJ",
        textBody: "I am out of the office until 5 August with limited access to email.",
        headers: { "Auto-Submitted": "auto-replied" },
        // Recorded on the thread, but the lead status and the follow-up sequence
        // are left untouched — so the sequence keeps running.
        expect: { outcome: "ignored" },
      },
      {
        label: "the human reply that follows",
        from: "ooo@example.com",
        subject: "Re: Wedding DJ",
        textBody: "Back now — sorry for the delay. Yes please, we would love to talk. What would you charge for the evening?",
        // The OOO must not have poisoned the conversation: a genuine reply to
        // the SAME lead still attaches and engages exactly as before.
        expect: { outcome: "reply_attached", sameLeadAs: "enquiry" },
      },
    ],
  },

  {
    id: "html-only-sender",
    why: "Some senders give Postmark no TextBody at all. If the markup is not stripped at the door, parser and triage both see an empty string and the lead is dropped as 'not an inquiry'.",
    steps: [
      {
        label: "html only",
        from: "htmlonly@example.com",
        subject: "Enquiry for 20 November 2027",
        textBody: "",
        htmlBody: `<html><body><p>Hi! We are planning a <b>corporate party</b> on 20 November 2027 in Bangkok for about 150 guests and need a DJ from 9pm.</p><p>Best,<br>Daniel Rivera</p></body></html>`,
        expect: { outcome: "lead_created", eventDate: "2027-11-20", venueSane: true },
      },
    ],
  },

  {
    id: "reasoning-leak",
    why: "Cheap models sometimes emit their chain-of-thought INTO a JSON string value. One such row reached production and rendered a monologue plus a real email address on the live dashboard. No parsed field may ever contain newlines, braces or backticks.",
    steps: [
      {
        label: "ambiguous venue phrasing that has provoked leakage before",
        from: "leak@example.com",
        subject: "Wedding enquiry",
        textBody:
          "Hi, we are getting married at a riverside venue in Bangkok on 12 September 2027, about 120 guests. Name: Jessica Park. Could you send your rates?",
        expect: { outcome: "lead_created", venueSane: true, clientName: /jessica/i },
      },
    ],
  },

  {
    id: "duplicate-delivery",
    why: "Postmark redelivers webhooks. The same provider message id must never produce a second lead.",
    steps: [
      {
        label: "first delivery",
        from: "dupe@example.com",
        subject: "Wedding DJ 12 Sept 2027",
        textBody: WEDDING,
        expect: { outcome: "lead_created" },
      },
      {
        label: "same message delivered again",
        from: "dupe@example.com",
        subject: "Wedding DJ 12 Sept 2027",
        textBody: WEDDING,
        expect: { outcome: "duplicate" },
      },
    ],
  },
];
