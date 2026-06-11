// Landing page — the money page. Customers' verbatim language in headlines
// (docs/PRODUCT-BRIEF.md §3), experience voice without founder names, light +
// colorful per CLAUDE.md "Brand, voice & design". Every CTA: Start free → /onboarding.
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { DemoWidget } from "@/components/demo-widget";

export const metadata: Metadata = {
  title: "Bright Ears — stop being the 5th DJ to reply",
  description:
    "The AI back office that wins you the gig: every inquiry answered in your voice in under 5 minutes, followed up for days, until it's booked or dead — you just tap Approve. 14-day free trial, no card.",
};

const TRUST_LINE = "14-day free trial · no card · 5-minute setup";

const PAINS = [
  {
    emoji: "🫥",
    title: "The ghosting",
    quote: "Get an inquiry, immediately respond, and then nothing… 30 inquiries so far, maybe 5 have responded.",
    note: "Couples book whoever replies first — and a third of vendors never reply at all. Speed is the whole game.",
    bg: "bg-brand-cyan-soft",
  },
  {
    emoji: "💻",
    title: "The 2am admin shift",
    quote: "Falling asleep with the laptop on.",
    note: "You already played four hours. The quotes, the follow-ups and the calendar still want their turn.",
    bg: "bg-warm-peach",
  },
  {
    emoji: "👯",
    title: "The ceiling",
    quote: "If there were two of me, I would double my business.",
    note: "More leads was never the problem. Answering every one of them, fast, every time — that’s the problem.",
    bg: "bg-soft-lavender",
  },
];

const STEPS = [
  {
    emoji: "📨",
    bg: "bg-brand-cyan-soft",
    title: "Forward your leads",
    body: "One simple forwarding rule catches everything — The Knot, WeddingWire, Bark and GigSalad notifications, your website form, plain email. No password sharing, no OAuth, nothing to migrate.",
  },
  {
    emoji: "✍️",
    bg: "bg-soft-lavender",
    title: "We draft in your voice",
    body: "Spam and scams are filtered before you ever see them. Real leads get a personal reply written your way — checked against your real calendar and priced from your rate card.",
  },
  {
    emoji: "👍",
    bg: "bg-warm-peach",
    title: "You tap Approve",
    body: "One tap from your phone — even from the booth — and it sends from your business name. Follow-ups keep going until it’s booked or dead, with one-tap opt-out built in.",
  },
];

const FEATURES = [
  {
    emoji: "🛡️",
    title: "The scam emails you’ll never see",
    body: "Every inquiry is triaged before it reaches your phone. The overpayment scams, the spam blasts, the fake “event planners” — gone. You only ever see real leads.",
  },
  {
    emoji: "🔁",
    title: "Follow-ups until booked-or-dead",
    body: "Most gigs are won by the follow-up nobody has time to send. Polite nudges keep going until there’s an answer — and stop instantly on a reply, a booking, or a one-tap opt-out.",
  },
  {
    emoji: "📈",
    title: "A weekly report that proves it",
    body: "Every week: your median reply time, what came in, what got booked. Numbers you can feel good about — or forward straight to your business partner.",
  },
  {
    emoji: "🤫",
    title: "Your clients see you, never us",
    body: "Replies send from your business name, with your reply-to address. No “AI”, no Bright Ears branding anywhere — your couples just think you’re impressively quick.",
  },
];

const SOURCES = ["The Knot", "WeddingWire", "Bark", "GigSalad", "Your website form", "Plain email"];

