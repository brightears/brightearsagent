// Landing page — the money page, restaged in design language v2.1 "Edge"
// (docs/DESIGN.md, THE LAW; canonical preview: app/(marketing)/design/b/page.tsx).
// Ink canvas, one RingsBackdrop (hero only), cream poster panels with collage
// pieces, magenta show CTAs, cyan reserved for clickable interface. Kinetic
// hero type, one Marquee divider, mono Kickers on every section, scroll
// reveals (components/motion.tsx). NO EMOJI in chrome (v2.1 rule 1).
// Customers' verbatim language in headlines (docs/PRODUCT-BRIEF.md §3);
// factual claims and hrefs unchanged — every CTA: Start free → /onboarding.
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
import { KineticHeadline, Marquee, RevealOnScroll } from "@/components/motion";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Bright Ears — never miss a gig you never knew existed",
  description:
    "Bright Ears hunts the whole web for gigs that fit you, drafts the outreach in your voice, and waits for your tap. You approve — it does the rest. And when someone reaches out, you're still first to answer. 14-day free trial, no card.",
};

const TRUST_LINE = "14-day free trial, no card · setup in minutes";

const MARQUEE_ITEMS = [
  "FOUND WHILE YOU SLEPT",
  "A GIG YOU'D HAVE MISSED",
  "DRAFTED IN YOUR VOICE",
  "YOU JUST APPROVE",
  "ANYWHERE YOU PLAY",
];

// Illustrative targets, not measured claims (audit honesty rule).
const STATS = [
  { n: "Every week", l: "new rooms that fit you, surfaced for you to approve" },
  { n: "First", l: "and when a lead does come in, you're first to reply" },
  { n: "$1,800", l: "an example booking you might never have known to chase (illustrative)" },
];

/* word-by-word magenta → orange spectrum — the gradient pull-quote treatment */
const STORY_QUOTE: { w: string; c: string }[] = [
  { w: "We’ve", c: "#ff2dae" },
  { w: "been", c: "#ff5a74" },
  { w: "there.", c: "#ff8a00" },
];

/* The effortless promise — 30 seconds a day, approve from your phone. */
const EFFORTLESS = [
  { n: "30 seconds", l: "a day — that’s the whole job" },
  { n: "Your phone", l: "approve from anywhere, even the booth" },
  { n: "Just yes", l: "you say yes; the AI does the rest" },
];

/* Pricing teaser — three plans, discovery-led, mirrors /pricing. */
const PRICING_TEASER = [
  { name: "Starter", price: "$25", l: "Finds gigs and answers leads for a solo performer" },
  { name: "Pro", price: "$79", l: "More headroom, plus auto-send on sources you trust" },
  { name: "Studio", price: "$149", l: "Your whole roster, one inbox, your team" },
];

const STEPS = [
  {
    title: "It finds the gigs",
    body: "The AI scans the whole web for venues hiring entertainment and rooms that fit your sound — the openings you’d never have stumbled across. Each one comes scored, with the reasons spelled out.",
  },
  {
    title: "It drafts in your voice",
    body: "For every good fit, it writes the outreach the way you’d say it — warm, specific, in your own words. No blank page, no “Dear Sir or Madam,” nothing that sounds like a robot.",
  },
  {
    title: "You just approve",
    body: "The draft lands on your phone. One tap — even from the booth — and it sends from your own mailbox. You say yes; the AI does the rest. You’re never the one staring at the inbox.",
  },
];

