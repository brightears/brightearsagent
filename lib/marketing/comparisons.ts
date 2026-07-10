// Comparison-cluster content (bottom-funnel SEO): /compare hub + /compare/[slug] pairwise pages.
// All copy lives here so marketing can edit words without touching page markup.
//
// HONESTY RULES (see docs/PRODUCT-BRIEF.md §4 and docs/MARKETING-PLAN.md Q2):
// - Competitor pricing below is VERIFIED against public pricing pages — never improvise.
// - Be generous to competitors; credibility is the product. Show our own gaps in the same tables.
// - Re-verify quarterly and bump LAST_VERIFIED (the "dated stamp" AI assistants look for).

export const LAST_VERIFIED = "June 11, 2026";

/**
 * Bright Ears pricing — founder-confirmed. Never improvise changes here.
 * ADR-003 tier recut: EVERY tier is the complete assistant (replies, sequences,
 * weekly report, spam filtering, approve-from-phone, Travel Mode, and the same
 * deep research on every plan); tiers gate only capacity and autonomy — inbound
 * inquiry ceiling, cities hunted, auto-send autonomy.
 * Never capability-gate copy.
 */
export const BRIGHT_EARS_PRICING = {
  range: "$25–149/mo",
  // No free trial (founder decision 2026-06-16): subscribe to activate,
  // month-to-month, cancel anytime (lib/marketing/guarantee.ts).
  trial: "Subscribe to activate — month-to-month, cancel anytime",
  tiers: [
    {
      name: "Starter",
      price: "$25/mo",
      includes:
        "answers up to 15 of your inquiries a month, hunts your 1 home city — the complete engine, you approve every send",
    },
    {
      name: "Pro",
      price: "$79/mo",
      includes:
        "answers up to 60 inquiries a month, hunts up to 3 cities, auto-sends from the sources you trust",
    },
    {
      name: "Studio",
      price: "$149/mo",
      includes:
        "answers up to 150 inquiries a month, hunts all your cities, auto-send autopilot",
    },
  ],
  // The proactive Hunt allowance is shared across every plan (it's gated by
  // profile quality, not tier) — disclosed separately so the inbound lead
  // number is never mistaken for the venue-pitch budget. Daily caps in
  // lib/outreach/caps.ts: HOT 10 / WARM 5 / SEED 3 (≤18/day total).
  hunt:
    "Every plan also includes the Hunt: the proactive agent that finds venues hiring entertainment, scores the fit, and drafts outreach in your voice for you to approve — up to ~10 venue pitches a day.",
  // NOTE (audit C3): we deliberately do NOT advertise a buyable lead-pack here.
  // The product PAUSES drafting at the cap and prompts an upgrade — it never
  // surprise-bills. A real $10/10-leads top-up is a deferred founder option
  // (no purchase flow is built); revisit this copy if/when it ships.
  overage:
    "Need more? Move up a plan in one click. At your cap, drafting pauses for the month — never a surprise bill.",
} as const;

/**
 * One-line roadmap honesty (ADR-003 Stage 1: publish the money path; the
 * designed boundary is the booking). Rendered directly under the hub roundup
 * table on /compare.
 */
export const ROADMAP_LINE =
  "On our public roadmap: quote → e-sign → deposit links, shipping next — we stop at the booking today, on purpose.";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoundupEntry = {
  name: string;
  /** Verified price range, e.g. "$20–50/mo" */
  price: string;
  builtFor: string;
  shines: string;
  stops: string;
  /** Link to the pairwise page, when one exists */
  slug?: ComparisonSlug;
  isBrightEars?: boolean;
};

export type TableMark = "yes" | "partial" | "no" | "na";

export type TableCell = { mark: TableMark; note: string };

export type ComparisonRow = { feature: string; them: TableCell; us: TableCell };

export type Faq = { question: string; answer: string };

export type ComparisonPage = {
  slug: ComparisonSlug;
  /** Competitor display name (the "them" column) */
  competitor: string;
  competitorPrice: string;
  /** <title> + meta description */
  title: string;
  metaDescription: string;
  /** Card shown on the /compare hub grid */
  cardTitle: string;
  cardBlurb: string;
  heroEyebrow: string;
  heroHeading: string;
  heroSub: string;
  greatAtHeading: string;
  greatAtIntro: string;
  greatAt: { point: string; detail: string }[];
  tableHeading: string;
  rows: ComparisonRow[];
  fitHeading: string;
  fitParagraphs: string[];
  fitPullQuote?: { quote: string; source: string };
  /** Only on the "alternatives" roundup-style page */
  alternativesHeading?: string;
  alternativesIntro?: string;
  alternatives?: { name: string; price: string; take: string; slug?: ComparisonSlug }[];
  faqs: Faq[];
  ctaHeading: string;
  ctaSub: string;
};

export const COMPARISON_SLUGS = [
  "dj-event-planner",
  "gigbuilder",
  "vibo",
  "check-cherry",
  "honeybook",
  "dj-event-planner-alternatives",
] as const;

export type ComparisonSlug = (typeof COMPARISON_SLUGS)[number];

// ---------------------------------------------------------------------------
// JSON-LD helper (see node_modules/next/dist/docs/01-app/02-guides/json-ld.md —
// escape "<" to prevent XSS via JSON.stringify)
// ---------------------------------------------------------------------------

export function faqJsonLd(faqs: Faq[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }).replace(/</g, "\\u003c");
}

// ---------------------------------------------------------------------------
// Hub: the honest roundup table
// ---------------------------------------------------------------------------

