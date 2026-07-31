// Bright Ears homepage — artist-first, outcome-first.
//
// The product has two jobs: find new rooms and handle the inquiries an artist
// already gets. The previous page repeated those mechanics across eleven long
// sections. This version tells the whole story in one pass: one profile, a
// working assistant, one approval queue. Motion demonstrates the work happening
// instead of adding decoration for decoration's sake.
import type { Metadata } from "next";
import Link from "next/link";
import {
  GradientBlob,
  HaloRing,
  RingsBackdrop,
  StickerChip,
  VinylDisc,
} from "@/components/collage";
import { DemoWidget } from "@/components/demo-widget";
import { KineticHeadline, Marquee, RevealOnScroll } from "@/components/motion";
import { Kicker } from "@/components/ui";
import { pageMeta, organizationJsonLd, softwareApplicationJsonLd } from "@/lib/marketing/site";

export const metadata: Metadata = pageMeta(
  "Bright Ears — your booking assistant for more gigs and less chasing",
  "Build one artist profile. Bright Ears finds venues that fit, drafts pitches and replies in your voice, follows up, and waits for your approval. No video required.",
);

const MARQUEE_ITEMS = [
  "MORE PLAYING",
  "LESS CHASING",
  "PITCHES IN YOUR VOICE",
  "REPLIES READY",
  "YOU STAY IN CONTROL",
];

const SETUP_STEPS = [
  {
    number: "01",
    title: "Build one artist profile",
    body: "Your sound, home city, fee floor, a short bio and one clear photo. Start with the essentials; polish the rest whenever you want.",
    note: "No video required",
  },
  {
    number: "02",
    title: "Your assistant goes looking",
    body: "It watches public venue signals and the sources you already use, then brings back the rooms and inquiries that actually fit.",
    note: "Starts when you subscribe",
  },
  {
    number: "03",
    title: "Approve from your phone",
    body: "Pitches and replies arrive already written in your voice. Tap approve, edit if you like, and Bright Ears handles the follow-up.",
    note: "You keep final say",
  },
];

const SMALL_WINS = [
  {
    label: "Travel mode",
    title: "Take the hunt with you",
    body: "Add a city and dates. Bright Ears looks for guest spots while you’re there.",
  },
  {
    label: "Quietly useful",
    title: "Scams stay out",
    body: "Suspicious inquiries are filtered before they become another thing on your phone.",
  },
  {
    label: "Still working",
    title: "Follow-up is automatic",
    body: "Polite nudges continue until there is an answer, a booking or an opt-out.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$25",
    body: "One home city · up to 15 inquiries a month · you approve every send",
    featured: true,
  },
  {
    name: "Pro",
    price: "$79",
    body: "Up to 3 cities · 60 inquiries a month · trusted-source autopilot",
    featured: false,
  },
  {
    name: "Studio",
    price: "$149",
    body: "All your cities · 150 inquiries a month · full-stretch autopilot",
    featured: false,
  },
];

function GradWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
      {children}
    </span>
  );
}

