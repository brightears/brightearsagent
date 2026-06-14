import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui";
import {
  GradientBlob,
  HaloRing,
  RingsBackdrop,
  StickerChip,
  VinylDisc,
} from "@/components/collage";
import {
  BRIGHT_EARS_PRICING,
  COMPARISON_SLUGS,
  COMPARISONS,
  HUB_FAQS,
  LAST_VERIFIED,
  ROUNDUP,
  faqJsonLd,
  ROADMAP_LINE,
} from "@/lib/marketing/comparisons";

export const metadata: Metadata = {
  title: "Best DJ Booking Software 2026 — Honest Comparison, Verified Pricing | Bright Ears",
  description:
    "The honest 2026 comparison of DJ booking software: DJ Event Planner, GigBuilder, Vibo, Check Cherry, HoneyBook and Bright Ears. Real strengths, real gaps, pricing last verified June 2026.",
};

const itemListJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Best DJ booking software 2026",
  itemListElement: ROUNDUP.map((entry, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: entry.name,
  })),
}).replace(/</g, "\\u003c");

/** The v2 signature: one gradient-painted word in a warm-white/ink headline. */
const GRAD = "bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent";

/** Quiet mono chip for the ink canvas (the design/b hero-badge styling). */
function InkChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/25 bg-cream/5 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-cream/75">
      {children}
    </span>
  );
}

