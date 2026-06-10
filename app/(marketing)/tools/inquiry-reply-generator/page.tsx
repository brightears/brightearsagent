import type { Metadata } from "next";
import Link from "next/link";
import { ToolReplyGenerator } from "@/components/tool-reply-generator";

export const metadata: Metadata = {
  title: "Free DJ Inquiry Reply Generator — Bright Ears",
  description:
    "Paste a wedding or event inquiry and watch a personalized, availability-aware reply draft itself in seconds. Free, 5 drafts a day, no signup.",
};

const STEPS = [
  {
    title: "It reads the inquiry",
    body: "Date, venue, guest count, event type, budget hints — pulled out of however the couple happened to write it.",
    accent: "bg-brand-cyan-soft",
  },
  {
    title: "It drafts like a pro",
    body: "Warm, specific, and priced from a real rate card — not a canned autoresponse, and never “Dear Valued Customer.”",
    accent: "bg-soft-lavender/30",
  },
  {
    title: "You stay in charge",
    body: "In the real product the draft lands on your phone for a one-tap approve — your clients only ever see you.",
    accent: "bg-warm-peach/40",
  },
];

export default function InquiryReplyGeneratorPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-cyan-soft blur-3xl opacity-60"
        />
        <div
          aria-hidden
          className="absolute top-40 -left-28 h-64 w-64 rounded-full bg-soft-lavender/40 blur-3xl"
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-10 text-center">
          <span className="inline-block rounded-full bg-brand-cyan-soft text-deep-teal text-xs font-semibold px-3 py-1 mb-5">
            Free tool — no signup
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-deep-teal leading-tight">
            Paste an inquiry. Watch the reply write itself.
          </h1>
          <p className="mt-5 text-lg text-ink/70 max-w-2xl mx-auto">
            &ldquo;You don&apos;t want to be the 5th DJ that reaches out.&rdquo; This is the same
            drafting engine Bright Ears runs for real DJ businesses — try it on a real inquiry from
            your inbox.
          </p>
        </div>
      </section>

      {/* The tool */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <ToolReplyGenerator />
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal text-center mb-8">
          What just happened?
        </h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl bg-white shadow-sm border border-off-white p-6">
              <div
                className={`h-9 w-9 rounded-full ${s.accent} flex items-center justify-center font-bold text-deep-teal mb-4`}
              >
                {i + 1}
              </div>
              <h3 className="font-bold text-deep-teal mb-2">{s.title}</h3>
              <p className="text-sm text-ink/70 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bridge to product */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="rounded-2xl bg-deep-teal text-white p-8 sm:p-10 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-brand-cyan/30 blur-2xl"
          />
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 relative">
            Now imagine this happening while you&apos;re mid-set.
          </h2>
          <p className="text-white/80 max-w-xl mx-auto mb-3 relative">
            Bright Ears watches your inbox, The Knot, WeddingWire, Bark and your website form —
            filters the spam, drafts the reply in <em>your</em> voice from <em>your</em> rate card
            and real availability, and pings your phone to approve. Median first reply: under 5
            minutes. Then it follows up until the gig is booked or dead.
          </p>
          <p className="text-white/60 text-sm mb-7 relative">
            14-day free trial, no card. Plans from $25/mo.
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
          <Link href="/tools/templates" className="text-brand-cyan font-semibold hover:underline">
            25 inquiry &amp; follow-up templates
          </Link>{" "}
          ·{" "}
          <Link
            href="/tools/lead-roi-calculator"
            className="text-brand-cyan font-semibold hover:underline"
          >
            Lead ROI calculator
          </Link>
        </p>
      </section>
    </div>
  );
}