export default function HomePage() {
  return (
    <div className="overflow-x-clip">
      {/* ---------- Hero ---------- */}
      <section className="relative isolate">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-cyan-soft blur-3xl" />
          <div className="absolute -right-24 top-12 h-80 w-80 rounded-full bg-soft-lavender/40 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-64 w-64 rounded-full bg-warm-peach/50 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-14 sm:pt-20 lg:grid-cols-2 lg:pb-24">
          <div>
            <span className="inline-block rounded-full bg-brand-cyan-soft px-3 py-1 text-xs font-semibold text-deep-teal">
              The AI back office for DJ &amp; performer businesses
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-deep-teal sm:text-5xl lg:text-6xl">
              Stop being the <span className="text-brand-cyan">5th DJ</span> to reply.
            </h1>
            {/* The one-liner (ADR-003 reposition): outcome, not "answers inbounds". */}
            <p className="mt-5 max-w-xl text-lg text-ink/70">
              Every inquiry answered in your voice in under 5 minutes, followed up for days, until
              it’s booked or dead — you just tap <strong className="text-deep-teal">Approve</strong>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/onboarding"
                className="rounded-xl bg-brand-cyan px-6 py-3 text-lg font-semibold text-white transition-opacity hover:opacity-90"
              >
                Start free
              </Link>
              <a
                href="#demo"
                className="rounded-xl border border-deep-teal/30 px-6 py-3 text-lg font-semibold text-deep-teal transition-colors hover:border-brand-cyan hover:text-brand-cyan"
              >
                Watch it write a reply
              </a>
            </div>
            <p className="mt-4 text-sm text-ink/60">{TRUST_LINE}</p>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* ---------- Pain ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-deep-teal sm:text-4xl">
            Sound familiar?
          </h2>
          <p className="mt-3 text-lg text-ink/70">
            Working DJs told us the same three stories, over and over. Their words, not ours:
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.title} className={`rounded-3xl ${p.bg} p-6 shadow-sm`}>
              <span className="text-3xl" aria-hidden>
                {p.emoji}
              </span>
              <h3 className="mt-3 text-sm font-bold uppercase tracking-wide text-deep-teal">{p.title}</h3>
              <blockquote className="mt-2 text-lg font-semibold leading-snug text-ink">
                “{p.quote}”
              </blockquote>
              <p className="mt-3 text-sm text-ink/80">{p.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Live demo ---------- */}
      <section id="demo" className="relative isolate scroll-mt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-cyan-soft/70 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-warm-peach/40 blur-3xl" />
        </div>
        <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-24">
          <h2 className="text-3xl font-extrabold tracking-tight text-deep-teal sm:text-4xl">
            “I can’t always text the lead within 5 minutes.”
          </h2>
          <p className="mt-3 text-lg text-ink/70">
            Now you can — without touching your phone. Paste an inquiry below and watch the same
            engine that will win you the gig write the reply, live.
          </p>
          <div className="mt-8 text-left">
            <DemoWidget />
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-deep-teal sm:text-4xl">
            Respond in under 5 minutes — even from the booth.
          </h2>
          <p className="mt-3 text-lg text-ink/70">
            Three steps, about five minutes of setup. Median first reply: under 5 minutes.
          </p>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-off-white bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.bg} text-2xl`}
                  aria-hidden
                >
                  {s.emoji}
                </span>
                <span className="text-sm font-bold uppercase tracking-wide text-ink/40">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-deep-teal">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- The story ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <div className="relative isolate overflow-hidden rounded-3xl border border-off-white bg-gradient-to-br from-brand-cyan-soft/60 via-white to-soft-lavender/30 p-8 sm:p-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-warm-peach/40 blur-3xl" />
          </div>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-deep-teal sm:text-4xl">
              We’ve been there.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink/80">
              Twenty years running entertainment for venues — the same drowning in inquiries,
              schedules and invoices, the same laptop glow at 2am. So we built an AI back office for
              our own agency in Bangkok. Her name is Vinyl, and she still runs it today — answering
              every inquiry, chasing every follow-up, keeping every gig straight.
            </p>
            <p className="mt-3 text-lg leading-relaxed text-ink/80">
              Bright Ears is that same back office — now she works for yours.
            </p>
            <Link
              href="/story"
              className="mt-6 inline-block font-semibold text-deep-teal underline decoration-brand-cyan decoration-2 underline-offset-4 transition-colors hover:text-brand-cyan"
            >
              Read the whole story →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-deep-teal sm:text-4xl">
            The unglamorous stuff, handled.
          </h2>
          <p className="mt-3 text-lg text-ink/70">
            Everything it takes to carry “new inquiry” all the way to “booked” — included on every
            plan, without the 2am shift.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6">
              <span className="text-3xl" aria-hidden>
                {f.emoji}
              </span>
              <h3 className="mt-3 text-xl font-bold text-deep-teal">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{f.body}</p>
            </Card>
          ))}
        </div>
        <p className="mt-12 text-center text-sm font-semibold text-ink/60">
          Works with the leads you already get
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {SOURCES.map((s) => (
            <span
              key={s}
              className="rounded-full border border-off-white bg-white px-3 py-1 text-sm text-ink/70 shadow-sm"
            >
              {s}
            </span>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink/50">
          Simple email forwarding — no password sharing, no OAuth.
        </p>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-cyan to-deep-teal px-8 py-14 text-center sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-soft-lavender/40 blur-2xl" />
            <div className="absolute -bottom-12 -left-10 h-56 w-56 rounded-full bg-warm-peach/40 blur-2xl" />
            <div className="absolute left-1/4 top-1/2 h-32 w-32 rounded-full bg-brand-cyan-soft/30 blur-2xl" />
          </div>
          <div className="relative">
            <blockquote className="text-2xl font-extrabold text-white sm:text-3xl">
              “If there were two of me, I would double my business.”
            </blockquote>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
              Now there are two of you. One plays the gigs. The other wins them — every lead
              answered in minutes, followed up for days, carried all the way to booked. And it
              always asks before sending.
            </p>
            <Link
              href="/onboarding"
              className="mt-8 inline-block rounded-xl bg-white px-8 py-3 text-lg font-bold text-deep-teal transition-opacity hover:opacity-90"
            >
              Start free
            </Link>
            <p className="mt-4 text-sm text-white/80">{TRUST_LINE}</p>
            <p className="mt-1 text-xs text-white/70">
              Then from $25/mo. At your lead cap we pause — never a surprise bill.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Decorative product mock for the hero — pure markup, no real data.
function HeroMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      <div className="-rotate-2 rounded-2xl border border-off-white bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs text-ink/50">
          <span className="font-semibold text-deep-teal">💌 New inquiry — The Knot</span>
          <span>7:42 pm</span>
        </div>
        <p className="mt-2 text-sm text-ink/80">
          “Hi! Are you free October 17 for a barn wedding, ~120 guests? What do you charge?”
        </p>
      </div>
      <div className="mx-6 my-3 w-fit rotate-1 rounded-full bg-brand-cyan-soft px-3 py-1 text-xs font-semibold text-deep-teal shadow-sm">
        ✍️ Draft ready for your approval — 7:46 pm
      </div>
      <div className="rotate-2 rounded-2xl border border-off-white bg-white p-4 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Subject</p>
        <p className="text-sm font-semibold text-deep-teal">October 17 — great news, we’re open 🎉</p>
        <p className="mt-2 text-sm leading-relaxed text-ink/80">
          Congrats, you two! October 17 is open on our calendar. For a 120-guest barn wedding, most
          couples take our Wedding Essentials package…
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-xl bg-brand-cyan px-4 py-2 text-sm font-semibold text-white">
            Approve &amp; send
          </span>
          <span className="rounded-xl border border-deep-teal/30 px-4 py-2 text-sm font-semibold text-deep-teal">
            Edit
          </span>
        </div>
      </div>
      <div className="mx-auto mt-3 w-fit -rotate-1 rounded-full bg-deep-teal px-3 py-1 text-xs font-semibold text-white shadow-sm">
        ✓ Sent 4 minutes after it arrived
      </div>
    </div>
  );
}