export const ROUNDUP: RoundupEntry[] = [
  {
    name: "DJ Event Planner",
    price: "$20–50/mo",
    builtFor: "The DJ-business back office: contracts, invoicing, event workflow, employee scheduling.",
    shines:
      "Roughly two decades of DJ-specific depth nothing else matches. Multi-op operators run their whole business on it.",
    stops:
      "No AI, no public API, and it won't answer a lead for you. The codebase shows its ~20 years.",
    slug: "dj-event-planner",
  },
  {
    name: "GigBuilder",
    price: "$25–50/mo",
    builtFor: "Affordable all-in-one booking management with an AI writing helper.",
    shines:
      "A lot of surface for the money — website, booking flow, planning forms — and it put AI in front of DJs early.",
    stops:
      "The AI helps you write when you sit down; it doesn't watch your inbox or reply for you. Infrastructure feels dated.",
    slug: "gigbuilder",
  },
  {
    name: "Vibo",
    price: "$149–179/mo",
    builtFor: "The client music-planning experience: requests, timelines, must-plays, guest input.",
    shines:
      "Couples genuinely love it, and DJs are proud to send the invite. Best-in-class at what it does.",
    stops: "It starts after the contract is signed. Nothing for leads.",
    slug: "vibo",
  },
  {
    name: "Check Cherry",
    price: "$29–139/mo",
    builtFor: "Modern booking forms, packages, proposals and payments.",
    shines: "The cleanest form-and-package experience in the category — a flow couples actually finish.",
    stops: "It captures inquiries beautifully — then the replying and chasing is still you.",
    slug: "check-cherry",
  },
  {
    name: "HoneyBook",
    price: "$36–129/mo",
    builtFor: "Horizontal CRM for all service businesses, with AI drafts inside its own inbox.",
    shines: "The most polished generalist on this list: contracts, invoices, payments, automations.",
    stops:
      "The AI only works inside HoneyBook's inbox — a full migration first — and nothing in it is DJ-specific.",
    slug: "honeybook",
  },
  {
    name: "Mikla.ai",
    price: "$149–499/mo",
    builtFor: "AI receptionist for wedding venues — now selling the same answering job to DJs and live bands.",
    shines:
      "The proven category leader for venues: sub-minute replies (38–41 seconds), and its $249 tier bundles contracts, e-sign and deposit collection.",
    stops:
      "Venue economics. Entry is $149/mo for 50 leads — 6x our price for the same answering job — and it's sold through demo calls, with no self-serve trial.",
  },
  {
    name: "Bright Ears",
    price: "$25–149/mo",
    builtFor:
      "Finding gigs and winning them for any event — weddings, corporate, parties, residencies — the only tool here that hunts venues for you AND answers your leads.",
    shines:
      "A proactive agent scans the web for venues that fit you and drafts the outreach in your voice for you to approve — and when an inquiry comes in, it drafts the reply in minutes too. Travel Mode even hunts gigs in the cities you tour to, for the dates you're there. Follow-ups run until booked or dead, everything sent from your own mailbox.",
    stops:
      "At the booking — by design. Contracts, invoices and music planning stay with your favorite tool above; one forwarding rule bolts us on.",
    isBrightEars: true,
  },
];

export const HUB_FAQS: Faq[] = [
  {
    question: "What's the best DJ booking software in 2026?",
    answer:
      "Honestly: it depends on the job. For contracts, invoicing and deep event workflow, DJ Event Planner ($20–50/mo) is still the workhorse. For modern booking forms and proposals, Check Cherry ($29–139/mo). For client music planning after the booking, Vibo ($149–179/mo). For an all-in-one generalist CRM, HoneyBook ($36–129/mo). For an AI receptionist at venue budgets, Mikla.ai ($149–499/mo) leads that category for wedding venues and now sells to DJs. If the thing that hurts is quiet weeks with no new gigs coming in — or leads going cold before you can reply — that's the job Bright Ears was built for ($25–149/mo, subscribe to activate): it proactively hunts venues that fit you and drafts the outreach, AND it answers inbound for any event type, and it pairs with any of the above.",
  },
  {
    question: "Isn't this comparison biased? You make one of these tools.",
    answer:
      "We make the AI inbox, so read everything here with that in mind. To keep ourselves honest we publish verified pricing with a 'last verified' date, credit competitors where they're better than us (which is often — we don't do contracts, invoicing or music planning), and show our own gaps in the same tables.",
  },
  {
    question: "Do I have to replace my current software to use Bright Ears?",
    answer:
      "No. Bright Ears is a bolt-on, not a migration. One email forwarding rule sends your lead notifications — website forms, plain email, The Knot, WeddingWire, Bark, GigSalad — to your Bright Ears address. No password sharing, no OAuth, and booked gigs go back into whatever runs your business today.",
  },
  {
    question: "How was the pricing on this page verified?",
    answer:
      "We checked each vendor's public pricing page in June 2026 and recorded the range across their published tiers. Pricing changes — if you spot a stale number, tell us and we'll re-verify and update the stamp.",
  },
  {
    question: "What does Bright Ears cost?",
    answer:
      "Starter at $25/mo (answers up to 15 of your inbound inquiries a month, hunts your 1 home city, you approve every send), Pro at $79/mo (up to 60 inquiries/mo, hunts up to 3 cities, auto-sends from the sources you trust), or Studio at $149/mo (up to 150 inquiries/mo, hunts all your cities, auto-send autopilot). Every tier is the complete engine — the same deep research on every plan: the proactive Hunt agent that finds venues for you and drafts the outreach for you to approve, plus replies to every inbound inquiry in your voice, follow-up sequences until booked-or-dead, weekly report, Travel Mode and spam filtering — the tiers only change how many inquiries it answers, how many cities it hunts and how much it auto-sends. At your cap, drafting pauses for the month and we prompt an upgrade — never a surprise bill. You subscribe to activate — month-to-month, cancel anytime.",
  },
  {
    question: "Does Bright Ears do quotes, contracts or deposits?",
    answer:
      "Not yet — we stop at the booking today, on purpose, and hand off to the tools above for paperwork and payments. On our public roadmap: quote → e-sign → deposit links, shipping next. In the meantime you can attach your existing booking, contract or deposit page, and our replies and follow-ups carry that link to the couple.",
  },
];

// ---------------------------------------------------------------------------
// Shared row sets
// ---------------------------------------------------------------------------

