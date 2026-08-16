import { describe, expect, it } from "vitest";
import {
  extractMoneyAmounts,
  extractMoneyMentions,
  groundFirstReplyAvailability,
  selectRelevantPackages,
  validateDraft,
} from "@/lib/agent/draft-safety";
import type { DraftRequest, DraftResult } from "@/lib/agent/types";

const request = (overrides: Partial<DraftRequest> = {}): DraftRequest => ({
  business: {
    id: null,
    name: "Sapphire Sounds",
    ownerName: "Maya",
    performerKind: "DJ",
    country: "GB",
    currency: "GBP",
    riderNotes: "DJ controller and compact sound system included.",
  },
  packages: [
    {
      name: "Wedding reception",
      description: "DJ, MC and dance-floor lighting",
      priceMin: 180_000,
      priceMax: 220_000,
      eventTypes: ["wedding"],
    },
    {
      name: "Corporate party",
      description: "DJ and sound system",
      priceMin: 90_000,
      priceMax: 120_000,
      eventTypes: ["corporate"],
    },
  ],
  lead: {
    source: "PLAIN_EMAIL",
    clientName: "Jess",
    eventType: "wedding",
    message: "What would your wedding package cost?",
  },
  availability: { state: "unknown" },
  thread: [],
  sequenceStep: 0,
  ...overrides,
});

const result = (overrides: Partial<DraftResult> = {}): DraftResult => ({
  subject: "Your wedding",
  body: "Our wedding reception package is £1,800–£2,200. What date are you considering?",
  availabilityStatement: "not_addressed",
  wantsProfile: false,
  wantsQuote: true,
  ...overrides,
});

