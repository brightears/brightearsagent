import type { Metadata } from "next";
import Link from "next/link";
import {
  GradientBlob,
  HaloRing,
  RingsBackdrop,
  StickerChip,
  VinylDisc,
} from "@/components/collage";

export const metadata: Metadata = {
  title: "Our story — Bright Ears",
  description:
    "Twenty years running a DJ agency for five-star hotel venues in Bangkok. Drowning in schedules, invoices and messages, we built an AI back office for ourselves — her name is Vinyl, she still runs the agency today. Now she works for wedding and event performers everywhere.",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Bright Ears",
  url: "https://brightears.io",
  logo: "https://brightears.io/brand/logo.svg",
  description:
    "Bright Ears is the AI back office for wedding and event performer businesses: every inquiry answered in under 5 minutes, in your voice, with your real availability — approved from your phone, followed up until booked. Built by a team that has run entertainment for five-star hotel venues in Bangkok for 20 years.",
  slogan: "Every inquiry answered in minutes.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bangkok",
    addressCountry: "TH",
  },
};

/** The v2 signature: one gradient-painted word in a warm-white/ink headline. */
const GRAD = "bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent";

/* word-by-word magenta → orange spectrum (docs/DESIGN.md gradient pull quotes) */
const SHOW_FROM = [255, 45, 174] as const;
const SHOW_TO = [255, 138, 0] as const;
function spectrumAt(i: number, count: number): string {
  const t = count <= 1 ? 0 : i / (count - 1);
  const c = SHOW_FROM.map((from, ch) => Math.round(from + (SHOW_TO[ch] - from) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function SectionMark({ children }: { children: string }) {
  return (
    <StickerChip tone="ink" rotate={-2}>
      {children}
    </StickerChip>
  );
}

function PullQuote({ children }: { children: string }) {
  const words = `“${children}”`.split(" ");
  return (
    <blockquote className="my-10">
      <p className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">
        {words.map((w, i) => (
          <span key={i} style={{ color: spectrumAt(i, words.length) }}>
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      <footer className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-ink-stage/55">
        — a working DJ, saying out loud what thousands feel
      </footer>
    </blockquote>
  );
}

export default function StoryPage() {
  return (
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* one ring pattern per page (LAW) + soft neon vignettes, hero only */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40rem]">
        <RingsBackdrop />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(620px circle at 80% 180px, rgba(255,45,174,0.10), transparent 70%), radial-gradient(520px circle at 6% 80px, rgba(255,138,0,0.07), transparent 70%)",
          }}
        />
      </div>

      {/* Hero */}
      <section className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-14 text-center">
        <StickerChip tone="cream" rotate={-2}>
          Our story
        </StickerChip>
        <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight text-cream-bright text-balance">
          We didn&apos;t set out to build software. We set out to get our{" "}
          <span className={GRAD}>nights</span> back.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-cream/70 text-balance">
          Twenty years running entertainment for venues taught us two things:
          the show is the easy part, and the inbox never sleeps. This is the
          story of what we did about it.
        </p>
      </section>

      {/* The narrative — one long cream poster panel floating on the ink */}
      <section className="relative max-w-3xl mx-auto px-6 pb-24">
        <div className="relative">
          <GradientBlob tone="show" className="-top-10 -left-12 h-44 w-64" />
          <GradientBlob tone="show" className="-bottom-12 -right-10 h-44 w-72" />
          <article className="relative overflow-hidden rounded-[2rem] bg-cream px-7 py-12 shadow-[0_36px_90px_rgba(0,0,0,0.5)] sm:px-12 sm:py-14">
            {/* collage accents */}
            <HaloRing width={260} height={94} tilt={-12} className="-right-20 top-8" />
            <VinylDisc size={190} tone="dark" className="-bottom-16 -right-14" />
            <span aria-hidden className="absolute right-12 top-24 text-xl text-ink-stage/25">
              &#10022;
            </span>
            <span aria-hidden className="absolute left-8 bottom-24 text-sm text-neon-magenta/40">
              &#10022;
            </span>

            <div className="relative space-y-14">
              {/* Chapter 1 */}
              <section>
                <SectionMark>Bangkok, twenty years of show nights</SectionMark>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage">
                  The agency behind the five-star stages
                </h2>
                <div className="mt-5 space-y-5 text-ink-stage/75 leading-relaxed">
                  <p>
                    For two decades we&apos;ve run a DJ agency in Bangkok, serving
                    five-star hotel venues — rooftop bars, ballrooms, pool decks,
                    lobby lounges. On any given night, somewhere in the city, one of
                    our performers is opening a set under our name. It&apos;s a
                    wonderful business. It&apos;s also a relentless one.
                  </p>
                  <p>
                    Because behind every smooth Saturday night is a weekday avalanche:
                    the monthly schedules for every venue, the swap requests, the
                    invoices that have to go out correctly and on time, the messages —
                    from venue managers, from performers, from anyone — that all
                    expect an answer today. The same questions, the same documents,
                    the same chasing. Every week. Forever.
                  </p>
                  <p>
                    We loved the rooms, the music, the partnerships. We did not love
                    doing paperwork at one in the morning. Anyone who has ever fallen
                    asleep with the laptop on knows exactly which part of this job we
                    mean.
                  </p>
                </div>
              </section>

              {/* Chapter 2 */}
              <section>
                <SectionMark>So we built ourselves an employee</SectionMark>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage">
                  Her name is Vinyl
                </h2>
                <div className="mt-5 space-y-5 text-ink-stage/75 leading-relaxed">
                  <p>
                    A few years ago we stopped waiting for someone else to fix this
                    and built an AI back office for our own agency. We gave her a
                    name: <span className="font-bold text-ink-stage">Vinyl</span>.
                    Not a chatbot bolted onto the side — the actual back office. The
                    schedules. The invoices. The messages.
                  </p>
                  <p>
                    Here&apos;s the part we&apos;re proudest of:{" "}
                    <span className="font-bold text-ink-stage">
                      she still runs the agency today.
                    </span>{" "}
                    Vinyl schedules every performer night. She prepares every invoice.
                    She keeps the threads with our venues moving while we sleep, and
                    we check her work over coffee instead of fighting it at midnight.
                    She isn&apos;t a demo or a pitch-deck slide — she has been doing
                    this job, for a real business, every single day.
                  </p>
                  <p>
                    The agency didn&apos;t get smaller when she arrived. Our nights
                    did.
                  </p>
                </div>
              </section>

              {/* Chapter 3 */}
              <section>
                <SectionMark>Then we looked around</SectionMark>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage">
                  Wedding performers are fighting the same fight — alone
                </h2>
                <div className="mt-5 space-y-5 text-ink-stage/75 leading-relaxed">
                  <p>
                    Talking with wedding and event DJs, bands, and performers around
                    the world, we kept hearing our old life — except harder. They
                    don&apos;t have an agency&apos;s back office. They <em>are</em> the
                    back office, at night, around gigs, day jobs, and kids.
                  </p>
                </div>
                <PullQuote>
                  Get an inquiry, immediately respond, and then nothing.
                </PullQuote>
                <div className="space-y-5 text-ink-stage/75 leading-relaxed">
                  <p>
                    Couples book whoever replies first — and a third of vendors never
                    reply at all. One DJ told us, &ldquo;You don&apos;t want to be the
                    5th DJ that reaches out.&rdquo; Another wrote the spec for us
                    without knowing it: &ldquo;I can&apos;t always text the lead
                    within 5 minutes... I want to automate this.&rdquo; And the one
                    that stuck with us most:
                  </p>
                </div>
                <PullQuote>
                  If there were two of me, I would double my business.
                </PullQuote>
                <div className="space-y-5 text-ink-stage/75 leading-relaxed">
                  <p>
                    We knew that feeling. And this time, we knew exactly what to do
                    about it.
                  </p>
                </div>
              </section>

              {/* Chapter 4 */}
              <section>
                <SectionMark>Now she works for yours</SectionMark>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage">
                  Bright Ears is that back office, built for your business
                </h2>
                <div className="mt-5 space-y-5 text-ink-stage/75 leading-relaxed">
                  <p>
                    We took what Vinyl does for our agency and rebuilt it for wedding
                    and event performer businesses everywhere. Bright Ears catches
                    every inquiry — The Knot, WeddingWire, Bark, GigSalad, your
                    website forms, plain email — through one simple forwarding rule.
                    No password sharing. No inbox takeover.
                  </p>
                  <p>
                    It filters out the spam and scams before you see them, then drafts
                    a reply in <em>your</em> voice, from <em>your</em> rate card, with{" "}
                    <em>your</em> real availability. You approve it from your phone —
                    from the booth, between ceremonies, from the couch. Designed to
                    reply in under 5 minutes. Then it follows up until the gig is booked
                    or the lead is truly dead, with a one-tap opt-out on every email.
                  </p>
                  <p>
                    And your clients never see any of it. No &ldquo;AI,&rdquo; no bot
                    branding, no Bright Ears logo in their inbox — just a performer
                    who answers fast, sounds like themselves, and follows through.
                  </p>
                </div>
              </section>

              {/* Honest promises */}
              <section>
                <SectionMark>The honest part</SectionMark>
                <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage">
                  What we promise — and what we don&apos;t
                </h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-ink-stage/10 bg-cream-bright p-6">
                    <div aria-hidden className="h-1 w-8 rounded-full bg-brand-cyan" />
                    <h3 className="mt-3 font-bold text-ink-stage">We promise</h3>
                    <ul className="mt-3 space-y-2 text-sm text-ink-stage/75">
                      <li>Every real inquiry answered in minutes, in your voice</li>
                      <li>You approve everything — or choose auto-send, per source</li>
                      <li>Follow-ups that never stop early and never overstay</li>
                      <li>No surprise bills: at your cap, drafting simply pauses</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-ink-stage/10 bg-cream-bright p-6">
                    <div
                      aria-hidden
                      className="h-1 w-8 rounded-full"
                      style={{ background: "linear-gradient(90deg, #ff2dae, #ff8a00)" }}
                    />
                    <h3 className="mt-3 font-bold text-ink-stage">
                      We won&apos;t promise
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-ink-stage/75">
                      <li>That every lead books — couples are still couples</li>
                      <li>Magic. It&apos;s diligence, done every time, instantly</li>
                      <li>
                        To replace your judgment — you stay the voice and the boss
                      </li>
                    </ul>
                  </div>
                </div>
                <p className="mt-6 text-ink-stage/75 leading-relaxed">
                  What we can tell you is what happened to us: the work got lighter,
                  the replies got faster, and the business got better — because the
                  follow-through finally matched the performance. We&apos;ve been
                  there. That&apos;s the whole story.
                </p>
              </section>
            </div>
          </article>
        </div>
      </section>

      {/* CTA */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-ink-raised border border-cream/10 px-8 py-12 sm:py-16 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(420px circle at 88% 0%, rgba(255,45,174,0.14), transparent 70%), radial-gradient(380px circle at 4% 100%, rgba(255,138,0,0.10), transparent 70%)",
            }}
          />
          <h2 className="relative text-3xl sm:text-4xl font-black tracking-tight text-cream-bright text-balance">
            Give your business its own <span className={GRAD}>back office</span>.
          </h2>
          <p className="relative mt-4 text-cream/70 max-w-xl mx-auto">
            Vinyl runs ours every night. Bright Ears runs yours — 14 days of
            full Pro, free, no card needed.
          </p>
          <Link
            href="/onboarding"
            className="relative mt-8 inline-block rounded-full bg-neon-magenta px-8 py-3.5 font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
          >
            Start free
          </Link>
        </div>
      </section>
    </div>
  );
}
