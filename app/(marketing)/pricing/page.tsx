import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing — Bright Ears",
  description:
    "Simple plans metered in leads, not tokens. 14-day free trial of Pro, no card. Starter $25/mo, Pro $79/mo, Studio $149/mo. At your cap drafting pauses — never surprise bills.",
};

type Plan = {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  highlighted?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "$25",
    blurb: "For the solo performer who never wants to be the 5th DJ to reply again.",
    features: [
      "15 leads per month",
      "1 performer (you)",
      "Replies drafted in your voice, from your rate card",
      "Availability-aware — drafts check your gig calendar",
      "Spam & scams filtered before you ever see them",
      "Approve, edit or toss every draft from your phone",
      "Works with The Knot, WeddingWire, Bark, GigSalad, your website forms & plain email",
    ],
  },
  {
    name: "Pro",
    price: "$79",
    blurb: "For the busy season — follow-ups run until every lead is booked or dead.",
    features: [
      "Everything in Starter",
      "60 leads per month",
      "Follow-up sequences until booked-or-dead",
      "Auto-send per source — full autopilot where you trust it",
      "Weekly report: median reply time & gigs booked",
      "One-tap opt-out compliance on every follow-up",
    ],
    highlighted: true,
  },
  {
    name: "Studio",
    price: "$149",
    blurb: "For multi-performer businesses — the whole roster, one inbox, one team.",
    features: [
      "Everything in Pro",
      "150 leads per month",
      "Multiple performers — route leads across your roster",
      "Team seats so anyone can review and approve",
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is email forwarding safe? Do I have to share my password?",
    a: "No passwords, no inbox access, no OAuth permissions. You add one simple forwarding rule in your own email or lead platform that sends inquiry notifications to your private Bright Ears address. You stay in full control and can switch the forward off anytime.",
  },
  {
    q: "What counts as a lead?",
    a: "A lead is a real inquiry from a real prospect — someone asking about your availability, pricing or services — that we parse and draft a reply for. One prospect = one lead, no matter how many emails go back and forth with them.",
  },
  {
    q: "Does spam count against my monthly leads?",
    a: "No. Spam, scams and vendor junk are filtered before you ever see them, and they never count toward your lead cap. You only pay for real prospects.",
  },
  {
    q: "What happens when I hit my monthly lead cap?",
    a: "Drafting pauses and we notify you immediately — we never silently bill you more. You can add a lead pack ($10 per 10 leads) or upgrade your plan in one click. No surprise bills, ever.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Every plan is month-to-month with no contract. Cancel from your settings in two clicks and your forwarding simply stops working with us — your inbox keeps working exactly as before.",
  },
  {
    q: "Will my clients know an AI is involved?",
    a: "No. Bright Ears is fully white-label: replies go out under your business name, prospects reply straight to you, every word is written in your voice from your rate card — and you approve it. Your clients see a fast, professional performer. Nothing else.",
  },
  {
    q: "Which platforms does it work with?",
    a: "The Knot, WeddingWire, Bark and GigSalad lead notification emails, plus your own website contact forms and plain email — all through the same simple forwarding setup. If an inquiry lands in your inbox, we can catch it.",
  },
  {
    q: "How do you handle opt-outs and spam laws?",
    a: "Every follow-up carries a one-tap opt-out and the correct compliance footer for your country (CAN-SPAM in the US, PECR in the UK, CASL in Canada, Spam Act in Australia). Sequences hard-stop the moment a prospect replies, books, opts out, or you mark the lead dead.",
  },
  {
    q: "What if I hate a draft?",
    a: "Edit it in a tap or toss it — nothing is sent without your approval unless you have explicitly turned on auto-send for a source you trust. You are always the final word in your own inbox.",
  },
  {
    q: "Do I need a credit card to start the trial?",
    a: "No card needed. You get 14 days of full Pro — sequences, auto-send, weekly report, all of it. At the end, pick the plan that fits or walk away. We will not charge you by surprise.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 text-brand-cyan"
    >
      <path
        d="M5 10.5l3.5 3.5L15 6.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Playful gradient blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-brand-cyan-soft blur-3xl opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 -right-32 h-96 w-96 rounded-full bg-soft-lavender/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[60rem] -left-32 h-96 w-96 rounded-full bg-warm-peach/30 blur-3xl"
      />

      <section className="relative max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-10 text-center">
        <Badge>Pricing</Badge>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-deep-teal text-balance">
          Less than one first dance. Plans priced in leads, not jargon.
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-lg text-ink/70">
          A booked wedding is worth $1,500–3,000. Bright Ears answers every
          inquiry in under 5 minutes — even from the booth — for less than a
          dinner out. Start with 14 days of full Pro. No card.
        </p>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-8">
        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col p-7 ${
                plan.highlighted
                  ? "border-2 border-brand-cyan shadow-lg lg:-my-3 lg:py-10"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-cyan px-4 py-1 text-xs font-bold text-white shadow-sm">
                  Most popular
                </span>
              )}
              <h2 className="text-xl font-bold text-deep-teal">{plan.name}</h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-ink">{plan.price}</span>
                <span className="text-ink/50">/month</span>
              </div>
              <p className="mt-3 text-sm text-ink/70">{plan.blurb}</p>
              <ul className="mt-6 space-y-3 text-sm text-ink/80 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <CheckIcon />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/onboarding"
                className={`mt-8 block text-center ${
                  plan.highlighted
                    ? "rounded-xl bg-brand-cyan text-white font-semibold px-4 py-3 hover:opacity-90 transition-opacity"
                    : "rounded-xl border border-deep-teal/30 text-deep-teal font-semibold px-4 py-3 hover:border-brand-cyan hover:text-brand-cyan transition-colors"
                }`}
              >
                Start free
              </Link>
              <p className="mt-3 text-center text-xs text-ink/50">
                14-day free trial of Pro · no card needed
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-brand-cyan-soft/50 border border-off-white p-6">
            <h3 className="font-semibold text-deep-teal">
              Busy month? Lead packs, not lock-in.
            </h3>
            <p className="mt-2 text-sm text-ink/70">
              Wedding season spikes are real. Add 10 extra leads for $10
              whenever you need them — no plan change, no commitment.
            </p>
          </div>
          <div className="rounded-2xl bg-warm-peach/40 border border-off-white p-6">
            <h3 className="font-semibold text-deep-teal">
              At your cap, drafting pauses — never surprise bills.
            </h3>
            <p className="mt-2 text-sm text-ink/70">
              When you hit your monthly leads, we pause and ask before anything
              costs you a cent. Your card is never charged for overages you
              didn&apos;t choose.
            </p>
          </div>
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 pb-20">
        <div className="text-center">
          <Badge tone="lavender">FAQ</Badge>
          <h2 className="mt-4 text-3xl font-bold text-deep-teal">
            Fair questions, straight answers
          </h2>
          <p className="mt-3 text-ink/70">
            The things performers actually ask us before they forward their
            first lead.
          </p>
        </div>
        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <Card key={f.q} className="p-6">
              <h3 className="font-semibold text-deep-teal">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-10">
        <div className="rounded-3xl bg-deep-teal px-8 py-12 sm:py-16 text-center relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-brand-cyan/30 blur-2xl"
          />
          <h2 className="relative text-3xl sm:text-4xl font-bold text-white text-balance">
            Stop being the 5th DJ to reply.
          </h2>
          <p className="relative mt-4 text-white/80 max-w-xl mx-auto">
            Respond in under 5 minutes — even from the booth. 14 days of full
            Pro, free, no card.
          </p>
          <Link
            href="/onboarding"
            className="relative mt-8 inline-block rounded-xl bg-brand-cyan text-white font-semibold px-8 py-3.5 hover:opacity-90 transition-opacity"
          >
            Start free
          </Link>
        </div>
      </section>
    </div>
  );
}
