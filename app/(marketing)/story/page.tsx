import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";

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
  slogan: "Your gigs, answered and booked.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bangkok",
    addressCountry: "TH",
  },
};

function SectionMark({ children }: { children: string }) {
  return (
    <p className="text-sm font-bold uppercase tracking-widest text-brand-cyan">
      {children}
    </p>
  );
}

function PullQuote({ children }: { children: string }) {
  return (
    <blockquote className="my-10 rounded-2xl bg-white border border-off-white shadow-sm px-7 py-6">
      <p className="text-xl sm:text-2xl font-semibold text-deep-teal leading-snug">
        &ldquo;{children}&rdquo;
      </p>
      <footer className="mt-3 text-sm text-ink/50">
        — a working DJ, saying out loud what thousands feel
      </footer>
    </blockquote>
  );
}

export default function StoryPage() {
  return (
    <div className="relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* Playful gradient blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 right-[-10rem] h-96 w-96 rounded-full bg-brand-cyan-soft blur-3xl opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[36rem] left-[-12rem] h-96 w-96 rounded-full bg-soft-lavender/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[90rem] right-[-12rem] h-96 w-96 rounded-full bg-warm-peach/40 blur-3xl"
      />

      {/* Hero */}
      <section className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-14 text-center">
        <Badge tone="lavender">Our story</Badge>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-deep-teal text-balance">
          We didn&apos;t set out to build software. We set out to get our
          nights back.
        </h1>
        <p className="mt-6 text-lg text-ink/70 text-balance">
          Twenty years running entertainment for venues taught us two things:
          the show is the easy part, and the inbox never sleeps. This is the
          story of what we did about it.
        </p>
      </section>

      {/* Chapter 1 */}
      <section className="relative max-w-2xl mx-auto px-6 py-10">
        <SectionMark>Bangkok, twenty years of show nights</SectionMark>
        <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-deep-teal">
          The agency behind the five-star stages
        </h2>
        <div className="mt-5 space-y-5 text-ink/80 leading-relaxed">
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
      <section className="relative max-w-2xl mx-auto px-6 py-10">
        <SectionMark>So we built ourselves an employee</SectionMark>
        <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-deep-teal">
          Her name is Vinyl
        </h2>
        <div className="mt-5 space-y-5 text-ink/80 leading-relaxed">
          <p>
            A few years ago we stopped waiting for someone else to fix this
            and built an AI back office for our own agency. We gave her a
            name: <span className="font-semibold text-deep-teal">Vinyl</span>.
            Not a chatbot bolted onto the side — the actual back office. The
            schedules. The invoices. The messages.
          </p>
          <p>
            Here&apos;s the part we&apos;re proudest of:{" "}
            <span className="font-semibold text-deep-teal">
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
      <section className="relative max-w-2xl mx-auto px-6 py-10">
        <SectionMark>Then we looked around</SectionMark>
        <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-deep-teal">
          Wedding performers are fighting the same fight — alone
        </h2>
        <div className="mt-5 space-y-5 text-ink/80 leading-relaxed">
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
        <div className="space-y-5 text-ink/80 leading-relaxed">
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
        <div className="space-y-5 text-ink/80 leading-relaxed">
          <p>
            We knew that feeling. And this time, we knew exactly what to do
            about it.
          </p>
        </div>
      </section>

      {/* Chapter 4 */}
      <section className="relative max-w-2xl mx-auto px-6 py-10">
        <SectionMark>Now she works for yours</SectionMark>
        <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-deep-teal">
          Bright Ears is that back office, built for your business
        </h2>
        <div className="mt-5 space-y-5 text-ink/80 leading-relaxed">
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
            from the booth, between ceremonies, from the couch. Median first
            reply: under 5 minutes. Then it follows up until the gig is booked
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
      <section className="relative max-w-2xl mx-auto px-6 py-10">
        <SectionMark>The honest part</SectionMark>
        <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-deep-teal">
          What we promise — and what we don&apos;t
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-brand-cyan-soft/50 border border-off-white p-6">
            <h3 className="font-semibold text-deep-teal">We promise</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink/80">
              <li>Every real inquiry answered in minutes, in your voice</li>
              <li>You approve everything — or choose auto-send, per source</li>
              <li>Follow-ups that never stop early and never overstay</li>
              <li>No surprise bills: at your cap, drafting simply pauses</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-warm-peach/40 border border-off-white p-6">
            <h3 className="font-semibold text-deep-teal">
              We won&apos;t promise
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-ink/80">
              <li>That every lead books — couples are still couples</li>
              <li>Magic. It&apos;s diligence, done every time, instantly</li>
              <li>
                To replace your judgment — you stay the voice and the boss
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-6 text-ink/80 leading-relaxed">
          What we can tell you is what happened to us: the work got lighter,
          the replies got faster, and the business got better — because the
          follow-through finally matched the performance. We&apos;ve been
          there. That&apos;s the whole story.
        </p>
      </section>

      {/* CTA */}
      <section className="relative max-w-6xl mx-auto px-6 pt-10 pb-10">
        <div className="rounded-3xl bg-deep-teal px-8 py-12 sm:py-16 text-center relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-soft-lavender/30 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-brand-cyan/30 blur-2xl"
          />
          <h2 className="relative text-3xl sm:text-4xl font-bold text-white text-balance">
            Give your business its own back office.
          </h2>
          <p className="relative mt-4 text-white/80 max-w-xl mx-auto">
            Vinyl runs ours every night. Bright Ears runs yours — 14 days of
            full Pro, free, no card needed.
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
