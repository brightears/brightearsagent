// Landing page — the money page, restaged in design language v2 "Neon Collage"
// (docs/DESIGN.md, THE LAW; canonical preview: app/(marketing)/design/b/page.tsx).
// Ink canvas, one RingsBackdrop (hero only), cream poster panels with collage
// pieces, magenta show CTAs, cyan reserved for clickable interface. Customers'
// verbatim language in headlines (docs/PRODUCT-BRIEF.md §3); copy and hrefs
// unchanged — every CTA: Start free → /onboarding.
import type { Metadata } from "next";
import Link from "next/link";
import {
  GradientBlob,
  HaloRing,
  HeroCollage,
  RingsBackdrop,
  StickerChip,
  StudioSpeaker,
  VinylDisc,
} from "@/components/collage";
import { DemoWidget } from "@/components/demo-widget";

export const metadata: Metadata = {
  title: "Bright Ears — stop being the 5th DJ to reply",
  description:
    "The AI back office that wins you the gig: every inquiry answered in your voice in under 5 minutes, followed up for days, until it's booked or dead — you just tap Approve. 14-day free trial, no card.",
};

const TRUST_LINE = "14-day free trial · no card · 5-minute setup";

const STATS = [
  { n: "<5 min", l: "median first reply" },
  { n: "~50%", l: "of couples book the first responder" },
  { n: "$1,800", l: "the booking you stop losing" },
];

/* word-by-word magenta → orange spectrum — the gradient pull-quote treatment */
const STORY_QUOTE: { w: string; c: string }[] = [
  { w: "We’ve", c: "#ff2dae" },
  { w: "been", c: "#ff5a74" },
  { w: "there.", c: "#ff8a00" },
];

const STEPS = [
  {
    emoji: "📨",
    title: "Forward your leads",
    body: "One simple forwarding rule catches everything — The Knot, WeddingWire, Bark and GigSalad notifications, your website form, plain email. No password sharing, no OAuth, nothing to migrate.",
  },
  {
    emoji: "✍️",
    title: "We draft in your voice",
    body: "Spam and scams are filtered before you ever see them. Real leads get a personal reply written your way — checked against your real calendar and priced from your rate card.",
  },
  {
    emoji: "👍",
    title: "You tap Approve",
    body: "One tap from your phone — even from the booth — and it sends from your business name. Follow-ups keep going until it’s booked or dead, with one-tap opt-out built in.",
  },
];

const FEATURES = [
  {
    emoji: "🛡️",
    title: "The scam emails you’ll never see",
    body: "Every inquiry is triaged before it reaches your phone. The overpayment scams, the spam blasts, the fake “event planners” — gone. You only ever see real leads.",
    tilt: "-rotate-1",
  },
  {
    emoji: "🔁",
    title: "Follow-ups until booked-or-dead",
    body: "Most gigs are won by the follow-up nobody has time to send. Polite nudges keep going until there’s an answer — and stop instantly on a reply, a booking, or a one-tap opt-out.",
    tilt: "rotate-1",
  },
  {
    emoji: "📈",
    title: "A weekly report that proves it",
    body: "Every week: your median reply time, what came in, what got booked. Numbers you can feel good about — or forward straight to your business partner.",
    tilt: "rotate-[0.6deg]",
  },
  {
    emoji: "🤫",
    title: "Your clients see you, never us",
    body: "Replies send from your business name, with your reply-to address. No “AI”, no Bright Ears branding anywhere — your couples just think you’re impressively quick.",
    tilt: "-rotate-[0.6deg]",
  },
];

const SOURCES = ["The Knot", "WeddingWire", "Bark", "GigSalad", "Your website form", "Plain email"];

