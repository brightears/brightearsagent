import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ToolReplyGenerator } from "@/components/tool-reply-generator";
import { GradientBlob, RingsBackdrop, VinylDisc } from "@/components/collage";

export const metadata: Metadata = {
  title: "Free DJ Inquiry Reply Generator — Bright Ears",
  description:
    "Paste a wedding or event inquiry and watch a personalized, availability-aware reply draft itself in seconds. Free, 5 drafts a day, no signup.",
};

/* One gradient-painted word in the headline — the design/b signature. */
const gradText: CSSProperties = {
  background: "linear-gradient(92deg, #ff2dae 5%, #ff8a00 95%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const STEPS = [
  {
    title: "It reads the inquiry",
    body: "Date, venue, guest count, event type, budget hints — pulled out of however the couple happened to write it.",
    accent: "bg-brand-cyan-soft text-ink-stage",
    tilt: "-rotate-1",
    lift: "",
  },
  {
    title: "It drafts like a pro",
    body: "Warm, specific, and priced from a real rate card — not a canned autoresponse, and never “Dear Valued Customer.”",
    accent: "bg-[#ffd6ec] text-[#9c0f63]",
    tilt: "rotate-1",
    lift: "sm:mt-6",
  },
  {
    title: "You stay in charge",
    body: "In the real product the draft lands on your phone for a one-tap approve — your clients only ever see you.",
    accent: "bg-[#ffdfba] text-[#7a4100]",
    tilt: "-rotate-[0.5deg]",
    lift: "sm:mt-2",
  },
];

export default function InquiryReplyGeneratorPage() {
  return (
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      {/* one ring pattern per page + soft neon vignette */}
      <RingsBackdrop />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(640px circle at 78% 180px, rgba(255,45,174,0.1), transparent 70%), radial-gradient(520px circle at 8% 60px, rgba(255,138,0,0.07), transparent 70%)",
        }}
      />

      {/* Hero */}
      <section className="relative">
        <div className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/25 bg-cream/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cream/75">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-magenta" />
            Free tool — no signup
          </span>
          <h1 className="mt-7 text-4xl sm:text-6xl font-black tracking-tight leading-[1.02]">
            Paste an inquiry. Watch the reply <span style={gradText}>write itself</span>.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-cream/65 max-w-2xl mx-auto">
            &ldquo;You don&apos;t want to be the 5th DJ that reaches out.&rdquo; This is the same
            drafting engine Bright Ears runs for real performer businesses — try it on a real inquiry
            from your inbox.
          </p>
        </div>
      </section>

      {/* The tool */}
      <section className="relative max-w-3xl mx-auto px-6 pb-20">
        <ToolReplyGenerator />
      </section>

      {/* How it works — poster wall */}
      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-10">
          What just happened?
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.title} className={`relative ${s.lift}`}>
              <GradientBlob
                tone="show"
                className={i % 2 ? "-bottom-6 -right-4 h-28 w-44" : "-bottom-6 -left-4 h-28 w-44"}
              />
              <div
                className={`relative overflow-hidden rounded-3xl bg-cream p-6 pb-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${s.tilt}`}
              >
                <div
                  className={`h-9 w-9 rounded-full ${s.accent} flex items-center justify-center font-bold mb-4`}
                >
                  {i + 1}
                </div>
                <h3 className="font-extrabold tracking-tight text-ink-stage mb-2">{s.title}</h3>
                <p className="text-sm text-ink-stage/65 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bridge to product — cream poster with collage corner */}
      <section className="relative max-w-3xl mx-auto px-6 pb-24">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-9 left-10 h-36 w-72" />
          <div className="relative overflow-hidden rounded-3xl bg-cream p-8 sm:p-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] rotate-[-0.6deg]">
            <VinylDisc size={130} tone="dark" className="-bottom-12 -right-10" />
            <h2 className="relative text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage mb-4">
              This is the easy half. We also find the gigs.
            </h2>
            <p className="relative text-ink-stage/70 max-w-xl mx-auto mb-3">
              Replying to a lead is one thing. The harder half is finding new ones — and that&apos;s
              what Bright Ears leads with: it hunts the web for venues that fit you and drafts the
              outreach in <em>your</em> voice for you to approve. And when an inquiry does land, it
              drafts that reply too, filters the spam, and pings your phone — then follows up until
              the gig is booked or dead.
            </p>
            <p className="relative text-ink-stage/50 text-sm mb-7">
              Plans from $25/mo — subscribe to switch it on, month-to-month, cancel anytime.
            </p>
            <Link
              href="/onboarding"
              className="relative inline-block rounded-full bg-neon-magenta text-white font-bold px-7 py-3 shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
        <p className="text-center text-sm text-cream/65 mt-10">
          More free tools:{" "}
          <Link href="/tools/templates" className="text-brand-cyan font-semibold hover:underline">
            29 venue, inquiry &amp; follow-up templates
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