/** DJ Event Planner vs Bright Ears — used on both the pairwise and the alternatives page. */
const DJEP_ROWS: ComparisonRow[] = [
  {
    feature: "Finds gigs for you (the Hunt)",
    them: { mark: "no", note: "CRM for leads that arrive; it doesn't go find them." },
    us: {
      mark: "yes",
      note: "Scans your cities for venues that book entertainment, scores the fit, drafts the pitch in your voice — you approve.",
    },
  },
  {
    feature: "Answers new inquiries for you",
    them: { mark: "no", note: "Inquiries land in your inbox; the reply is on you." },
    us: {
      mark: "yes",
      note: "Drafted in your voice, from your rate card, aware of your real availability.",
    },
  },
  {
    feature: "Speed to first reply",
    them: { mark: "no", note: "As fast as you can get to a keyboard." },
    us: { mark: "yes", note: "In minutes once you tap Approve." },
  },
  {
    feature: "Reads The Knot / WeddingWire / Bark / GigSalad lead emails",
    them: { mark: "no", note: "Directory notifications sit in your inbox like any other email." },
    us: { mark: "yes", note: "Parsed automatically via one forwarding rule." },
  },
  {
    feature: "Spam & scam filtering",
    them: { mark: "no", note: "Not part of the product." },
    us: { mark: "yes", note: "Junk is filtered before your phone ever buzzes." },
  },
  {
    feature: "Follow-up until booked or dead",
    them: {
      mark: "partial",
      note: "Scheduled emails exist; chase-until-booked with automatic stops isn't the design.",
    },
    us: {
      mark: "yes",
      note: "Sequences run until booked or dead, hard-stop the moment they reply, one-tap opt-out compliance.",
    },
  },
  {
    feature: "Approve from your phone",
    them: { mark: "partial", note: "There's mobile access to the CRM; it's built for the office desk." },
    us: { mark: "yes", note: "Push notification → read the draft → approve, edit or decline." },
  },
  {
    feature: "Contracts & e-signatures",
    them: { mark: "yes", note: "Mature, deep, DJ-specific — the reason people stay a decade." },
    us: { mark: "no", note: "Not our job. Keep DJ Event Planner for this." },
  },
  {
    feature: "Invoicing & payments",
    them: { mark: "yes", note: "Battle-tested over roughly 20 years." },
    us: { mark: "no", note: "Same answer — keep DJEP." },
  },
  {
    feature: "Event workflow & scheduling",
    them: { mark: "yes", note: "Planning forms, equipment, employee scheduling — unmatched depth." },
    us: { mark: "no", note: "We stop at the booking." },
  },
  {
    feature: "Setup",
    them: { mark: "na", note: "Already your system of record — nothing changes." },
    us: { mark: "na", note: "One email forwarding rule. No password sharing, no OAuth, nothing migrates." },
  },
  {
    feature: "Verified pricing (June 2026)",
    them: { mark: "na", note: "$20–50/mo" },
    us: { mark: "na", note: "$25–149/mo · subscribe to activate" },
  },
];

// ---------------------------------------------------------------------------
// Pairwise pages
// ---------------------------------------------------------------------------

const DJ_EVENT_PLANNER: ComparisonPage = {
  slug: "dj-event-planner",
  competitor: "DJ Event Planner",
  competitorPrice: "$20–50/mo",
  title: "Bright Ears vs DJ Event Planner (2026): Keep the CRM, Add the AI Inbox",
  metaDescription:
    "DJ Event Planner runs your paperwork. Bright Ears finds gigs and answers your inquiries in your voice — you approve. Honest table, verified pricing.",
  cardTitle: "vs DJ Event Planner",
  cardBlurb: "Keep the 20-year workhorse CRM — add the AI inbox it never had.",
  heroEyebrow: "Bright Ears vs DJ Event Planner",
  heroHeading: "Keep DJ Event Planner. Add the part it never had.",
  heroSub:
    "This isn't really a versus. DJ Event Planner runs the business behind your gigs better than almost anything. It just doesn't answer the lead that came in while you were mid-set. That's us.",
  greatAtHeading: "What DJ Event Planner is great at",
  greatAtIntro:
    "Credit where it's due — DJEP has been the multi-op workhorse for roughly two decades, and the depth shows.",
  greatAt: [
    {
      point: "Contracts, invoicing and e-signatures",
      detail:
        "The paperwork engine is mature, battle-tested and DJ-specific. This is the core reason people stay for a decade.",
    },
    {
      point: "Deep event workflow",
      detail:
        "Planning forms, timelines, equipment, employee scheduling — multi-op operators run their whole calendar on it.",
    },
    {
      point: "Honest pricing",
      detail: "$20–50/mo (verified June 2026) for that much functionality is genuinely fair.",
    },
    {
      point: "A 20-year track record",
      detail: "It's not going anywhere, and its user community knows every corner of it.",
    },
  ],
  tableHeading: "Side by side",
  rows: DJEP_ROWS,
  fitHeading: "Where Bright Ears fits",
  fitParagraphs: [
    "Bright Ears is not a DJ Event Planner replacement, and we don't want to be one. We don't do contracts, invoices or event workflow. We do the two jobs DJEP doesn't: the Hunt proactively finds venues that book entertainment in your cities and drafts the outreach in your voice for you to approve — and when an inquiry arrives (website form, plain email, or a The Knot / WeddingWire / Bark / GigSalad notification), we filter the spam and draft the reply from your rate card and real availability, designed to go out within minutes of your tap. Follow-ups run until the lead is booked or gone quiet, with one-tap opt-out compliance.",
    "Setup is a single forwarding rule — no password sharing, no OAuth, and nothing about your DJEP setup changes. When the gig books, you run it in DJ Event Planner exactly the way you do today.",
  ],
  fitPullQuote: {
    quote:
      "I want to automate this. I've looked into DJ Intelligence, SMPL, and DJEP — none of them integrate with Zapier.",
    source: "a mobile DJ writing the spec for us, r/mobileDJ",
  },
  faqs: [
    {
      question: "Is Bright Ears a replacement for DJ Event Planner?",
      answer:
        "No. We don't do contracts, invoicing, planning forms or event workflow — DJ Event Planner is excellent at those. Bright Ears handles the lead-response layer DJEP doesn't: filtering, answering and chasing inquiries until they're booked or dead, with you approving every reply from your phone.",
    },
    {
      question: "Does Bright Ears integrate with DJ Event Planner?",
      answer:
        "No integration is needed, which is the point. Bright Ears works on the email layer: one forwarding rule sends your lead notifications to your Bright Ears address, replies go out under your business name, and the client's answers route straight back to you. Booked gigs go into DJEP the way they always have — there's no API hookup to break (DJEP has no public API anyway).",
    },
    {
      question: "Does DJ Event Planner have AI replies?",
      answer:
        "Not as of June 2026. DJEP's strength is workflow depth, but the codebase is roughly 20 years old and there is no AI drafting or automatic lead response built in.",
    },
    {
      question: "What does running both cost?",
      answer:
        "DJ Event Planner runs $20–50/mo depending on tier (verified June 2026). Bright Ears starts at $25/mo for up to 15 inquiries answered — the complete assistant, follow-up sequences and weekly report included — with Pro at $79/mo (up to 60 inquiries, auto-send autopilot) and Studio at $149/mo (up to 150 inquiries, hunts all your cities). Against a $1,500–3,000 booked wedding, one save covers both for a long time.",
    },
    {
      question: "Can I add Bright Ears without touching my DJEP setup?",
      answer:
        "Yes. Starting Bright Ears changes nothing in DJEP — subscribe to activate, add the forwarding rule, and drafts start appearing. It's month-to-month: if it's not for you, cancel anytime and delete the rule, and everything is exactly as it was.",
    },
  ],
  ctaHeading: "Add the AI that hunts gigs and answers leads in front of your DJEP",
  ctaSub: "It hunts venues for you AND answers every inquiry — you just approve.",
};