export default function ComparePage() {
  return (
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      {/* JSON-LD: FAQ + roundup list */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd(HUB_FAQS) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      {/* Hero — one ring pattern per page (LAW) + soft neon vignettes */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <RingsBackdrop />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(620px circle at 82% 160px, rgba(255,45,174,0.10), transparent 70%), radial-gradient(500px circle at 4% 40px, rgba(255,138,0,0.07), transparent 70%)",
            }}
          />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="flex flex-wrap items-center gap-2">
            <InkChip>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-neon-magenta" />
              Pricing last verified {LAST_VERIFIED}
            </InkChip>
            <InkChip>Updated quarterly</InkChip>
          </div>
          <h1 className="mt-6 text-3xl sm:text-6xl font-black tracking-tight text-cream-bright max-w-3xl">
            Best DJ booking software in 2026: the <span className={GRAD}>honest</span> comparison
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-cream/70 max-w-2xl">
            Every tool below earns its keep somewhere — and yes, we sell one of them, so judge for
            yourself: verified pricing, real strengths, real gaps. Spoiler: we&apos;re the only one
            that answers your leads, and we&apos;re the wrong choice for contracts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/onboarding" className={buttonStyles.show}>
              Start free
            </Link>
            <a href="#roundup" className={buttonStyles.secondary}>
              See the table
            </a>
          </div>
        </div>
      </section>

      {/* Roundup table — cream poster panel, our row cyan-edged */}
      <section id="roundup" className="relative max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-cream-bright">
          The landscape, straight up
        </h2>
        <p className="mt-2 text-cream/60 max-w-2xl">
          Pricing recorded from each vendor&apos;s public pricing page, {LAST_VERIFIED}. Ranges span
          their published tiers.
        </p>
        <div className="relative mt-8">
          <GradientBlob tone="show" className="-top-8 -right-8 h-36 w-56" />
          <div className="relative overflow-hidden rounded-3xl bg-cream shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm text-left">
                <thead>
                  <tr className="bg-ink-stage text-cream">
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                      Software
                    </th>
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] whitespace-nowrap">
                      Verified pricing
                    </th>
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                      Built for
                    </th>
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                      Where it shines
                    </th>
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                      Where it stops
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROUNDUP.map((entry) => (
                    <tr
                      key={entry.name}
                      className={`border-b border-ink-stage/10 last:border-b-0 align-top border-l-4 ${
                        entry.isBrightEars
                          ? "border-l-brand-cyan bg-brand-cyan-soft/40"
                          : "border-l-transparent"
                      }`}
                    >
                      <td className="px-5 py-4 font-bold text-ink-stage whitespace-nowrap">
                        {entry.name}
                        {entry.isBrightEars && (
                          <span className="ml-2 inline-block rounded-full bg-brand-cyan px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-stage align-middle">
                            That&apos;s us
                          </span>
                        )}
                        {entry.slug && (
                          <div className="mt-1.5">
                            <Link
                              href={`/compare/${entry.slug}`}
                              className="text-xs font-bold text-ink-stage underline decoration-brand-cyan decoration-2 underline-offset-2 hover:text-brand-cyan transition-colors"
                            >
                              Full comparison →
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-semibold text-ink-stage/80">
                        {entry.price}
                      </td>
                      <td className="px-5 py-4 text-ink-stage/70">{entry.builtFor}</td>
                      <td className="px-5 py-4 text-ink-stage/70">{entry.shines}</td>
                      <td className="px-5 py-4 text-ink-stage/70">{entry.stops}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p className="mt-5 text-sm font-semibold text-cream/85">{ROADMAP_LINE}</p>
        <p className="mt-3 text-xs text-cream/45">
          Spot a stale number? Tell us — we&apos;ll re-verify and update the stamp. Being wrong about a
          competitor&apos;s pricing helps nobody, least of all us.
        </p>
      </section>

      {/* The honest read — two cream posters with collage accents */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="relative">
            <GradientBlob tone="show" className="-bottom-8 -left-8 h-36 w-52" />
            <div className="relative h-full overflow-hidden rounded-3xl bg-cream p-7 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] -rotate-1">
              <VinylDisc size={130} tone="dark" className="-right-14 -top-14" />
              <h2 className="relative text-xl sm:text-2xl font-extrabold tracking-tight text-ink-stage">
                The gap none of them cover
              </h2>
              <p className="relative mt-4 text-ink-stage/70">
                Contracts, invoices, planning portals, music apps — this category is genuinely well
                served. What stays unsolved is the first five minutes: a couple fills out three forms
                at 11pm and books whoever replies first. You don&apos;t want to be the 5th DJ that
                reaches out.
              </p>
              <blockquote className="relative mt-5 rounded-xl border-l-4 border-neon-magenta bg-cream-bright p-4 font-medium text-ink-stage">
                “Get an inquiry, immediately respond, and then nothing... 30 inquiries so far, maybe 5
                have responded.”
                <footer className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                  — a working wedding DJ, on why speed is the whole game
                </footer>
              </blockquote>
            </div>
          </div>
          <div className="relative">
            <GradientBlob tone="show" className="-top-8 -right-8 h-36 w-52" />
            <div className="relative h-full overflow-hidden rounded-3xl bg-cream p-7 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] rotate-1">
              <HaloRing width={180} height={64} tilt={12} className="-right-12 top-5" />
              <h2 className="relative text-xl sm:text-2xl font-extrabold tracking-tight text-ink-stage">
                Why we get to say that
              </h2>
              <p className="relative mt-4 text-ink-stage/70">
                We&apos;ve been there — 20 years running entertainment for venues, drowning in the same
                inquiries, schedules and invoices. So we built an AI back office for our own agency
                (her name is Vinyl, she still runs it today) — now she works for yours.
              </p>
              <p className="relative mt-4 text-ink-stage/70">
                That history is also why this page is generous to the competition: we&apos;ve paid for
                this kind of software for two decades. The good ones deserve the credit — and you
                deserve a comparison you can actually trust.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pairwise links */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-cream-bright">
          Head-to-head, in detail
        </h2>
        <p className="mt-2 text-cream/60 max-w-2xl">
          Each page: what the other tool is genuinely great at, a feature-by-feature table, and where
          we fit (often: alongside, not instead).
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARISON_SLUGS.map((slug) => {
            const page = COMPARISONS[slug];
            return (
              <Link key={slug} href={`/compare/${slug}`} className="group">
                <div className="h-full rounded-3xl bg-cream p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ring-2 ring-transparent transition group-hover:ring-brand-cyan group-hover:-translate-y-0.5">
                  <div className="text-sm font-bold text-ink-stage">{page.cardTitle}</div>
                  <p className="mt-2 text-ink-stage/70 text-sm">{page.cardBlurb}</p>
                  <div className="mt-4 text-sm font-bold text-ink-stage underline decoration-brand-cyan decoration-2 underline-offset-2">
                    Read the comparison →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pricing strip */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-8 right-10 h-32 w-64" />
          <div className="relative overflow-hidden rounded-3xl bg-cream p-7 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-center gap-3">
              <StickerChip tone="ink" rotate={-2}>
                Bright Ears pricing
              </StickerChip>
              <span className="text-xs text-ink-stage/60">{BRIGHT_EARS_PRICING.trial}</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {BRIGHT_EARS_PRICING.tiers.map((tier) => (
                <div
                  key={tier.name}
                  className="rounded-2xl border border-ink-stage/10 bg-cream-bright p-5"
                >
                  <div className="font-bold text-ink-stage">
                    {tier.name}{" "}
                    <span className={`font-black tracking-tight ${GRAD}`}>{tier.price}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-stage/65">{tier.includes}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-ink-stage/70">{BRIGHT_EARS_PRICING.overage}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-cream-bright">
          Honest questions, honest answers
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {HUB_FAQS.map((faq) => (
            <div key={faq.question} className="rounded-2xl bg-cream p-6">
              <h3 className="font-bold text-ink-stage">{faq.question}</h3>
              <p className="mt-2 text-sm text-ink-stage/70">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band — cream poster with collage, magenta show pill */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-9 left-12 h-40 w-80" />
          <div className="relative overflow-hidden rounded-3xl bg-cream px-8 py-12 sm:p-12 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] rotate-[-0.6deg]">
            <HaloRing width={300} height={108} tilt={-12} className="left-1/2 top-6 -ml-40" />
            <VinylDisc size={160} tone="orange" spin className="-bottom-12 -right-10" />
            <span aria-hidden className="absolute left-[12%] top-9 text-xl text-ink-stage/25">
              &#10022;
            </span>
            <h2 className="relative text-2xl sm:text-4xl font-black tracking-tight text-ink-stage">
              Stop being the <span className={GRAD}>5th</span> DJ to reply
            </h2>
            <p className="relative mt-3 text-ink-stage/70 max-w-xl mx-auto">
              14-day free trial, no card. Designed to reply in under 5 minutes — even from the booth. At
              your cap, drafting pauses; never a surprise bill.
            </p>
            <div className="relative mt-7">
              <Link
                href="/onboarding"
                className="inline-block rounded-full bg-neon-magenta px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