describe("draft safety", () => {
  it("exposes only packages matched to the actual event", () => {
    expect(selectRelevantPackages(request()).map((pkg) => pkg.name)).toEqual([
      "Wedding reception",
    ]);
    expect(
      selectRelevantPackages(
        request({
          lead: {
            source: "PLAIN_EMAIL",
            eventType: "school prom",
            message: "Do you DJ proms? What do you charge?",
          },
        }),
      ),
    ).toEqual([]);
  });

  it("extracts both endpoints of inherited and repeated-currency ranges", () => {
    expect(
      extractMoneyAmounts("£1,800–2,200 or USD 900–USD 1,200").sort((a, b) => a - b),
    ).toEqual([
      900, 1200, 1800, 2200,
    ]);
  });

  it("retains currencies and recognizes word-currency and fee-shaped bare amounts", () => {
    expect(
      extractMoneyMentions("Our rate is 1,500; the backup option is 900 euros.", {
        defaultCurrency: "GBP",
        defaultEntity: "artist",
      }),
    ).toEqual(
      expect.arrayContaining([
        { amount: 1500, currency: "GBP", entity: "artist" },
        { amount: 900, currency: "EUR", entity: "artist" },
      ]),
    );
  });

  it("keeps adjacent package endpoints and the client's budget assigned to the right speaker", () => {
    expect(
      extractMoneyMentions(
        "Our Wedding Essentials package is $1,800–$2,200, close to your $2,000 budget.",
        { defaultCurrency: "USD", defaultEntity: "unknown" },
      ),
    ).toEqual(
      expect.arrayContaining([
        { amount: 1800, currency: "USD", entity: "artist" },
        { amount: 2200, currency: "USD", entity: "artist" },
        { amount: 2000, currency: "USD", entity: "client" },
      ]),
    );
  });

  it("rejects a rate borrowed from a different package", () => {
    const checked = validateDraft(
      request(),
      result({ body: "For your wedding, the package is £900. What date are you considering?" }),
    );
    expect(checked.issues.join(" ")).toContain("ungrounded price");
  });

  it("allows the client budget to be echoed without treating it as a quote", () => {
    const req = request({
      lead: {
        source: "PLAIN_EMAIL",
        eventType: "wedding",
        message: "Our budget is £2,000 — what can that cover?",
      },
    });
    const checked = validateDraft(
      req,
      result({ body: "Thanks — I see your £2,000 budget. What date are you considering?" }),
    );
    expect(checked.issues).toEqual([]);
  });

  it("allows neutral echoes of exact buyer money and canonical package prices", () => {
    const req = request({
      business: { ...request().business, currency: "USD" },
      lead: {
        source: "PLAIN_EMAIL",
        eventType: "wedding",
        message: "Budget around $2,000. What can that cover?",
      },
    });
    const checked = validateDraft(
      req,
      result({
        body:
          "With $2,000 to work with, the Wedding reception package is $1,800–$2,200. What date are you considering?",
      }),
    );
    expect(checked.issues).toEqual([]);
  });

  it("does not let a canonical package endpoint become an invented client budget", () => {
    const req = request({
      business: { ...request().business, currency: "USD" },
      lead: {
        source: "PLAIN_EMAIL",
        eventType: "wedding",
        message: "What does your wedding package cost?",
      },
    });
    const checked = validateDraft(
      req,
      result({ body: "You said your budget was $1,800. What date are you considering?" }),
    );
    expect(checked.issues.join(" ")).toMatch(/ungrounded price.*client/i);
  });

  it("rejects the right number in the wrong currency", () => {
    const checked = validateDraft(
      request(),
      result({ body: "Our wedding package is $1,800. What date are you considering?" }),
    );
    expect(checked.issues.join(" ")).toMatch(/ungrounded price.*USD 1800/i);
  });

  it("does not let a client's budget become the artist's quoted rate", () => {
    const req = request({
      lead: {
        source: "PLAIN_EMAIL",
        eventType: "wedding",
        message: "Our budget is £2,000 — what can that cover?",
      },
    });
    const checked = validateDraft(
      req,
      result({ body: "Our rate is £2,000. What date are you considering?" }),
    );
    expect(checked.issues.join(" ")).toMatch(/ungrounded price.*artist/i);
  });

  it.each([
    "We can do it for $400.",
    "We can make it work within your $400 budget.",
    "$400 works for us.",
  ])("rejects buyer-budget money converted into an artist commitment: %s", (body) => {
    const req = request({
      business: { ...request().business, currency: "USD" },
      lead: {
        source: "PLAIN_EMAIL",
        eventType: "wedding",
        message: "I only have $400. Can you do it?",
      },
    });
    expect(validateDraft(req, result({ body })).issues.join(" ")).toMatch(
      /ungrounded price.*artist/i,
    );
  });

  it("rejects invented bare and word-currency fees", () => {
    const bare = validateDraft(
      request(),
      result({ body: "Our fee is 1,900. What date are you considering?" }),
    );
    expect(bare.issues.join(" ")).toMatch(/ungrounded price.*GBP 1900/i);

    const wordCurrency = validateDraft(
      request(),
      result({ body: "Our fee is 1,800 dollars. What date are you considering?" }),
    );
    expect(wordCurrency.issues.join(" ")).toMatch(/ungrounded price.*USD 1800/i);
  });

  it("derives quote and profile requests from buyer text even when model flags are false", () => {
    const checked = validateDraft(
      request({
        lead: {
          source: "PLAIN_EMAIL",
          eventType: "wedding",
          message: "Could you send your press kit and quote for the wedding?",
        },
      }),
      result({ wantsQuote: false, wantsProfile: false }),
    );
    expect(checked.result).toMatchObject({ wantsQuote: true, wantsProfile: true });
  });

  it("recognizes natural availability claims and blocks them when availability is unknown", () => {
    const works = validateDraft(
      request(),
      result({
        body: "June 3 works perfectly for me. What time does the event start?",
        availabilityStatement: "not_addressed",
      }),
    );
    expect(works.issues).toContain("claims availability that is not known");

    const canDo = validateDraft(
      request({ availability: { state: "timed", busyWindows: ["18:00-20:00"] } }),
      result({
        body: "I can do that date. What time does the event start?",
        availabilityStatement: "not_addressed",
      }),
    );
    expect(canDo.issues).toContain("claims availability that is not known");
  });

  it.each([
    "We can do it for $900, which is the package minimum.",
    "We can’t make it work for your $400 budget.",
    "That package is not available at $400.",
  ])("does not mistake price-fit language for calendar availability: %s", (body) => {
    const checked = validateDraft(
      request({
        business: { ...request().business, currency: "USD" },
        lead: {
          source: "PLAIN_EMAIL",
          eventType: "wedding",
          message: "My budget is $400. Can you do it?",
        },
      }),
      result({ body, availabilityStatement: "affirmed" }),
    );
    expect(checked.result.availabilityStatement).toBe("not_addressed");
    expect(checked.issues).not.toContain("claims availability that is not known");
  });

  it.each([
    "we are absolutely free for your date.",
    "I do have Aug 21 open.",
    "We’re available on Nov 7.",
    "Great news — your date is still open.",
    "I'm free that evening.",
  ])("normalizes live natural availability wording: %s", (body) => {
    const unknown = validateDraft(
      request(),
      result({ body, availabilityStatement: "not_addressed" }),
    );
    expect(unknown.result.availabilityStatement).toBe("affirmed");
    expect(unknown.issues).toContain("claims availability that is not known");

    const free = validateDraft(
      request({ availability: { state: "free" } }),
      result({ body, availabilityStatement: "not_addressed" }),
    );
    expect(free.result.availabilityStatement).toBe("affirmed");
    expect(free.issues).toEqual([]);
  });

  it.each([
    "We're available to chat tomorrow.",
    "I'm free to talk through the package.",
    "We're open to ideas for the playlist.",
  ])("does not mistake conversational availability for calendar availability: %s", (body) => {
    const checked = validateDraft(
      request(),
      result({ body, availabilityStatement: "affirmed" }),
    );
    expect(checked.result.availabilityStatement).toBe("not_addressed");
    expect(checked.issues).toEqual([]);
  });

  it("requires known availability in first-reply prose but not later replies", () => {
    const freeFirst = validateDraft(
      request({ availability: { state: "free" } }),
      result({ body: "Thanks for reaching out. What time does the party begin?" }),
    );
    expect(freeFirst.issues).toContain("does not clearly affirm the open date");

    const conflictFirst = validateDraft(
      request({ availability: { state: "conflict", bookedTitles: ["Private event"] } }),
      result({ body: "Thanks for reaching out. Is your date flexible?" }),
    );
    expect(conflictFirst.issues).toContain("does not clearly disclose the booked date");

    const midThread = validateDraft(
      request({
        availability: { state: "free" },
        thread: [{ direction: "OUTBOUND", body: "Your date is open." }],
      }),
      result({ body: "Yes — the room needs one standard power outlet." }),
    );
    expect(midThread.issues).toEqual([]);

    const followUp = validateDraft(
      request({
        availability: { state: "conflict", bookedTitles: ["Private event"] },
        sequenceStep: 1,
      }),
      result({ body: "Just checking whether your dates have any flexibility." }),
    );
    expect(followUp.issues).toEqual([]);
  });

  it("grounds omitted first-reply availability without changing later replies", () => {
    const firstReq = request({ availability: { state: "free" } });
    const candidate = result({ body: "Hi Jess,\n\nThanks for reaching out." });
    const grounded = groundFirstReplyAvailability(firstReq, candidate);
    expect(grounded.body).toContain("Hi Jess,\n\nGreat news — your date is open.");
    expect(validateDraft(firstReq, grounded).issues).toEqual([]);

    const midReq = request({
      availability: { state: "free" },
      thread: [{ direction: "OUTBOUND", body: "Your date is open." }],
    });
    expect(groundFirstReplyAvailability(midReq, candidate)).toEqual(candidate);
  });

  it("fails closed on smart-apostrophe refusals when the date is unknown or only timed", () => {
    const body = "I can’t do that date.";
    const unknown = validateDraft(request(), result({ body }));
    expect(unknown.result.availabilityStatement).toBe("conflicted");
    expect(unknown.issues).toContain("claims availability that is not known");

    const timed = validateDraft(
      request({ availability: { state: "timed", busyWindows: ["18:00-20:00"] } }),
      result({ body: "I'm unavailable that evening." }),
    );
    expect(timed.result.availabilityStatement).toBe("conflicted");
    expect(timed.issues).toContain("claims availability that is not known");
  });

  it("requires uncertainty for a feature missing from the profile and matching package", () => {
    const req = request({
      lead: {
        source: "PLAIN_EMAIL",
        eventType: "wedding",
        message: "Does the photo booth package include prints?",
      },
    });
    const unsafe = validateDraft(req, result({ body: "Yes, prints are included." }));
    expect(unsafe.issues.join(" ")).toContain("feature");

    const safe = validateDraft(
      req,
      result({ body: "Let me confirm whether prints are included and come straight back to you." }),
    );
    expect(safe.issues).toEqual([]);
  });

  it("does not let unrelated or affirmative 'confirm' wording mask an unsupported feature", () => {
    const req = request({
      lead: {
        source: "PLAIN_EMAIL",
        eventType: "wedding",
        message: "Does the photo booth package include prints?",
      },
    });
    for (const body of [
      "Yes, prints are included. Let me confirm the event timing.",
      "Yes, I can confirm prints are included.",
    ]) {
      expect(validateDraft(req, result({ body })).issues).toContain(
        "confidently promises a feature that is not in the profile or matching package",
      );
    }
    expect(
      validateDraft(
        req,
        result({ body: "Prints are not specified in my setup notes, so let me confirm that detail." }),
      ).issues,
    ).toEqual([]);
    expect(
      validateDraft(
        req,
        result({ body: "Let me confirm the exact photo booth details and come back to you." }),
      ).issues,
    ).toContain("does not name the unsupported feature being checked");
  });

  it("rejects white-label, placeholder, and instruction leaks", () => {
    const checked = validateDraft(
      request(),
      result({
        subject: "Re: Re: [event]",
        body: "As an AI assistant, HARD RULES say the word count should be 100.",
      }),
    );
    expect(checked.issues).toEqual(
      expect.arrayContaining([
        "subject contains duplicate Re:",
        "mentions AI, automation, or an assistant",
        "contains an unresolved placeholder",
        "leaks writing instructions",
      ]),
    );
  });

  it("rejects subjects that cannot safely become an email header", () => {
    const control = validateDraft(
      request(),
      result({ subject: "Wedding reply\nBcc: other@example.com" }),
    );
    expect(control.issues).toContain("subject contains a control character");

    const tooLong = validateDraft(request(), result({ subject: "S".repeat(161) }));
    expect(tooLong.issues).toContain("subject is longer than 160 characters");
  });
});