const GIGBUILDER: ComparisonPage = {
  slug: "gigbuilder",
  competitor: "GigBuilder",
  competitorPrice: "$25–50/mo",
  title: "Bright Ears vs GigBuilder (2026): AI That Writes for You vs AI That Answers for You",
  metaDescription:
    "GigBuilder is booking-site tooling. Bright Ears hunts venues for you and drafts every reply in your voice — you approve. Honest comparison, verified pricing.",
  cardTitle: "vs GigBuilder",
  cardBlurb: "AI that helps you write vs AI that answers while you're mid-set.",
  heroEyebrow: "Bright Ears vs GigBuilder",
  heroHeading: "AI that helps you write — or AI that answers while you're on a gig?",
  heroSub:
    "GigBuilder put AI in front of working DJs early, and it deserves credit for that. The difference is where the AI sits: theirs waits for you to sit down and write. Ours has the reply drafted before you've even seen the inquiry.",
  greatAtHeading: "What GigBuilder is great at",
  greatAtIntro:
    "GigBuilder gets real credit for putting affordable, DJ-shaped tools — including AI — in front of working DJs.",
  greatAt: [
    {
      point: "All-in-one on a budget",
      detail:
        "$25–50/mo (verified June 2026) covers a website, booking system, planning forms and client portal — a lot of surface for the money.",
    },
    {
      point: "An AI writing helper",
      detail:
        "Earlier than most DJ tools to add AI assistance for writing — genuinely useful when you're staring at a blank reply box.",
    },
    {
      point: "Planning forms and a client portal",
      detail:
        "Clients can fill in music and event details online, and the booking flow is proven with working mobile DJs.",
    },
  ],
  tableHeading: "Side by side",
  rows: [
    {
      feature: "Finds gigs for you (the Hunt)",
      them: { mark: "no", note: "Booking-site tooling — it waits for inquiries to arrive." },
      us: {
        mark: "yes",
        note: "Scans your cities for venues that book entertainment, scores the fit, drafts the pitch in your voice — you approve.",
      },
    },
    {
      feature: "Answers new inquiries for you",
      them: { mark: "partial", note: "An AI helper assists when you sit down to write." },
      us: { mark: "yes", note: "The reply is drafted before you've opened the inbox — you just approve it." },
    },
    {
      feature: "Speed to first reply",
      them: { mark: "no", note: "Still limited by when you can get to a keyboard." },
      us: { mark: "yes", note: "In minutes once you tap Approve." },
    },
    {
      feature: "Reads The Knot / WeddingWire / Bark / GigSalad lead emails",
      them: { mark: "no", note: "Built around its own websites and booking forms." },
      us: { mark: "yes", note: "One forwarding rule catches forms, plain email and directory notifications." },
    },
    {
      feature: "Spam & scam filtering",
      them: { mark: "no", note: "Not part of the product." },
      us: { mark: "yes", note: "Junk is filtered before your phone ever buzzes." },
    },
    {
      feature: "Follow-up until booked or dead",
      them: {
        mark: "partial",
        note: "Email tools exist; booked-or-dead chasing with hard stops isn't the centerpiece.",
      },
      us: { mark: "yes", note: "Sequences run until booked or dead, stop instantly on a reply, one-tap opt-out." },
    },
    {
      feature: "Approve from your phone",
      them: { mark: "partial", note: "Web access anywhere — but the writing still waits for you." },
      us: { mark: "yes", note: "Push notification → approve, edit or decline in two taps." },
    },
    {
      feature: "Contracts & payments",
      them: { mark: "yes", note: "Included in the booking workflow." },
      us: { mark: "no", note: "Not our job — keep GigBuilder (or your contract tool) for this." },
    },
    {
      feature: "Client planning forms & portal",
      them: { mark: "yes", note: "A long-standing strength — clients fill music and event details online." },
      us: { mark: "no", note: "We stop at the booking." },
    },
    {
      feature: "Setup",
      them: { mark: "na", note: "Its own ecosystem: website, forms, planner." },
      us: { mark: "na", note: "A forwarding rule in front of whatever you keep. Nothing migrates." },
    },
    {
      feature: "Verified pricing (June 2026)",
      them: { mark: "na", note: "$25–50/mo" },
      us: { mark: "na", note: "$25–149/mo · subscribe to activate" },
    },
  ],
  fitHeading: "Where Bright Ears fits",
  fitParagraphs: [
    "An AI writing helper still needs you at the keyboard — and the whole problem is that the inquiry lands while you're at a gig, asleep, or at your day job. Couples book whoever replies first. Bright Ears watches the inbox itself: spam filtered out, a reply drafted in your voice from your rate card and real availability, pushed to your phone. You tap Approve. Designed to reply in under 5 minutes.",
    "And it doesn't stop at one reply — follow-ups run until the lead is booked or dead, with hard stops the moment they answer and one-tap opt-out compliance. GigBuilder stays a fine place to run your website and booking flow; we sit in front of any inbox with one forwarding rule. No migration, no password sharing, no OAuth.",
  ],
  fitPullQuote: {
    quote: "I can't always text the lead within 5 minutes.",
    source: "a working mobile DJ, on why inquiries go cold",
  },
  faqs: [
    {
      question: "What's the actual difference between GigBuilder's AI and Bright Ears?",
      answer:
        "GigBuilder's AI is a writing helper: when you sit down to reply, it helps you draft. Bright Ears is an answering layer: the reply is drafted from your rate card and availability before you've opened the inbox, and you approve it from your phone. The difference matters exactly when you can't be at a keyboard — which is when most leads arrive.",
    },
    {
      question: "Can I use Bright Ears alongside my GigBuilder site?",
      answer:
        "Yes. Forward your lead notification emails — from your site's form, plain email, or The Knot / WeddingWire / Bark / GigSalad — to your Bright Ears address. One forwarding rule, no password sharing, no OAuth, and drafts start appearing.",
    },
    {
      question: "Is GigBuilder cheaper than Bright Ears?",
      answer:
        "Their published range is $25–50/mo (verified June 2026); ours is $25–149/mo depending on how many of your inquiries it answers each month. At the entry tier the price is the same — what you pay for as you grow is a higher ceiling on inquiries answered and chased, so at your cap we pause rather than surprise-bill you.",
    },
    {
      question: "Will clients ever see that an AI replied?",
      answer:
        "No. Replies go out under your business name, in your voice, and the client's answers route straight back to you. You approve everything before it sends, and there's no AI branding anywhere a client can see.",
    },
  ],
  ctaHeading: "Find the next gig and answer the last one — keep your hands on the faders",
  ctaSub: "It hunts venues for you AND answers every inquiry — you just approve.",
};

