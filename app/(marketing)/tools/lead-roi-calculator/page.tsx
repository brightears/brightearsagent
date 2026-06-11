import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { LeadRoiCalculator } from "@/components/lead-roi-calculator";
import { GradientBlob, RingsBackdrop, VinylDisc } from "@/components/collage";

export const metadata: Metadata = {
  title: "Lead ROI Calculator for DJs — What Slow Replies Cost — Bright Ears",
  description:
    "Free calculator for wedding and event DJs: estimate how many bookings (and dollars) slow inquiry replies cost you per year. Transparent math, honest assumptions, no signup.",
};

/* One gradient-painted word in the headline — the design/b signature. */
const gradText: CSSProperties = {
  background: "linear-gradient(92deg, #ff2dae 5%, #ff8a00 95%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const SPEED_STATS = [
  {
    n: "3–5",
    h: "vendors per inquiry",
    body: "Couples rarely message just you. The same inquiry lands in several DJs' inboxes at once — “you don't want to be the 5th DJ that reaches out.”",
  },
  {
    n: "1 in 3",
    h: "vendors never reply",
    body: "Couples report that a third of the vendors they contact simply go silent. Showing up fast puts you ahead before you've said anything clever.",
  },
  {
    n: "First",
    h: "reply sets the shortlist",
    body: "By the time a slow reply arrives, the conversation — and often the date — already belongs to someone who answered while it was top of mind.",
  },
];

export default function LeadRoiCalculatorPage() {
  return (
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      {/* one ring pattern per page + soft neon vignette */}
      <RingsBackdrop />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(640px circle at 20% 200px, rgba(255,45,174,0.1), transparent 70%), radial-gradient(520px circle at 88% 80px, rgba(255,138,0,0.07), transparent 70%)",
        }}
      />

      {/* Hero */}
      <section className="relative">
        <div className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/25 bg-cream/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cream/75">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-magenta" />
            Free calculator — transparent math
          </span>
          <h1 className="mt-7 text-4xl sm:text-6xl font-black tracking-tight leading-[1.02]">
            What are slow replies <span style={gradText}>costing</span> you?
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-cream/65 max-w-2xl mx-auto">
            Couples book whoever replies first. &ldquo;I can&apos;t always text the lead within 5
            minutes&rdquo; — none of us can, alone. Put in your real numbers and see what the gap
            between your reply speed and 5 minutes adds up to over a year.
          </p>
        </div>
      </section>

      {/* The calculator */}
      <section className="relative max-w-3xl mx-auto px-6 pb-20">
        <LeadRoiCalculator />
      </section>

      {/* Why speed wins — stat strip on the ink, gradient accent bars */}
      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-10">
          Why the first reply wins
        </h2>
        <div className="grid gap-10 sm:grid-cols-3 border-y border-cream/10 py-12">
          {SPEED_STATS.map((s) => (
            <div key={s.h}>
              <div
                className="h-1 w-10 rounded-full"
                style={{ background: "linear-gradient(90deg, #ff2dae, #ff8a00)" }}
              />
              <p className="mt-4 text-4xl font-black tracking-tight text-cream-bright">{s.n}</p>
              <h3 className="mt-2 font-bold text-cream-bright">{s.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cream/55">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA — cream poster with collage corner */}
      <section className="relative max-w-3xl mx-auto px-6 pb-24">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-9 right-10 h-36 w-72" />
          <div className="relative overflow-hidden rounded-3xl bg-cream p-8 sm:p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] rotate-[0.6deg]">
            <VinylDisc size={130} tone="orange" className="-bottom-12 -left-10" />
            <h2 className="relative text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage mb-4">
              Respond in under 5 minutes — even from the booth.
            </h2>
            <p className="relative text-ink-stage/70 max-w-xl mx-auto mb-3">
              Bright Ears drafts the reply the moment an inquiry lands — your voice, your rates,
              your real availability — and you approve with one tap from your phone. Follow-ups run
              until the gig is booked or dead.
            </p>
            <p className="relative text-ink-stage/50 text-sm mb-7">
              14-day free trial, no card. Starter $25/mo · Pro $79/mo · Studio $149/mo.
            </p>
            <Link
              href="/onboarding"
              className="relative inline-block rounded-full bg-neon-magenta text-white font-bold px-7 py-3 shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          </div>
        </div>
        <p className="text-center text-sm text-cream/50 mt-10">
          More free tools:{" "}
          <Link
            href="/tools/inquiry-reply-generator"
            className="text-brand-cyan font-semibold hover:underline"
          >
            Inquiry reply generator
          </Link>{" "}
          ·{" "}
          <Link href="/tools/templates" className="text-brand-cyan font-semibold hover:underline">
            25 inquiry &amp; follow-up templates
          </Link>
        </p>
      </section>
    </div>
  );
}
