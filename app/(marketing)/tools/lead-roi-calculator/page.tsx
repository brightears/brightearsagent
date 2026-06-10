import type { Metadata } from "next";
import Link from "next/link";
import { LeadRoiCalculator } from "@/components/lead-roi-calculator";

export const metadata: Metadata = {
  title: "Lead ROI Calculator for DJs — What Slow Replies Cost — Bright Ears",
  description:
    "Free calculator for wedding and event DJs: estimate how many bookings (and dollars) slow inquiry replies cost you per year. Transparent math, honest assumptions, no signup.",
};

export default function LeadRoiCalculatorPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-cyan-soft blur-3xl opacity-60"
        />
        <div
          aria-hidden
          className="absolute top-36 -right-28 h-64 w-64 rounded-full bg-warm-peach/40 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-10 text-center">
          <span className="inline-block rounded-full bg-brand-cyan-soft text-deep-teal text-xs font-semibold px-3 py-1 mb-5">
            Free calculator — transparent math
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-deep-teal leading-tight">
            What are slow replies costing you?
          </h1>
          <p className="mt-5 text-lg text-ink/70 max-w-2xl mx-auto">
            Couples book whoever replies first. &ldquo;I can&apos;t always text the lead within 5
            minutes&rdquo; — none of us can, alone. Put in your real numbers and see what the gap
            between your reply speed and 5 minutes adds up to over a year.
          </p>
        </div>
      </section>

      {/* The calculator */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <LeadRoiCalculator />
      </section>

      {/* Why speed wins */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal text-center mb-8">
          Why the first reply wins
        </h2>
        <div className="grid sm:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-white shadow-sm border border-off-white p-6">
            <p className="text-3xl font-bold text-brand-cyan mb-2">3–5</p>
            <h3 className="font-bold text-deep-teal mb-2">vendors per inquiry</h3>
            <p className="text-sm text-ink/70 leading-relaxed">
              Couples rarely message just you. The same inquiry lands in several DJs&apos; inboxes
              at once — &ldquo;you don&apos;t want to be the 5th DJ that reaches out.&rdquo;
            </p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm border border-off-white p-6">
            <p className="text-3xl font-bold text-brand-cyan mb-2">1 in 3</p>
            <h3 className="font-bold text-deep-teal mb-2">vendors never reply</h3>
            <p className="text-sm text-ink/70 leading-relaxed">
              Couples report that a third of the vendors they contact simply go silent. Showing up
              fast puts you ahead before you&apos;ve said anything clever.
            </p>
          </div>
          <div className="rounded-2xl bg-white shadow-sm border border-off-white p-6">
            <p className="text-3xl font-bold text-brand-cyan mb-2">First</p>
            <h3 className="font-bold text-deep-teal mb-2">reply sets the shortlist</h3>
            <p className="text-sm text-ink/70 leading-relaxed">
              By the time a slow reply arrives, the conversation — and often the date — already
              belongs to someone who answered while it was top of mind.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="rounded-2xl bg-deep-teal text-white p-8 sm:p-10 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-brand-cyan/30 blur-2xl"
          />
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 relative">
            Respond in under 5 minutes — even from the booth.
          </h2>
          <p className="text-white/80 max-w-xl mx-auto mb-3 relative">
            Bright Ears drafts the reply the moment an inquiry lands — your voice, your rates, your
            real availability — and you approve with one tap from your phone. Follow-ups run until
            the gig is booked or dead.
          </p>
          <p className="text-white/60 text-sm mb-7 relative">
            14-day free trial, no card. Starter $25/mo · Pro $79/mo · Studio $149/mo.
          </p>
          <Link
            href="/onboarding"
            className="relative inline-block rounded-xl bg-brand-cyan text-white font-semibold px-6 py-3 hover:opacity-90 transition-opacity"
          >
            Start free
          </Link>
        </div>
        <p className="text-center text-sm text-ink/50 mt-8">
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