const VIBO: ComparisonPage = {
  slug: "vibo",
  competitor: "Vibo",
  competitorPrice: "$149–179/mo",
  title: "Bright Ears vs Vibo (2026): Before the Booking vs After It",
  metaDescription:
    "Vibo shines after the contract is signed. Bright Ears works before it: finds venues, drafts pitches and replies in your voice. Honest side-by-side.",
  cardTitle: "vs Vibo",
  cardBlurb: "Vibo owns everything after the booking. We exist to get you the booking.",
  heroEyebrow: "Bright Ears vs Vibo",
  heroHeading: "Vibo owns the party planning. We get you the party.",
  heroSub:
    "Easiest comparison on this site: there's almost zero overlap. Vibo starts working after the couple books you. Bright Ears exists to make sure they book you.",
  greatAtHeading: "What Vibo is great at",
  greatAtIntro:
    "We'll say it plainly: if music planning with clients is your bottleneck, buy Vibo. It leads its category for a reason.",
  greatAt: [
    {
      point: "The client music experience",
      detail:
        "Song requests, must-plays and don't-plays, timelines, guest input — couples genuinely enjoy it, and it makes you look professional.",
    },
    {
      point: "An app DJs are proud to send",
      detail:
        "Sending a Vibo invite signals you run a real operation. It's a closing asset as much as a planning tool.",
    },
    {
      point: "Worth its price for the right business",
      detail:
        "$149–179/mo (verified June 11, 2026 — the old $99 tier is gone) is premium, but it's priced against the client experience it delivers, and steady-volume businesses get their money's worth.",
    },
  ],
  tableHeading: "Side by side",
  rows: [
    {
      feature: "Finds gigs for you (the Hunt)",
      them: { mark: "no", note: "Event-experience app for booked gigs; no lead generation." },
      us: {
        mark: "yes",
        note: "Scans your cities for venues that book entertainment, scores the fit, drafts the pitch in your voice — you approve.",
      },
    },
    {
      feature: "Answers new inquiries for you",
      them: { mark: "no", note: "Vibo starts after the contract is signed." },
      us: { mark: "yes", note: "Drafted in your voice from your rate card and real availability." },
    },
    {
      feature: "Speed to first reply",
      them: { mark: "no", note: "Not its job." },
      us: { mark: "yes", note: "In minutes once you tap Approve." },
    },
    {
      feature: "Reads The Knot / WeddingWire / Bark / GigSalad lead emails",
      them: { mark: "no", note: "Vibo never touches your inbox." },
      us: { mark: "yes", note: "One forwarding rule catches forms, plain email and directory notifications." },
    },
    {
      feature: "Follow-up until booked or dead",
      them: { mark: "no", note: "It reminds clients about music planning, not leads about booking you." },
      us: { mark: "yes", note: "Sequences until booked or dead, hard-stop on reply, one-tap opt-out." },
    },
    {
      feature: "Spam & scam filtering",
      them: { mark: "no", note: "Not its job either." },
      us: { mark: "yes", note: "Junk filtered before you see it." },
    },
    {
      feature: "Works from your phone",
      them: { mark: "partial", note: "Great mobile apps — for planning the music." },
      us: { mark: "yes", note: "Approve, edit or decline replies in two taps." },
    },
    {
      feature: "Client music planning",
      them: { mark: "yes", note: "Best-in-class: requests, must-plays, timelines, guest input." },
      us: { mark: "no", note: "We hand off the moment it's booked. Vibo takes it from there." },
    },
    {
      feature: "Event-day experience",
      them: { mark: "yes", note: "The polish couples remember." },
      us: { mark: "no", note: "Not our lane." },
    },
    {
      feature: "Setup",
      them: { mark: "na", note: "A client-facing app you invite couples into." },
      us: { mark: "na", note: "An email forwarding rule couples never see." },
    },
    {
      feature: "Verified pricing (June 11, 2026)",
      them: { mark: "na", note: "$149–179/mo" },
      us: { mark: "na", note: "$25–149/mo · subscribe to activate" },
    },
  ],
  fitHeading: "Where Bright Ears fits",
  fitParagraphs: [
    "Vibo's product begins at the contract. Everything before that — the inquiry from The Knot at 11pm, the spam, the price-shoppers, the follow-up nobody has time to send — is exactly the part Bright Ears does. Replies drafted in your voice from your rate card and real availability, approved from your phone, designed to reply in under 5 minutes, then follow-ups until the lead is booked or dead.",
    "Run both and the handoff is clean: we chase the lead until it books; you send the Vibo invite the moment it does. More signed contracts in, more great parties out.",
  ],
  fitPullQuote: {
    quote: "If there were two of me, I would double my business.",
    source: "every busy DJ owner, eventually",
  },
  faqs: [
    {
      question: "Do Vibo and Bright Ears compete?",
      answer:
        "No. Vibo is client music planning after the booking; Bright Ears is lead response before it. Plenty of businesses should run both: Bright Ears gets the contract signed, Vibo makes the event great.",
    },
    {
      question: "Does Vibo help me win more leads?",
      answer:
        "Indirectly — a slick planning experience helps referrals, and DJs use the Vibo invite as a selling point in proposals. But Vibo doesn't watch your inbox, filter spam, or reply to The Knot leads. The couple who never hears back never gets to see your Vibo.",
    },
    {
      question: "Why is Vibo so much more expensive than most DJ software?",
      answer:
        "It's priced as a client-experience product ($149–179/mo, verified June 11, 2026 — the old $99 tier is gone), and for businesses with steady bookings it earns it. Bright Ears prices on inquiries answered instead: $25/mo for up to 15, $79/mo for up to 60 with auto-send autopilot, $149/mo for up to 150 with the hunt on all your cities — and every tier includes the full follow-up engine and weekly report.",
    },
    {
      question: "If I can only afford one, which should I buy?",
      answer:
        "Depends where gigs die for you. If inquiries get answered fast but events feel chaotic, buy Vibo. If you're a great performer whose leads go quiet before you can reply — 'get an inquiry, immediately respond, and then nothing' — fix that first. It's the cheaper fix and one saved booking pays for it many times over.",
    },
  ],
  ctaHeading: "Get more contracts for Vibo to plan",
  ctaSub: "It hunts new venues for you AND answers every inquiry — you just approve.",
};