const FEATURES: {
  chip: string;
  chipTone: "magenta" | "cream" | "ink" | "outline";
  chipRotate: number;
  title: string;
  body: string;
  tilt: string;
}[] = [
  {
    chip: "The Hunt",
    chipTone: "magenta",
    chipRotate: -4,
    title: "It finds gigs you’d have missed",
    body: "The AI scans the whole web for venues hiring entertainment and rooms that fit your sound, scores how well each one fits you, and drafts the intro in your voice. You approve; it sends from your own mailbox. It can’t promise the room says yes — but it makes sure you’re the one who asked.",
    tilt: "-rotate-1",
  },
  {
    chip: "Marked: scam",
    chipTone: "ink",
    chipRotate: -4,
    title: "The scam emails you’ll never see",
    body: "Every inquiry is triaged before it reaches your phone. The overpayment scams, the spam blasts, the fake “event planners” — gone. You only ever see real chances worth your time.",
    tilt: "rotate-1",
  },
  {
    chip: "Booked or dead",
    chipTone: "magenta",
    chipRotate: 5,
    title: "Nudges until you get an answer",
    body: "Most gigs are won by the follow-up nobody has time to send. Polite nudges keep going until there’s a reply — and stop instantly on an answer, a booking, or a one-tap opt-out.",
    tilt: "-rotate-[0.6deg]",
  },
  {
    chip: "Monday, 9:00",
    chipTone: "ink",
    chipRotate: -5,
    title: "A weekly report that proves it",
    body: "Every week: the rooms it found, what came in, what got an answer. Numbers you can feel good about — or forward straight to your business partner.",
    tilt: "rotate-[0.6deg]",
  },
  {
    chip: "From: you",
    chipTone: "outline",
    chipRotate: 4,
    title: "Your clients see you, never us",
    body: "Everything sends from your business name, with your reply-to address. No “AI”, no Bright Ears branding anywhere — venues and clients just see a performer who’s impressively on it.",
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
      {/* ---------- Hero — ink stage, rings, kinetic headline, collage poster ---------- */}
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
            The AI that finds gigs for DJs &amp; event performers
          </span>
          <h1 className="mt-7 max-w-4xl text-6xl font-black leading-[0.95] tracking-tighter text-cream-bright sm:text-7xl lg:text-8xl">
            <KineticHeadline accentWord="gig">Never miss a gig you never knew existed.</KineticHeadline>
          </h1>
          <div className="mt-10 grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              {/* The one-liner: discovery-led. The Hunt is the hero now. */}
              <p className="max-w-xl text-lg leading-relaxed text-cream/70">
                Bright Ears hunts the whole web for opportunities that fit you, drafts the outreach
                in your voice, and waits for your tap. You{" "}
                <strong className="font-bold text-cream-bright">approve</strong> — it does the rest.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/onboarding"
                  className="rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-opacity hover:opacity-90"
                >
                  Start free — no card
                </Link>
                <a
                  href="#demo"
                  className="inline-flex items-center gap-2.5 rounded-full border-[1.5px] border-cream/40 px-7 py-3.5 text-lg font-semibold text-cream transition-colors hover:border-cream/75 hover:text-cream-bright"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-cream/50 text-[8px] leading-none">
                    &#9654;
                  </span>
                  See it draft a pitch
                </a>
              </div>
              <p className="mt-6 text-sm text-cream/65">{TRUST_LINE}</p>
            </div>
            <HeroCollage />
          </div>
        </div>
      </section>

      {/* ---------- Marquee — the full-bleed edge divider (one per page, LAW) ---------- */}
      <Marquee items={MARQUEE_ITEMS} className="border-y border-cream/10 py-4" />

      {/* ---------- Problem — the loss frame: gigs filled before you hear about them ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <RevealOnScroll className="max-w-2xl">
          <Kicker>The problem</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
            The best gigs are filled <GradWord>before you hear</GradWord> about them.
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            Most rooms never post a “DJ wanted” ad. The bar that just changed managers, the hotel
            relaunching its rooftop, the venue whose regular act just quit — those gigs go to
            whoever happens to be in front of them. Usually that’s not you. Not because you’re not
            good enough. Because nobody had time to go looking.
          </p>
        </RevealOnScroll>
        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          {/* The gigs you never see */}
          <RevealOnScroll className="relative">
            <GradientBlob tone="show" className="-bottom-8 -left-6 h-36 w-52" />
            <div className="relative -rotate-2 overflow-hidden rounded-3xl bg-cream p-7 pb-8 text-ink-stage shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <div className="relative h-28">
                <HaloRing width={170} height={62} tilt={-12} className="left-0 top-9" />
                <VinylDisc size={104} tone="dark" className="-right-3 -top-5" />
                <StickerChip tone="ink" rotate={-5} className="absolute left-1 top-0">
                  Never posted
                </StickerChip>
              </div>
              <h3 className="mt-6 text-xl font-extrabold tracking-tight">The gigs you never see</h3>
              <blockquote className="mt-2 text-base font-bold leading-snug">
                “I only find out a venue was hiring once they’ve booked someone else.”
              </blockquote>
              <p className="mt-3 text-sm leading-relaxed text-ink-stage/65">
                You can’t pitch a room you don’t know is open. The opportunities that fit you best
                are the ones you’ll never stumble across in time.
              </p>
            </div>
          </RevealOnScroll>

          {/* No time to go looking */}
          <RevealOnScroll className="relative lg:mt-8" delayMs={120}>
            <GradientBlob tone="show" className="-bottom-8 -right-6 h-36 w-52" />
            <div className="relative rotate-1 overflow-hidden rounded-3xl bg-cream p-7 pb-8 text-ink-stage shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <div className="relative h-28">
                <StudioSpeaker size={72} className="left-6 top-0 -rotate-3" />
                <HaloRing width={150} height={56} tilt={12} className="right-0 top-12" />
                <StickerChip tone="ink" rotate={5} className="absolute right-0 top-0">
                  2:13 am
                </StickerChip>
              </div>
              <h3 className="mt-6 text-xl font-extrabold tracking-tight">No time to go looking</h3>
              <blockquote className="mt-2 text-base font-bold leading-snug">
                “Falling asleep with the laptop on.”
              </blockquote>
              <p className="mt-3 text-sm leading-relaxed text-ink-stage/65">
                You already played four hours. Hunting for new venues and writing cold intros is the
                last thing you have energy for. So it never happens.
              </p>
            </div>
          </RevealOnScroll>

          {/* The ceiling */}
          <RevealOnScroll className="relative lg:mt-3" delayMs={240}>
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
              <h3 className="mt-6 text-xl font-extrabold tracking-tight">The ceiling</h3>
              <blockquote className="mt-2 text-base font-bold leading-snug">
                “If there were two of me, I would double my business.”
              </blockquote>
              <p className="mt-3 text-sm leading-relaxed text-ink-stage/65">
                The second you would be the one out finding work — knocking on doors, sending the
                intros, chasing the next room. That’s exactly the half nobody has time for.
              </p>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ---------- The honest promise — candid line, right under the problem ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-raised p-8 sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(480px circle at 90% 10%, rgba(255,45,174,0.12), transparent 70%), radial-gradient(420px circle at 10% 100%, rgba(255,138,0,0.08), transparent 70%)",
              }}
            />
            <div className="relative max-w-2xl">
              <Kicker>The honest promise</Kicker>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
                We can’t promise you the booking. We promise you <GradWord>never miss the shot.</GradWord>
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-cream/75">
                The AI surfaces every opportunity that fits you and drafts your pitch in your voice.
                Whether you win the room is still down to you and the venue — that part’s honest, and
                it always will be.
              </p>
              <p className="mt-3 text-lg leading-relaxed text-cream/75">
                What we guarantee is the part that was slipping away:{" "}
                <strong className="font-bold text-cream-bright">
                  you’ll never miss a chance to put yourself forward
                </strong>{" "}
                — the AI finds it, drafts it, you just approve.
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ---------- How it works — 3 steps, discovery-first, scannable ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <RevealOnScroll className="max-w-2xl lg:ml-auto lg:text-right">
          <Kicker>How it works</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
            It finds. It drafts. You <GradWord>just say yes.</GradWord>
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            You play the gigs. This goes out and finds the next ones. Three steps, about five minutes
            of setup, and then it’s working while you sleep.
          </p>
        </RevealOnScroll>
        <RevealOnScroll delayMs={100}>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-3xl border border-cream/10 bg-ink-raised p-6">
                <span
                  aria-hidden
                  className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text font-mono text-4xl font-black tracking-tight text-transparent"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-cream-bright">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/60">{s.body}</p>
              </li>
            ))}
          </ol>
        </RevealOnScroll>
      </section>

      {/* ---------- Effortless — 30 seconds a day, approve from your phone ---------- */}
      <section className="border-y border-cream/10">
        <RevealOnScroll className="mx-auto max-w-6xl px-6 py-12">
          <Kicker>How little it asks of you</Kicker>
          <h2 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-cream-bright sm:text-4xl">
            30 seconds a day. Approve from your phone. You <GradWord>just say yes.</GradWord>
          </h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-3">
            {EFFORTLESS.map((s) => (
              <div key={s.n}>
                <div className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-4xl font-black tracking-tight text-transparent">
                  {s.n}
                </div>
                <div className="mt-2 max-w-[240px] text-sm leading-snug text-cream/55">{s.l}</div>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </section>

      {/* ---------- Reactive — the supporting beat: when someone does reach out ---------- */}
      <section id="demo" className="scroll-mt-20">
        <RevealOnScroll className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <Kicker>And the other half</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
            When someone does reach out, you’re still the <GradWord>first to answer.</GradWord>
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            Finding new rooms is the hero. But Bright Ears also catches every inquiry that lands in
            your inbox — wedding, corporate, party, residency — drafts the reply in your voice, and
            pings your phone to approve. Paste a real inquiry below and watch it write the reply,
            live.
          </p>
          <div className="relative mt-10">
            <GradientBlob tone="show" className="-bottom-10 -left-8 h-44 w-72" />
            <DemoWidget />
          </div>
        </RevealOnScroll>
      </section>

      {/* ---------- The story — the Vinyl band, gradient pull quote ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <RevealOnScroll>
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
              <Kicker>Our story</Kicker>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
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
                our own agency in Bangkok. Her name is Vinyl, and she still runs it today — finding
                new rooms, answering every inquiry, keeping every gig straight.
              </p>
              <p className="mt-3 text-lg leading-relaxed text-cream/75">
                Bright Ears is that same back office — now she goes hunting for yours.
              </p>
              <Link
                href="/story"
                className="mt-6 inline-block font-semibold text-brand-cyan transition-opacity hover:opacity-80"
              >
                Read the whole story →
              </Link>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ---------- Features grid — cream posters, header right-aligned ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <RevealOnScroll className="max-w-2xl lg:ml-auto lg:text-right">
          <Kicker>What you get</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
            The chasing nobody has time for, <GradWord>handled.</GradWord>
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            Finding the rooms, writing the intros, answering the leads, sending the nudges — all the
            work that usually never happens, done for you. Included on every plan, without the 2am
            shift.
          </p>
        </RevealOnScroll>
        <RevealOnScroll delayMs={100}>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`rounded-3xl bg-cream p-7 text-ink-stage shadow-[0_20px_50px_rgba(0,0,0,0.4)] ${f.tilt}`}
              >
                <StickerChip tone={f.chipTone} rotate={f.chipRotate}>
                  {f.chip}
                </StickerChip>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-stage/65">{f.body}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
        <RevealOnScroll delayMs={150}>
          <p className="mt-14 text-center text-sm font-semibold text-cream/60">
            And it catches the leads you already get
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
          <p className="mt-3 text-center text-xs text-cream/65">
            Simple email forwarding — no password sharing, no OAuth.
          </p>
        </RevealOnScroll>
      </section>

      {/* ---------- Social proof / what to expect — illustrative targets, no measured claims ---------- */}
      <section className="border-y border-cream/10">
        <RevealOnScroll className="mx-auto max-w-6xl px-6 py-12">
          <Kicker>What to expect</Kicker>
          <div className="mt-6 grid gap-10 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.n}>
                <div className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-4xl font-black tracking-tight text-transparent">
                  {s.n}
                </div>
                <div className="mt-2 max-w-[230px] text-sm leading-snug text-cream/55">{s.l}</div>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-xs leading-relaxed text-cream/65">
            Results depend on demand where you play — we can’t promise the booking, only that you
            never miss the shot at it.
          </p>
        </RevealOnScroll>
      </section>

      {/* ---------- Pricing teaser — three plans, discovery-led ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <RevealOnScroll className="max-w-2xl">
          <Kicker>Pricing</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
            Less than one good <GradWord>gig.</GradWord>
          </h2>
          <p className="mt-3 text-lg text-cream/70">
            Every plan is the complete engine — it hunts venues for you and answers every inquiry.
            Plans only change how many leads, performers and how much autopilot. Start free, no card.
          </p>
        </RevealOnScroll>
        <RevealOnScroll delayMs={100}>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {PRICING_TEASER.map((p) => (
              <div key={p.name} className="rounded-3xl border border-cream/10 bg-ink-raised p-6">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cream/55">
                  {p.name}
                </p>
                <p className="mt-3 text-4xl font-black tracking-tight text-cream-bright">
                  {p.price}
                  <span className="text-base font-normal text-cream/50">/mo</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-cream/60">{p.l}</p>
              </div>
            ))}
          </div>
          <p className="mt-8">
            <Link
              href="/pricing"
              className="font-semibold text-brand-cyan transition-opacity hover:opacity-80"
            >
              See everything in each plan →
            </Link>
          </p>
        </RevealOnScroll>
      </section>

      {/* ---------- Final CTA — magenta glow band ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-4">
        <RevealOnScroll>
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
              <Kicker>The encore</Kicker>
              <blockquote className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
                Never miss a gig you <GradWord>never knew existed.</GradWord>
              </blockquote>
              <p className="mx-auto mt-4 max-w-xl text-lg text-cream/75">
                The AI finds the rooms, drafts the pitch in your voice, and waits for your tap. You
                approve; it does the rest. And when a lead comes in, you’re still first to answer.
              </p>
              <Link
                href="/onboarding"
                className="mt-8 inline-block rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-opacity hover:opacity-90"
              >
                Start free — no card
              </Link>
              <p className="mt-4 text-sm text-cream/65">{TRUST_LINE}</p>
              <p className="mt-1 text-xs text-cream/65">
                From $25/mo. At your lead cap we pause — never a surprise bill.
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </div>
  );
}
