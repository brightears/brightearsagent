import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, buttonStyles } from "@/components/ui";
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

export default function ComparePage() {
  return (
    <div>
      {/* JSON-LD: FAQ + roundup list */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd(HUB_FAQS) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-brand-cyan-soft blur-3xl opacity-70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-32 -left-24 h-64 w-64 rounded-full bg-soft-lavender/40 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Pricing last verified {LAST_VERIFIED}</Badge>
            <Badge tone="gray">Updated quarterly</Badge>
          </div>
          <h1 className="mt-5 text-3xl sm:text-5xl font-bold text-deep-teal tracking-tight max-w-3xl">
            Best DJ booking software in 2026: the honest comparison
          </h1>
          <p className="mt-5 text-lg text-ink/70 max-w-2xl">
            Every tool below earns its keep somewhere — and yes, we sell one of them, so judge for
            yourself: verified pricing, real strengths, real gaps. Spoiler: we&apos;re the only one
            that answers your leads, and we&apos;re the wrong choice for contracts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/onboarding" className={buttonStyles.primary}>
              Start free
            </Link>
            <a href="#roundup" className={buttonStyles.secondary}>
              See the table
            </a>
          </div>
        </div>
      </section>

      {/* Roundup table */}
      <section id="roundup" className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">The landscape, straight up</h2>
        <p className="mt-2 text-ink/60 max-w-2xl">
          Pricing recorded from each vendor&apos;s public pricing page, {LAST_VERIFIED}. Ranges span
          their published tiers.
        </p>
        <Card className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm text-left">
              <thead>
                <tr className="border-b border-off-white bg-brand-cyan-soft/30 text-deep-teal">
                  <th className="px-5 py-4 font-semibold">Software</th>
                  <th className="px-5 py-4 font-semibold whitespace-nowrap">Verified pricing</th>
                  <th className="px-5 py-4 font-semibold">Built for</th>
                  <th className="px-5 py-4 font-semibold">Where it shines</th>
                  <th className="px-5 py-4 font-semibold">Where it stops</th>
                </tr>
              </thead>
              <tbody>
                {ROUNDUP.map((entry) => (
                  <tr
                    key={entry.name}
                    className={`border-b border-off-white last:border-b-0 align-top ${
                      entry.isBrightEars ? "bg-brand-cyan-soft/20" : ""
                    }`}
                  >
                    <td className="px-5 py-4 font-semibold text-deep-teal whitespace-nowrap">
                      {entry.name}
                      {entry.isBrightEars && (
                        <span className="ml-2 align-middle">
                          <Badge>That&apos;s us</Badge>
                        </span>
                      )}
                      {entry.slug && (
                        <div className="mt-1">
                          <Link
                            href={`/compare/${entry.slug}`}
                            className="text-xs font-medium text-brand-cyan hover:underline"
                          >
                            Full comparison →
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap font-medium text-ink/80">{entry.price}</td>
                    <td className="px-5 py-4 text-ink/70">{entry.builtFor}</td>
                    <td className="px-5 py-4 text-ink/70">{entry.shines}</td>
                    <td className="px-5 py-4 text-ink/70">{entry.stops}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="mt-4 text-sm font-semibold text-deep-teal">{ROADMAP_LINE}</p>
        <p className="mt-3 text-xs text-ink/50">
          Spot a stale number? Tell us — we&apos;ll re-verify and update the stamp. Being wrong about a
          competitor&apos;s pricing helps nobody, least of all us.
        </p>
      </section>

      {/* The honest read */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-7 sm:p-8 relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-warm-peach/50 blur-2xl"
            />
            <h2 className="text-xl sm:text-2xl font-bold text-deep-teal">
              The gap none of them cover
            </h2>
            <p className="mt-4 text-ink/70">
              Contracts, invoices, planning portals, music apps — this category is genuinely well
              served. What stays unsolved is the first five minutes: a couple fills out three forms
              at 11pm and books whoever replies first. You don&apos;t want to be the 5th DJ that
              reaches out.
            </p>
            <blockquote className="mt-5 rounded-xl bg-soft-lavender/15 border border-soft-lavender/30 p-4 text-deep-teal font-medium">
              “Get an inquiry, immediately respond, and then nothing... 30 inquiries so far, maybe 5
              have responded.”
              <footer className="mt-2 text-xs font-normal text-ink/50">
                — a working wedding DJ, on why speed is the whole game
              </footer>
            </blockquote>
          </Card>
          <Card className="p-7 sm:p-8 relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-brand-cyan-soft blur-2xl"
            />
            <h2 className="text-xl sm:text-2xl font-bold text-deep-teal">Why we get to say that</h2>
            <p className="mt-4 text-ink/70">
              We&apos;ve been there — 20 years running entertainment for venues, drowning in the same
              inquiries, schedules and invoices. So we built an AI back office for our own agency
              (her name is Vinyl, she still runs it today) — now she works for yours.
            </p>
            <p className="mt-4 text-ink/70">
              That history is also why this page is generous to the competition: we&apos;ve paid for
              this kind of software for two decades. The good ones deserve the credit — and you
              deserve a comparison you can actually trust.
            </p>
          </Card>
        </div>
      </section>

      {/* Pairwise links */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">Head-to-head, in detail</h2>
        <p className="mt-2 text-ink/60 max-w-2xl">
          Each page: what the other tool is genuinely great at, a feature-by-feature table, and where
          we fit (often: alongside, not instead).
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARISON_SLUGS.map((slug) => {
            const page = COMPARISONS[slug];
            return (
              <Link key={slug} href={`/compare/${slug}`} className="group">
                <Card className="h-full p-6 transition-shadow group-hover:shadow-md">
                  <div className="text-sm font-semibold text-brand-cyan">{page.cardTitle}</div>
                  <p className="mt-2 text-ink/70 text-sm">{page.cardBlurb}</p>
                  <div className="mt-4 text-sm font-semibold text-deep-teal group-hover:text-brand-cyan transition-colors">
                    Read the comparison →
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Pricing strip */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <Card className="p-7 sm:p-8 bg-gradient-to-br from-white via-white to-brand-cyan-soft/30">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Bright Ears pricing</Badge>
            <span className="text-xs text-ink/50">{BRIGHT_EARS_PRICING.trial}</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {BRIGHT_EARS_PRICING.tiers.map((tier) => (
              <div key={tier.name} className="rounded-xl border border-off-white bg-white p-5">
                <div className="font-bold text-deep-teal">
                  {tier.name} <span className="text-brand-cyan">{tier.price}</span>
                </div>
                <p className="mt-1 text-sm text-ink/60">{tier.includes}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink/60">{BRIGHT_EARS_PRICING.overage}</p>
        </Card>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">Honest questions, honest answers</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {HUB_FAQS.map((faq) => (
            <Card key={faq.question} className="p-6">
              <h3 className="font-semibold text-deep-teal">{faq.question}</h3>
              <p className="mt-2 text-sm text-ink/70">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-cyan-soft via-white to-soft-lavender/30 border border-off-white p-8 sm:p-12 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-warm-peach/40 blur-3xl"
          />
          <h2 className="relative text-2xl sm:text-4xl font-bold text-deep-teal">
            Stop being the 5th DJ to reply
          </h2>
          <p className="relative mt-3 text-ink/70 max-w-xl mx-auto">
            14-day free trial, no card. Median first reply under 5 minutes — even from the booth. At
            your cap, drafting pauses; never a surprise bill.
          </p>
          <div className="relative mt-7">
            <Link href="/onboarding" className={`${buttonStyles.primary} px-6 py-3 text-base`}>
              Start free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