const CHECK_CHERRY: ComparisonPage = {
  slug: "check-cherry",
  competitor: "Check Cherry",
  competitorPrice: "$29–139/mo",
  title: "Bright Ears vs Check Cherry (2026): Capturing Leads vs Answering Them",
  metaDescription:
    "Check Cherry makes clean booking forms. Bright Ears finds gigs and answers inquiries in your voice before the form matters. Honest table, real pricing.",
  cardTitle: "vs Check Cherry",
  cardBlurb: "Beautiful forms capture leads. They still can't reply on your behalf.",
  heroEyebrow: "Bright Ears vs Check Cherry",
  heroHeading: "Check Cherry catches the lead. We answer it.",
  heroSub:
    "Modern forms, clean packages, a booking flow couples actually finish — Check Cherry earns its fans. The form just can't reply on your behalf. That's the part we built.",
  greatAtHeading: "What Check Cherry is great at",
  greatAtIntro:
    "Of the modern, DJ-friendly booking tools, Check Cherry might be the most tasteful. Real credit:",
  greatAt: [
    {
      point: "Modern booking forms and packages",
      detail:
        "The cleanest form-and-package experience in the space — clear options, add-ons and availability, all couple-friendly.",
    },
    {
      point: "Proposals, contracts and payments",
      detail: "The path from inquiry to signed-and-paid is smooth and looks professional throughout.",
    },
    {
      point: "Fair pricing",
      detail:
        "$29–139/mo across its published tiers (verified June 11, 2026) — reasonable for that polished a booking front-end.",
    },
  ],
  tableHeading: "Side by side",
  rows: [
    {
      feature: "Finds gigs for you (the Hunt)",
      them: { mark: "no", note: "Booking workflow for clients who already found you." },
      us: {
        mark: "yes",
        note: "Scans your cities for venues that book entertainment, scores the fit, drafts the pitch in your voice — you approve.",
      },
    },
    {
      feature: "Answers new inquiries for you",
      them: { mark: "no", note: "Forms capture the inquiry beautifully; the personal reply is still you." },
      us: { mark: "yes", note: "Drafted in your voice from your rate card and real availability." },
    },
    {
      feature: "Speed to first reply",
      them: { mark: "no", note: "Whenever you next sit down." },
      us: { mark: "yes", note: "In minutes once you tap Approve." },
    },
    {
      feature: "Reads The Knot / WeddingWire / Bark / GigSalad lead emails",
      them: { mark: "no", note: "Home turf is its own forms and pages; directory emails sit outside it." },
      us: { mark: "yes", note: "One forwarding rule catches forms — Check Cherry's included — and directory leads." },
    },
    {
      feature: "Spam & scam filtering",
      them: { mark: "no", note: "Not part of the product." },
      us: { mark: "yes", note: "Junk filtered before your phone buzzes." },
    },
    {
      feature: "Follow-up until booked or dead",
      them: {
        mark: "partial",
        note: "Workflow emails around bookings exist; a chase-until-booked engine it is not.",
      },
      us: { mark: "yes", note: "Sequences until booked or dead, hard-stop on reply, one-tap opt-out." },
    },
    {
      feature: "Approve from your phone",
      them: { mark: "partial", note: "Mobile-friendly — but replies are still typing." },
      us: { mark: "yes", note: "Two taps: read the draft, approve." },
    },
    {
      feature: "Booking forms & packages",
      them: { mark: "yes", note: "The cleanest in the category — a flow couples actually finish." },
      us: { mark: "no", note: "We don't do forms. Keep Check Cherry's." },
    },
    {
      feature: "Proposals, contracts & payments",
      them: { mark: "yes", note: "Smooth and professional end to end." },
      us: { mark: "no", note: "Not our job." },
    },
    {
      feature: "Setup",
      them: { mark: "na", note: "Your booking front-end — it replaces your forms and checkout." },
      us: { mark: "na", note: "A forwarding rule behind any front-end, including Check Cherry's." },
    },
    {
      feature: "Verified pricing (June 11, 2026)",
      them: { mark: "na", note: "$29–139/mo" },
      us: { mark: "na", note: "$25–149/mo · subscribe to activate" },
    },
  ],
  fitHeading: "Where Bright Ears fits",
  fitParagraphs: [
    "A great form raises conversion on people who fill out forms. Two problems remain. First, the reply: the couple who submits at 11:40pm is shopping three other DJs, and if your answer comes tomorrow afternoon, you're the fifth DJ to reach out. Second, not every lead arrives through your form — The Knot, WeddingWire, Bark and GigSalad notifications land in plain email, where no form can help.",
    "Bright Ears sits behind both. Forward your notifications — Check Cherry's included — and every inquiry gets spam-checked and answered in your voice, from your rate card, with your real availability. You approve from your phone; follow-ups run until booked or dead. Keep Check Cherry for the proposal and the payment — that handoff is exactly how it should work.",
  ],
  fitPullQuote: {
    quote: "You don't want to be the 5th DJ that reaches out.",
    source: "wedding DJ forum wisdom — and it's true",
  },
  faqs: [
    {
      question: "Does Check Cherry answer inquiries automatically?",
      answer:
        "Check Cherry is built to capture and book: forms, packages, proposals, contracts, payments. The personalized reply to a new inquiry — and the follow-up when the couple goes quiet — is still on you. That's the layer Bright Ears adds.",
    },
    {
      question: "Can I run Bright Ears with Check Cherry?",
      answer:
        "Yes, and it's a natural pairing. One forwarding rule sends new-inquiry notifications to Bright Ears; we reply in your voice within minutes and chase until booked or dead; the booking itself flows through Check Cherry as usual. No integration to maintain, no password sharing, no OAuth.",
    },
    {
      question: "Which is cheaper?",
      answer:
        "They're comparable. Check Cherry runs $29–139/mo across its tiers (verified June 11, 2026). Bright Ears is $25–149/mo by how many inquiries it answers — Starter $25 (up to 15), Pro $79 (up to 60, auto-send autopilot), Studio $149 (up to 150, hunts all your cities) — with the full follow-up engine and weekly report in every tier. At your cap, drafting pauses — never a surprise bill.",
    },
    {
      question: "Do I still need nice booking forms if replies are instant?",
      answer:
        "Yes — they do different jobs. Forms qualify and convert; speed wins the shortlist. Many vendors never respond to inquiries at all, and couples book whoever replies first. Fast and polished together beat either one alone.",
    },
  ],
  ctaHeading: "Find the gigs your forms never see — and answer the ones they catch",
  ctaSub: "It hunts venues for you AND answers every inquiry — you just approve.",
};