/** A readable, animated example of the assistant's working state. */
function AssistantLiveCard() {
  const rows = [
    {
      kicker: "Looking",
      title: "Scanning Bangkok",
      detail: "18 venue signals checked",
      tone: "bg-brand-cyan",
    },
    {
      kicker: "Found",
      title: "3 rooms worth a look",
      detail: "Fit and timing explained",
      tone: "bg-neon-orange",
    },
    {
      kicker: "Ready",
      title: "Pitch waiting for you",
      detail: "Written in your voice",
      tone: "bg-neon-magenta",
    },
  ];

  return (
    <div className="be-agent-card relative mx-auto max-w-xl">
      <GradientBlob tone="show" className="-bottom-10 -right-8 h-48 w-72" />
      <GradientBlob tone="cyan" className="-left-8 -top-8 h-36 w-52" />
      <div className="relative overflow-hidden rounded-[2rem] bg-cream p-5 text-ink-stage shadow-[0_32px_100px_rgba(0,0,0,0.5)] sm:p-7">
        <div aria-hidden className="be-scan-line" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink-stage/45">
              Your assistant
            </p>
            <p className="mt-1 text-xl font-black tracking-tight">Working between gigs</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-ink-stage px-3 py-1.5 text-cream-bright">
            <span aria-hidden className="be-live-dot size-2 rounded-full bg-brand-cyan" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">Live</span>
          </div>
        </div>

        <div className="relative mt-6 space-y-2.5">
          {rows.map((row, index) => (
            <div
              key={row.title}
              className="be-agent-row flex items-center gap-3 rounded-2xl border border-ink-stage/10 bg-white/85 p-3 shadow-sm"
              style={{ animationDelay: `${index * 900}ms` }}
            >
              <span aria-hidden className={`size-2.5 flex-none rounded-full ${row.tone}`} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-stage/40">
                  {row.kicker}
                </p>
                <p className="truncate text-sm font-extrabold">{row.title}</p>
              </div>
              <p className="hidden text-right text-[11px] leading-tight text-ink-stage/45 sm:block">
                {row.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="relative mt-5 flex items-center justify-between gap-4 border-t border-ink-stage/10 pt-4">
          <p className="max-w-[240px] text-xs leading-relaxed text-ink-stage/55">
            Nothing sends without your say-so on Starter.
          </p>
          <span className="rounded-full bg-brand-cyan px-4 py-2 text-xs font-black text-ink-stage shadow-[0_8px_24px_rgba(0,187,228,0.25)]">
            Review pitch
          </span>
        </div>

        <VinylDisc
          size={92}
          tone="orange"
          spin
          className="-bottom-11 -left-10 opacity-90"
        />
      </div>
      <StickerChip tone="magenta" rotate={4} className="absolute -right-2 -top-3">
        Three good fits
      </StickerChip>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <RingsBackdrop />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px circle at 82% 180px, rgba(255,45,174,0.13), transparent 68%), radial-gradient(540px circle at 8% 80px, rgba(0,187,228,0.09), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pb-20 pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:pb-24 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/25 bg-cream/5 px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cream/75">
              <span className="size-1.5 rounded-full bg-brand-cyan" />
              A booking assistant built for performers
            </span>
            <h1 className="mt-7 text-6xl font-black leading-[0.93] tracking-tighter text-cream-bright sm:text-7xl lg:text-[5.7rem]">
              <KineticHeadline accentWord="gigs.">More gigs. Less chasing.</KineticHeadline>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-cream/72 sm:text-xl">
              Tell Bright Ears who you are and where you play. It finds venues that fit, writes the
              pitch and every reply in your voice, then keeps following up.{" "}
              <strong className="font-bold text-cream-bright">You approve. It handles the rest.</strong>
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/onboarding"
                className="rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(255,45,174,0.55)] active:translate-y-0"
              >
                Build my profile
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border-[1.5px] border-cream/35 px-7 py-3.5 text-lg font-semibold text-cream transition-colors hover:border-brand-cyan hover:text-brand-cyan"
              >
                See how it works
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cream/55">
              <span>No video required</span>
              <span aria-hidden className="text-neon-magenta">/</span>
              <span>Saves as you go</span>
              <span aria-hidden className="text-neon-magenta">/</span>
              <span>Month to month</span>
            </div>
          </div>

          <div>
            <AssistantLiveCard />
          </div>
        </div>
      </section>

      <Marquee items={MARQUEE_ITEMS} className="border-y border-cream/10 py-4" />

      {/* Setup story */}
      <section id="how-it-works" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <RevealOnScroll className="max-w-3xl">
            <Kicker>One profile. Then it works.</Kicker>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
              Set up the <GradWord>essentials.</GradWord> Add the polish later.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cream/68">
              Bright Ears needs enough to represent you well, not your life story. The setup is
              broken into small steps, saves as you go, and tells you why each answer matters.
            </p>
          </RevealOnScroll>

          <ol className="relative mt-14 grid gap-6 lg:grid-cols-3">
            <div
              aria-hidden
              className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-brand-cyan via-neon-magenta to-neon-orange lg:block"
            />
            {SETUP_STEPS.map((step, index) => (
              <RevealOnScroll key={step.number} delayMs={index * 110}>
                <li className="relative h-full rounded-3xl border border-cream/10 bg-ink-raised p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cream/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
                  <span className="relative z-10 inline-flex size-12 items-center justify-center rounded-full bg-cream font-mono text-sm font-black text-ink-stage shadow-lg">
                    {step.number}
                  </span>
                  <h3 className="mt-6 text-2xl font-black tracking-tight text-cream-bright">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-cream/60">{step.body}</p>
                  <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-cyan">
                    {step.note}
                  </p>
                </li>
              </RevealOnScroll>
            ))}
          </ol>
        </div>
      </section>

      {/* The two halves, explained in the simplest possible language. */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-4 sm:pb-20">
        <RevealOnScroll className="max-w-2xl lg:ml-auto lg:text-right">
          <Kicker>Two ways it keeps you booked</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
            New rooms found. Incoming leads <GradWord>handled.</GradWord>
          </h2>
        </RevealOnScroll>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <RevealOnScroll>
            <div className="relative h-full overflow-hidden rounded-[2rem] bg-cream p-8 text-ink-stage shadow-[0_28px_80px_rgba(0,0,0,0.42)] sm:p-10">
              <HaloRing width={250} height={92} tilt={-10} className="-right-8 top-12" />
              <StickerChip tone="magenta" rotate={-4}>Find new work</StickerChip>
              <h3 className="relative mt-6 max-w-md text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl">
                Rooms you would never have known to call.
              </h3>
              <p className="relative mt-5 max-w-lg text-base leading-relaxed text-ink-stage/65">
                Bright Ears watches for venue openings, entertainment programmes, hiring signals
                and rooms already booking acts like yours. Every match comes with the reason it
                fits—then a pitch is drafted for you.
              </p>
              <div className="relative mt-8 grid gap-2 sm:grid-cols-2">
                {["Fit explained", "Contact researched", "Pitch drafted", "You approve"].map(
                  (item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-ink-stage/10 bg-white/70 px-4 py-3 text-sm font-bold"
                    >
                      <span className="mr-2 text-brand-cyan">/</span>
                      {item}
                    </div>
                  ),
                )}
              </div>
              <VinylDisc size={150} tone="orange" spin className="-bottom-16 -right-12" />
            </div>
          </RevealOnScroll>

          <RevealOnScroll delayMs={120}>
            <div className="relative h-full overflow-hidden rounded-[2rem] border border-cream/10 bg-ink-raised p-8 sm:p-10">
              <GradientBlob tone="cyan" className="-right-16 -top-16 h-52 w-72" />
              <StickerChip tone="cream" rotate={4}>Handle inquiries</StickerChip>
              <h3 className="relative mt-6 text-4xl font-black leading-[0.98] tracking-tight text-cream-bright">
                The lead is answered while you’re still on stage.
              </h3>
              <p className="relative mt-5 text-base leading-relaxed text-cream/65">
                Forward inquiries from email, your website or booking platforms. Bright Ears reads
                them, filters the scams, checks your availability and writes the reply in your voice.
              </p>
              <div className="relative mt-8 rounded-2xl bg-white p-4 text-ink-stage shadow-xl">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-stage/40">
                  Reply ready
                </p>
                <p className="mt-2 text-sm font-extrabold">
                  “Hi Maya — October 17 is open, and I’d love to play the Grandview…”
                </p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-xs text-ink-stage/45">Your voice · availability checked</span>
                  <span className="rounded-full bg-brand-cyan px-3 py-1.5 text-xs font-black">
                    Approve
                  </span>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delayMs={100}>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {SMALL_WINS.map((win) => (
              <div key={win.title} className="rounded-3xl border border-cream/10 bg-ink-raised p-5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-cyan">
                  {win.label}
                </p>
                <h3 className="mt-2 text-lg font-black tracking-tight text-cream-bright">{win.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/55">{win.body}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </section>

      {/* Demo */}
      <section id="demo" className="scroll-mt-20 border-y border-cream/10">
        <RevealOnScroll className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <Kicker>Hear your voice come back</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
            Paste an inquiry. Watch the reply <GradWord>write itself.</GradWord>
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream/68">
            No sign-up needed. Use a real inquiry or the sample, then see what your artist assistant
            would send back.
          </p>
          <div className="relative mt-10">
            <GradientBlob tone="show" className="-bottom-10 -left-8 h-44 w-72" />
            <DemoWidget />
          </div>
        </RevealOnScroll>
      </section>

      {/* Credibility without another long story section. */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-[2rem] border border-cream/10 bg-ink-raised p-8 sm:p-12">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(520px circle at 90% 0%, rgba(255,45,174,0.14), transparent 68%), radial-gradient(420px circle at 4% 100%, rgba(0,187,228,0.09), transparent 70%)",
              }}
            />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl">
                <Kicker>Built inside a real entertainment business</Kicker>
                <blockquote className="mt-4 text-3xl font-black leading-tight tracking-tight text-cream-bright sm:text-5xl">
                  Twenty years around venues taught us one thing:{" "}
                  <GradWord>talent is rarely the bottleneck.</GradWord> Time is.
                </blockquote>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-cream/65">
                  Bright Ears began as the back office for our own agency in Bangkok. It now does
                  the same unglamorous chasing for independent performers—without pretending it can
                  guarantee the booking.
                </p>
              </div>
              <Link
                href="/story"
                className="relative font-semibold text-brand-cyan transition-opacity hover:opacity-80"
              >
                Read our story →
              </Link>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <RevealOnScroll className="max-w-3xl">
          <Kicker>Start with one city</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
            The whole assistant starts at <GradWord>$25 a month.</GradWord>
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream/68">
            Every plan finds venues and handles inquiries. The only differences are how many cities,
            how many inquiries and how much you want it to send automatically.
          </p>
        </RevealOnScroll>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((plan, index) => (
            <RevealOnScroll key={plan.name} delayMs={index * 100}>
              <div
                className={`relative h-full rounded-3xl p-6 ${
                  plan.featured
                    ? "bg-cream text-ink-stage shadow-[0_24px_70px_rgba(0,0,0,0.42)]"
                    : "border border-cream/10 bg-ink-raised text-cream-bright"
                }`}
              >
                {plan.featured && (
                  <StickerChip tone="magenta" rotate={-3} className="absolute -right-2 -top-3">
                    Start here
                  </StickerChip>
                )}
                <p
                  className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${
                    plan.featured ? "text-ink-stage/45" : "text-cream/50"
                  }`}
                >
                  {plan.name}
                </p>
                <p className="mt-3 text-4xl font-black tracking-tight">
                  {plan.price}
                  <span className={`text-sm font-normal ${plan.featured ? "text-ink-stage/45" : "text-cream/45"}`}>
                    /mo
                  </span>
                </p>
                <p className={`mt-3 text-sm leading-relaxed ${plan.featured ? "text-ink-stage/60" : "text-cream/55"}`}>
                  {plan.body}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
        <RevealOnScroll>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/pricing" className="font-semibold text-brand-cyan hover:opacity-80">
              Compare every plan →
            </Link>
            <span className="text-sm text-cream/50">Month to month · cancel anytime · no surprise usage bills</span>
          </div>
        </RevealOnScroll>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-8">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-[2rem] border border-cream/10 bg-ink-raised px-8 py-14 text-center shadow-[0_30px_90px_rgba(255,45,174,0.18)] sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(520px circle at 18% 0%, rgba(255,45,174,0.22), transparent 70%), radial-gradient(520px circle at 85% 100%, rgba(255,138,0,0.16), transparent 70%)",
              }}
            />
            <div className="relative">
              <Kicker>Your next room is not going to find itself</Kicker>
              <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
                Build the profile once. Let your assistant do the <GradWord>chasing.</GradWord>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-cream/68">
                Start with the essentials. No video, no technical setup, and no need to finish every
                detail before you see your dashboard.
              </p>
              <Link
                href="/onboarding"
                className="mt-8 inline-block rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(255,45,174,0.55)] active:translate-y-0"
              >
                Build my profile
              </Link>
              <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cream/50">
                From $25/month · cancel anytime
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </div>
  );
}
