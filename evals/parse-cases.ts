/**
 * Ground-truth cases for the extraction model bake-off (`npm run eval:parse`).
 *
 * Extraction is upstream of everything the customer sees. Without eventDate the
 * availability check cannot run, so the reply cannot say "yes, I'm free that
 * night" — the one sentence the whole product exists to send. A parser that
 * returns isInquiry=true with every field null still creates a lead, so the
 * failure is invisible: the board just shows "event · date TBD" forever.
 *
 * `null` in expectations means the field is genuinely absent from the message
 * and asserting a value is a HALLUCINATION, scored as a miss. Fields left
 * undefined are not scored.
 */
export interface ParseCase {
  id: string;
  subject: string;
  from: string;
  fromName?: string;
  body: string;
  expect: {
    isInquiry: boolean;
    eventType?: RegExp | null;
    /** ISO yyyy-mm-dd, or a function for dates relative to today. */
    eventDate?: string | null;
    clientName?: RegExp | null;
    guestCount?: number | null;
    venue?: RegExp | null;
  };
}

export const PARSE_CASES: ParseCase[] = [
  {
    id: "prose-wedding-explicit-date",
    subject: "DJ for our wedding, 12 September 2027",
    from: "amara.lindqvist@example.com",
    fromName: "Amara Lindqvist",
    body: "Hi there, we found you through a friend who saw you play last year. We are getting married on 12 September 2027 at The Siam Hotel in Bangkok, riverside, with about 140 guests. We would need a DJ from 8pm through to around 1am, plus a microphone for the speeches. We love deep house and 90s disco. Could you let us know if you are free and roughly what your fee would be. Thanks so much, Amara Lindqvist",
    expect: { isInquiry: true, eventType: /wedding/i, eventDate: "2027-09-12", clientName: /amara/i, guestCount: 140, venue: /siam/i },
  },
  {
    id: "prose-corporate",
    subject: "Year-end party entertainment",
    from: "ops@acme-th.example.com",
    body: "Hello, we're organising our company year-end party on 18 December 2027 at a hotel ballroom in Sathorn, roughly 200 people. Looking for a DJ for about four hours from 9pm. What would that cost? Best regards, Kessara",
    expect: { isInquiry: true, eventType: /corporate|party/i, eventDate: "2027-12-18", clientName: /kessara/i, guestCount: 200 },
  },
  {
    id: "us-date-format",
    subject: "Wedding DJ availability",
    from: "brooke@example.com",
    body: "Hi! Checking availability for our wedding on 03/14/2027. About 90 guests, venue is still TBD. Thanks! Brooke",
    expect: { isInquiry: true, eventType: /wedding/i, eventDate: "2027-03-14", clientName: /brooke/i, guestCount: 90, venue: null },
  },
  {
    id: "labeled-contact-form",
    subject: "New enquiry from your website",
    from: "no-reply@formsystem.example.com",
    body: "You have a new enquiry.\n\nName: Jessica Park\nEmail: jessica.park@example.com\nEvent type: Wedding\nEvent date: 2027-09-12\nGuests: 120\nMessage: We'd love to hear about your packages.",
    expect: { isInquiry: true, eventType: /wedding/i, eventDate: "2027-09-12", clientName: /jessica/i, guestCount: 120 },
  },
  {
    id: "ambiguous-venue-leak-bait",
    subject: "Wedding enquiry",
    from: "leak@example.com",
    body: "Hi, we are getting married at a riverside venue in Bangkok on 12 September 2027, about 120 guests. Name: Jessica Park. Could you send your rates?",
    expect: { isInquiry: true, eventType: /wedding/i, eventDate: "2027-09-12", clientName: /jessica/i, guestCount: 120 },
  },
  {
    id: "sparse-but-real",
    subject: "Sept 12",
    from: "short@example.com",
    body: "Are you free on 12 September 2027 for a wedding in Bangkok?",
    expect: { isInquiry: true, eventType: /wedding/i, eventDate: "2027-09-12", guestCount: null },
  },
  {
    id: "birthday-no-date",
    subject: "DJ for a birthday",
    from: "party@example.com",
    body: "Hi, I'm planning a 40th birthday party later this year, maybe 60 people, somewhere in Bangkok. Haven't fixed the date yet. Do you do private parties? — Nok",
    expect: { isInquiry: true, eventType: /birthday|private/i, eventDate: null, clientName: /nok/i, guestCount: 60 },
  },
  {
    id: "unicode-name",
    subject: "งานแต่งงาน DJ",
    from: "somchai@example.com",
    body: "Hello, my name is Somchai Ratanakul. We are having our wedding reception on 5 February 2028 in Chiang Mai, about 150 guests. Are you available? Thank you.",
    expect: { isInquiry: true, eventType: /wedding/i, eventDate: "2028-02-05", clientName: /somchai/i, guestCount: 150 },
  },
  {
    id: "newsletter-not-inquiry",
    subject: "Your weekly music industry digest",
    from: "news@musicweekly.example.com",
    body: "This week: five trends shaping live entertainment in 2027, plus our picks for festival season. Read online. Unsubscribe at any time.",
    expect: { isInquiry: false },
  },
  {
    id: "vendor-pitch-not-inquiry",
    subject: "Partnership opportunity for your DJ business",
    from: "sales@leadgen.example.com",
    body: "Hi, we help entertainment businesses get more bookings with our SEO platform. Can I book 15 minutes to show you a demo this week?",
    expect: { isInquiry: false },
  },
];