const HONEYBOOK: ComparisonPage = {
  slug: "honeybook",
  competitor: "HoneyBook",
  competitorPrice: "$36–129/mo",
  title: "Bright Ears vs HoneyBook (2026): Bolt-On AI Inbox vs Full-CRM Migration",
  metaDescription:
    "HoneyBook is a CRM you migrate into. Bright Ears bolts on: it finds venues and answers your inquiries in your voice. Honest comparison, verified pricing.",
  cardTitle: "vs HoneyBook",
  cardBlurb: "Full-CRM migration with AI inside — or one forwarding rule in front of what you have.",
  heroEyebrow: "Bright Ears vs HoneyBook",
  heroHeading: "Move your whole business — or add one forwarding rule?",
  heroSub:
    "HoneyBook is the most polished generalist CRM on this site, and its AI really does draft replies. The catch is the word 'inside': everything works once your whole business lives in HoneyBook. Bright Ears works in front of whatever you already run.",
  greatAtHeading: "What HoneyBook is great at",
  greatAtIntro:
    "HoneyBook deserves real respect — it's the strongest horizontal tool a performer business can buy, and on AI replies their instincts match ours.",
  greatAt: [
    {
      point: "All-in-one polish",
      detail:
        "Contracts, invoices, payments, scheduling and pipelines in one place, with the best-designed UI in this comparison.",
    },
    {
      point: "AI drafts in its inbox",
      detail:
        "HoneyBook ships AI-suggested replies inside its own inbox — they clearly believe what we believe: leads should be answered fast.",
    },
    {
      point: "A mature product and team",
      detail: "Steady releases, integrations and a solid mobile app. $36–129/mo (verified June 2026).",
    },
  ],
  tableHeading: "Side by side",
  rows: [
    {
      feature: "Finds gigs for you (the Hunt)",
      them: { mark: "no", note: "CRM for leads that arrive; it doesn't go find them." },
      us: {
        mark: "yes",
        note: "Scans your cities for venues that book entertainment, scores the fit, drafts the pitch in your voice — you approve.",
      },
    },
    {
      feature: "Answers new inquiries for you",
      them: {
        mark: "partial",
        note: "AI drafts exist — inside HoneyBook's own inbox, once your business lives there.",
      },
      us: { mark: "yes", note: "Drafts from the email setup you already have. Nothing migrates." },
    },
    {
      feature: "Speed to first reply",
      them: { mark: "partial", note: "As fast as you work the HoneyBook inbox." },
      us: { mark: "yes", note: "In minutes once you tap Approve." },
    },
    {
      feature: "Reads The Knot / WeddingWire / Bark / GigSalad lead emails",
      them: {
        mark: "partial",
        note: "Lead capture centers on HoneyBook's forms and inbox; DJ directory notifications aren't the design center.",
      },
      us: { mark: "yes", note: "Parsing those notification emails is exactly what we're built for." },
    },
    {
      feature: "Spam & scam filtering",
      them: { mark: "no", note: "Not something we could verify as a feature." },
      us: { mark: "yes", note: "Spam and scams filtered before you see them." },
    },
    {
      feature: "Follow-up sequences",
      them: { mark: "yes", note: "Automations are genuinely strong: sequences, reminders, pipelines." },
      us: { mark: "yes", note: "Booked-or-dead chasing with hard stops on reply and one-tap opt-out." },
    },
    {
      feature: "Approve from your phone",
      them: { mark: "yes", note: "A solid mobile app." },
      us: { mark: "yes", note: "Two taps: read the draft, approve." },
    },
    {
      feature: "Contracts, invoices & payments",
      them: { mark: "yes", note: "Best-in-class polish — the core of the product." },
      us: { mark: "no", note: "Honestly, HoneyBook wins this row outright. We don't compete there." },
    },
    {
      feature: "Built around performer leads",
      them: { mark: "no", note: "Horizontal by design — photographers, planners, coaches, everyone." },
      us: {
        mark: "yes",
        note: "Your packages, your dates, your voice — DJs, bands, dancers and magicians alike.",
      },
    },
    {
      feature: "Setup",
      them: { mark: "na", note: "A full migration: contacts, templates, pipeline, habits." },
      us: { mark: "na", note: "One forwarding rule. Keep everything where it is." },
    },
    {
      feature: "Verified pricing (June 2026)",
      them: { mark: "na", note: "$36–129/mo" },
      us: { mark: "na", note: "$25–149/mo · subscribe to activate" },
    },
  ],
  fitHeading: "Where Bright Ears fits",
  fitParagraphs: [
    "The difference is architectural, not cosmetic. HoneyBook's AI lives inside HoneyBook: to get drafted replies, your leads, templates, contracts and habits all move in, and you work from its inbox. That's a real migration — and for some businesses it's exactly the right call.",
    "Bright Ears took the opposite bet: stay out of your way. One forwarding rule from the email you already use — no password sharing, no OAuth — and inquiries from your website, plain email, The Knot, WeddingWire, Bark and GigSalad get spam-filtered, drafted in your voice from your rate card, and pushed to your phone for approval. Designed to reply in under 5 minutes, follow-ups until booked or dead, and clients never see anything but you.",
  ],
  fitPullQuote: {
    quote: "Falling asleep with the laptop on.",
    source: "the late-night admin shift both products exist to end",
  },
  faqs: [
    {
      question: "HoneyBook has AI replies — why would I need Bright Ears?",
      answer:
        "If you already run your whole business in HoneyBook and love it, you may not. The difference shows when you don't: HoneyBook's AI drafts work inside its own inbox after a full migration, while Bright Ears bolts onto whatever you use today — DJ Event Planner, Check Cherry, plain Gmail — via one forwarding rule, and is built specifically around performer leads: rate-card pricing, real availability, directory notification emails.",
    },
    {
      question: "Is HoneyBook overkill for a DJ business?",
      answer:
        "Not necessarily — it's excellent software. But it's horizontal by design: photographers, planners, coaches, everyone. Nothing in it knows what a multi-op Saturday looks like. A common pattern: keep your DJ-specific workflow tool, add Bright Ears for lead response, and skip the migration entirely.",
    },
    {
      question: "How do the prices compare?",
      answer:
        "HoneyBook runs $36–129/mo across its published tiers (verified June 2026). Bright Ears is $25/mo Starter (up to 15 inquiries, 1 home city), $79/mo Pro (up to 60 inquiries, up to 3 cities, auto-send autopilot), $149/mo Studio (up to 150 inquiries, hunts all your cities, auto-send autopilot) — every tier includes the complete assistant, follow-up sequences, weekly report and the proactive Hunt agent. You subscribe to activate — month-to-month, cancel anytime.",
    },
    {
      question: "What if I'm already mid-migration to HoneyBook?",
      answer:
        "Finish it — switching twice is worse than either tool alone. Bright Ears can still sit in front: forward your lead notifications and we'll answer and chase while you work the pipeline in HoneyBook.",
    },
  ],
  ctaHeading: "Keep your stack. Add the hunting and the answering.",
  ctaSub: "It hunts venues for you AND answers every inquiry — one forwarding rule, nothing migrates.",
};