/** ONE gradient-painted word/phrase in a warm-white headline — the v2 signature. */
function GradWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
      {children}
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="overflow-x-clip">
      {/* ---------- Hero — ink stage, rings, cream collage poster ---------- */}
      <section className="relative isolate overflow-hidden">
        <RingsBackdrop />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(640px circle at 78% 220px, rgba(255,45,174,0.10), transparent 70%), radial-gradient(520px circle at 10% 60px, rgba(255,138,0,0.07), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-14 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/25 bg-cream/5 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cream/75">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-magenta" />
            The AI back office for DJ &amp; performer businesses
          </span>
          <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-cream-bright sm:text-6xl xl:text-7xl">
            Stop being the <GradWord>5th</GradWord> DJ to reply.
          </h1>
          <div className="mt-10 grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              {/* The one-liner (ADR-003 reposition): outcome, not "answers inbounds". */}
              <p className="max-w-xl text-lg leading-relaxed text-cream/70">
                Every inquiry answered in your voice in under 5 minutes, followed up for days, until
                it’s booked or dead — you just tap{" "}
                <strong className="font-bold text-cream-bright">Approve</strong>.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/onboarding"
                  className="rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-opacity hover:opacity-90"
                >
                  Start free
                </Link>
                <a
                  href="#demo"
                  className="inline-flex items-center gap-2.5 rounded-full border-[1.5px] border-cream/40 px-7 py-3.5 text-lg font-semibold text-cream transition-colors hover:border-cream/75 hover:text-cream-bright"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-cream/50 text-[8px] leading-none">
                    &#9654;
                  </span>
                  Watch it write a reply
                </a>
              </div>
              <p className="mt-6 text-sm text-cream/45">{TRUST_LINE}</p>
            </div>
            <HeroCollage />
          </div>
        </div>
      </section>

      {/* ---------- Stat strip — gradient numbers ---------- */}
      <section className="border-y border-cream/10">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.n}>
              <div className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-4xl font-black tracking-tight text-transparent">
                {s.n}
              </div>
              <div className="mt-2 max-w-[220px] text-sm leading-snug text-cream/55">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Live demo — cream poster panel on the ink ---------- */}
      <section id="demo" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-cream-bright sm:text-4xl">
              “I can’t always text the lead within <GradWord>5 minutes</GradWord>.”
            </h2>
            <p className="mt-3 text-lg text-cream/70">
              Now you can — without touching your phone. Paste an inquiry below and watch the same
              engine that will win you the gig write the reply, live.
            </p>
          </div>
          <div className="relative mt-10 text-left">
            <GradientBlob tone="show" className="-bottom-10 -left-8 h-44 w-72" />
            <DemoWidget />
          </div>
        </div>
      </section>

      {/* ---------- Pain — 3 cream poster panels, small collage pieces ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-cream-bright sm:text-4xl">
            Sound <GradWord>familiar?</GradWord>
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            Working DJs told us the same three stories, over and over. Their words, not ours:
          </p>
        </div>
        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          {/* The ghosting */}
          <div className="relative">
            <GradientBlob tone="show" className="-bottom-8 -left-6 h-36 w-52" />
            <div className="relative -rotate-2 overflow-hidden rounded-3xl bg-cream p-7 pb-8 text-ink-stage shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <div className="relative h-28">
                <HaloRing width={170} height={62} tilt={-12} className="left-0 top-9" />
                <VinylDisc size={104} tone="dark" className="-right-3 -top-5" />
                <StickerChip tone="ink" rotate={-5} className="absolute left-1 top-0">
                  30 in &middot; 5 back
                </StickerChip>
              </div>
              <h3 className="mt-6 text-xl font-extrabold tracking-tight">
                <span className="mr-2" aria-hidden>
                  🫥
                </span>
                The ghosting
              </h3>
              <blockquote className="mt-2 text-base font-bold leading-snug">
                “Get an inquiry, immediately respond, and then nothing… 30 inquiries so far, maybe 5
                have responded.”
              </blockquote>
              <p className="mt-3 text-sm leading-relaxed text-ink-stage/65">
                Couples book whoever replies first — and a third of vendors never reply at all.
                Speed is the whole game.
              </p>
            </div>
          </div>

          {/* The 2am admin shift */}
          <div className="relative lg:mt-8">
            <GradientBlob tone="show" className="-bottom-8 -right-6 h-36 w-52" />
            <div className="relative rotate-1 overflow-hidden rounded-3xl bg-cream p-7 pb-8 text-ink-stage shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <div className="relative h-28">
                <StudioSpeaker size={72} className="left-6 top-0 -rotate-3" />
                <HaloRing width={150} height={56} tilt={12} className="right-0 top-12" />
                <StickerChip tone="ink" rotate={5} className="absolute right-0 top-0">
                  2:13 am
                </StickerChip>
              </div>
              <h3 className="mt-6 text-xl font-extrabold tracking-tight">
                <span className="mr-2" aria-hidden>
                  💻
                </span>
                The 2am admin shift
              </h3>
              <blockquote className="mt-2 text-base font-bold leading-snug">
                “Falling asleep with the laptop on.”
              </blockquote>
              <p className="mt-3 text-sm leading-relaxed text-ink-stage/65">
                You already played four hours. The quotes, the follow-ups and the calendar still
                want their turn.
              </p>
            </div>
          </div>

          {/* The ceiling */}
          <div className="relative lg:mt-3">
            <GradientBlob tone="show" className="-bottom-8 -left-6 h-36 w-52" />
            <div className="relative -rotate-1 overflow-hidden rounded-3xl bg-cream p-7 pb-8 text-ink-stage shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <div className="relative h-28">
                <div className="absolute bottom-0 left-3 flex items-end gap-2.5">
                  {[36, 60, 84].map((h) => (
                    <div
                      key={h}
                      className="w-7 rounded-t-full"
                      style={{ height: h, background: "linear-gradient(180deg, #ff8a00, #ff2dae)" }}
                    />
                  ))}
                </div>
                <VinylDisc size={88} tone="orange" className="-right-4 top-4" />
                <StickerChip tone="magenta" rotate={-5} className="absolute left-1 top-0">
                  Two of you
                </StickerChip>
              </div>
              <h3 className="mt-6 text-xl font-extrabold tracking-tight">
                <span className="mr-2" aria-hidden>
                  👯
                </span>
                The ceiling
              </h3>
              <blockquote className="mt-2 text-base font-bold leading-snug">
                “If there were two of me, I would double my business.”
              </blockquote>
              <p className="mt-3 text-sm leading-relaxed text-ink-stage/65">
                More leads was never the problem. Answering every one of them, fast, every time —
                that’s the problem.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works — ink-raised cards ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-cream-bright sm:text-4xl">
            Respond in under 5 minutes — even from the <GradWord>booth.</GradWord>
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            Three steps, about five minutes of setup. Median first reply: under 5 minutes.
          </p>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-cream/10 bg-ink-raised p-6">
              <div className="flex items-center justify-between gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream/10 text-2xl"
                  aria-hidden
                >
                  {s.emoji}
                </span>
                <StickerChip tone="cream">Step {i + 1}</StickerChip>
              </div>
              <h3 className="mt-4 text-xl font-extrabold tracking-tight text-cream-bright">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-cream/60">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- The story — the Vinyl band, gradient pull quote ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <div className="relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-raised p-8 sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(480px circle at 90% 10%, rgba(255,45,174,0.12), transparent 70%), radial-gradient(420px circle at 10% 100%, rgba(255,138,0,0.08), transparent 70%)",
            }}
          />
          <VinylDisc size={230} tone="orange" spin className="-bottom-16 -right-16 hidden sm:block" />
          <StickerChip tone="cream" rotate={4} className="absolute right-8 top-8 hidden md:inline-block">
            Her name is Vinyl
          </StickerChip>
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {STORY_QUOTE.map((t, i) => (
                <span key={i} style={{ color: t.c }}>
                  {t.w}
                  {i < STORY_QUOTE.length - 1 ? " " : ""}
                </span>
              ))}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-cream/75">
              Twenty years running entertainment for venues — the same drowning in inquiries,
              schedules and invoices, the same laptop glow at 2am. So we built an AI back office for
              our own agency in Bangkok. Her name is Vinyl, and she still runs it today — answering
              every inquiry, chasing every follow-up, keeping every gig straight.
            </p>
            <p className="mt-3 text-lg leading-relaxed text-cream/75">
              Bright Ears is that same back office — now she works for yours.
            </p>
            <Link
              href="/story"
              className="mt-6 inline-block font-semibold text-brand-cyan transition-opacity hover:opacity-80"
            >
              Read the whole story →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Features grid — cream posters on the gallery wall ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-cream-bright sm:text-4xl">
            The unglamorous stuff, <GradWord>handled.</GradWord>
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            Everything it takes to carry “new inquiry” all the way to “booked” — included on every
            plan, without the 2am shift.
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`rounded-3xl bg-cream p-7 text-ink-stage shadow-[0_20px_50px_rgba(0,0,0,0.4)] ${f.tilt}`}
            >
              <span className="text-3xl" aria-hidden>
                {f.emoji}
              </span>
              <h3 className="mt-3 text-xl font-extrabold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-stage/65">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-14 text-center text-sm font-semibold text-cream/60">
          Works with the leads you already get
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {SOURCES.map((s) => (
            <span
              key={s}
              className="rounded-full border-[1.5px] border-cream/25 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cream/70"
            >
              {s}
            </span>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-cream/45">
          Simple email forwarding — no password sharing, no OAuth.
        </p>
      </section>

      {/* ---------- Final CTA — magenta glow band ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-4">
        <div className="relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-raised px-8 py-14 text-center shadow-[0_30px_90px_rgba(255,45,174,0.18)] sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(520px circle at 18% 0%, rgba(255,45,174,0.22), transparent 70%), radial-gradient(520px circle at 85% 100%, rgba(255,138,0,0.16), transparent 70%)",
              }}
            />
            <GradientBlob tone="show" className="-left-16 -top-16 h-48 w-64" />
            <GradientBlob tone="show" className="-bottom-16 -right-12 h-48 w-64" />
          </div>
          <div className="relative">
            <blockquote className="text-3xl font-extrabold tracking-tight text-cream-bright sm:text-4xl">
              “If there were two of me, I would <GradWord>double</GradWord> my business.”
            </blockquote>
            <p className="mx-auto mt-4 max-w-xl text-lg text-cream/75">
              Now there are two of you. One plays the gigs. The other wins them — every lead
              answered in minutes, followed up for days, carried all the way to booked. And it
              always asks before sending.
            </p>
            <Link
              href="/onboarding"
              className="mt-8 inline-block rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-opacity hover:opacity-90"
            >
              Start free
            </Link>
            <p className="mt-4 text-sm text-cream/65">{TRUST_LINE}</p>
            <p className="mt-1 text-xs text-cream/50">
              Then from $25/mo. At your lead cap we pause — never a surprise bill.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