const DJEP_ALTERNATIVES: ComparisonPage = {
  slug: "dj-event-planner-alternatives",
  competitor: "DJ Event Planner",
  competitorPrice: "$20–50/mo",
  title: "DJ Event Planner Alternatives (2026): Switch — or Add What's Missing?",
  metaDescription:
    "Honest 2026 guide for performers: DJ Event Planner, GigBuilder, Check Cherry, Vibo, HoneyBook — verified pricing, and the one job none of them do.",
  cardTitle: "DJ Event Planner alternatives",
  cardBlurb: "The honest switching guide — including the option nobody mentions: don't switch, add.",
  heroEyebrow: "DJ Event Planner alternatives, honestly",
  heroHeading: "Before you rage-quit DJEP, read this",
  heroSub:
    "Most 'DJ Event Planner alternative' searches start with a real frustration — the dated interface, the missing integrations, the admin hours. Honest take from people who ran an entertainment business for 20 years: the depth you'd give up is real. Here's the full map, including the option nobody mentions — don't switch, add.",
  greatAtHeading: "What you'd be giving up",
  greatAtIntro:
    "DJ Event Planner's reputation isn't an accident. Before switching, weigh what it still does better than the alternatives:",
  greatAt: [
    {
      point: "Two decades of workflow depth",
      detail:
        "Contracts, invoicing, planning forms, equipment, employee scheduling — multi-op operators run everything on it, and most alternatives cover half.",
    },
    {
      point: "It's cheap for what it does",
      detail: "$20–50/mo (verified June 2026). Several alternatives cost more and do less of the back office.",
    },
    {
      point: "Your data and habits live there",
      detail: "Migrations cost weeks and break muscle memory. The grass needs to be a lot greener.",
    },
  ],
  alternativesHeading: "The alternatives, honestly rated",
  alternativesIntro: "Pricing verified June 2026. Each link goes to a full head-to-head.",
  alternatives: [
    {
      name: "GigBuilder",
      price: "$25–50/mo",
      take:
        "The closest like-for-like swap: booking system, planning forms, client portal, plus an AI writing helper. Its infrastructure feels dated too, so on modernity it's a sideways move.",
      slug: "gigbuilder",
    },
    {
      name: "Check Cherry",
      price: "$29–139/mo",
      take:
        "The modern-feeling option: beautiful booking forms, packages, proposals, payments. Lighter on deep multi-op workflow than DJEP.",
      slug: "check-cherry",
    },
    {
      name: "HoneyBook",
      price: "$36–129/mo",
      take:
        "The polished generalist: contracts, invoices, pipelines, AI drafts in its own inbox. Requires a full migration, and nothing in it is DJ-specific.",
      slug: "honeybook",
    },
    {
      name: "Vibo",
      price: "$149–179/mo",
      take:
        "Not actually a DJEP alternative — it's client music planning after the booking. Listed because it's often cross-shopped; it replaces nothing in your back office.",
      slug: "vibo",
    },
    {
      name: "Bright Ears",
      price: "$25–149/mo",
      take:
        "Not a replacement either — a bolt-on AI inbox that answers and chases your leads while you keep DJEP for everything else. If the complaint behind your search is admin time, this is usually the actual fix.",
    },
  ],
  tableHeading: "If you add instead of switch",
  rows: DJEP_ROWS,
  fitHeading: "The option nobody mentions: keep DJEP, fix the real complaint",
  fitParagraphs: [
    "Ask what's actually driving the switch. If it's contracts or invoicing — DJEP already does those well. The complaint underneath most 'alternatives' threads is time: inquiries arriving at all hours, replies going out too late, follow-ups never happening. \"Get an inquiry, immediately respond, and then nothing.\" Switching CRMs doesn't fix that, because no CRM on this page answers a lead for you.",
    "Bright Ears does exactly that one job. One forwarding rule sends your lead notifications — website form, plain email, The Knot, WeddingWire, Bark, GigSalad — to your Bright Ears address. Spam gets filtered, a reply is drafted in your voice from your rate card and real availability, and you approve it from your phone. Designed to reply in under 5 minutes; follow-ups run until booked or dead with one-tap opt-out compliance. DJEP stays your system of record. You stop being the bottleneck.",
  ],
  fitPullQuote: {
    quote:
      "I want to automate this. I've looked into DJ Intelligence, SMPL, and DJEP — none of them integrate with Zapier.",
    source: "r/mobileDJ — the customer-written spec",
  },
  faqs: [
    {
      question: "What's the closest like-for-like DJ Event Planner alternative?",
      answer:
        "GigBuilder covers the most similar ground at a similar price ($25–50/mo, verified June 2026), with Check Cherry ($29–139/mo) as the modern-feeling option if forms and proposals matter more than deep multi-op workflow. Neither is a clean upgrade on every axis — DJEP's depth is real.",
    },
    {
      question: "Should I switch away from DJ Event Planner at all?",
      answer:
        "If your complaint is the dated interface and you can live with fewer back-office features, Check Cherry will feel like fresh air. If your complaint is hours lost to admin and slow lead replies, switching won't fix it — none of these CRMs answer an inquiry for you. That's an add-on problem, not a migration problem.",
    },
    {
      question: "Does anything integrate with DJ Event Planner?",
      answer:
        "DJEP has no public API, which is why the integration story is thin across the board — and why DJs end up writing posts like the one quoted above. Bright Ears sidesteps it by working on the email layer: lead notifications forward in, approved replies go out, no API needed.",
    },
    {
      question: "What does the bolt-on option cost?",
      answer:
        "Bright Ears starts at $25/mo (answers up to 15 inquiries, hunts 1 home city — the complete assistant, follow-up sequences and weekly report included), with Pro at $79/mo (up to 60 inquiries, up to 3 cities, auto-send autopilot) and Studio at $149/mo (up to 150 inquiries, hunts all your cities, auto-send autopilot). You subscribe to activate, month-to-month, cancel anytime. Need more? Upgrade in one click — at your cap, drafting pauses for the month rather than surprise-billing you.",
    },
  ],
  ctaHeading: "Fix the complaint without the migration",
  ctaSub: "Keep DJEP — add the AI that hunts gigs and answers leads in front of it.",
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export const COMPARISONS: Record<ComparisonSlug, ComparisonPage> = {
  "dj-event-planner": DJ_EVENT_PLANNER,
  gigbuilder: GIGBUILDER,
  vibo: VIBO,
  "check-cherry": CHECK_CHERRY,
  honeybook: HONEYBOOK,
  "dj-event-planner-alternatives": DJEP_ALTERNATIVES,
};

export function getComparison(slug: string): ComparisonPage | undefined {
  return (COMPARISONS as Record<string, ComparisonPage>)[slug];
}
