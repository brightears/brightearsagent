import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, buttonStyles } from "@/components/ui";
import {
  BRIGHT_EARS_PRICING,
  COMPARISON_SLUGS,
  LAST_VERIFIED,
  faqJsonLd,
  getComparison,
  type TableCell,
} from "@/lib/marketing/comparisons";

// Only the six slugs in COMPARISON_SLUGS exist — anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISON_SLUGS.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getComparison(slug);
  if (!page) return {};
  return { title: page.title, description: page.metaDescription };
}

function MarkChip({ cell }: { cell: TableCell }) {
  if (cell.mark === "na") return null;
  const styles = {
    yes: "bg-brand-cyan-soft text-deep-teal",
    partial: "bg-warm-peach text-ink",
    no: "bg-off-white text-ink/50",
  } as const;
  const labels = { yes: "Yes", partial: "Partly", no: "No" } as const;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[cell.mark]}`}
    >
      {labels[cell.mark]}
    </span>
  );
}

function CellContent({ cell }: { cell: TableCell }) {
  return (
    <div>
      <MarkChip cell={cell} />
      <p className={cell.mark === "na" ? "font-medium text-ink/80" : "mt-1.5 text-ink/70"}>
        {cell.note}
      </p>
    </div>
  );
}

export default async function ComparisonSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = getComparison(slug);
  if (!page) notFound();

  return (
    <div>
      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd(page.faqs) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-brand-cyan-soft blur-3xl opacity-70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-36 -left-24 h-60 w-60 rounded-full bg-soft-lavender/40 blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <Link
            href="/compare"
            className="text-sm font-medium text-ink/50 hover:text-brand-cyan transition-colors"
          >
            ← All comparisons
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge>{page.heroEyebrow}</Badge>
            <Badge tone="gray">Last verified {LAST_VERIFIED}</Badge>
          </div>
          <h1 className="mt-5 text-3xl sm:text-5xl font-bold text-deep-teal tracking-tight max-w-3xl">
            {page.heroHeading}
          </h1>
          <p className="mt-5 text-lg text-ink/70 max-w-2xl">{page.heroSub}</p>
          <div className="mt-8">
            <Link href="/onboarding" className={buttonStyles.primary}>
              Start free
            </Link>
          </div>
        </div>
      </section>

      {/* What the competitor is great at — generosity is the credibility play */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">{page.greatAtHeading}</h2>
        <p className="mt-2 text-ink/60 max-w-2xl">{page.greatAtIntro}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {page.greatAt.map((item) => (
            <Card key={item.point} className="p-6">
              <h3 className="font-semibold text-deep-teal">{item.point}</h3>
              <p className="mt-2 text-sm text-ink/70">{item.detail}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Alternatives grid (only on the alternatives page) */}
      {page.alternatives && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">
            {page.alternativesHeading}
          </h2>
          {page.alternativesIntro && (
            <p className="mt-2 text-ink/60 max-w-2xl">{page.alternativesIntro}</p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.alternatives.map((alt) => (
              <Card key={alt.name} className="p-6 flex flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-deep-teal">{alt.name}</h3>
                  <span className="text-sm font-medium text-brand-cyan whitespace-nowrap">
                    {alt.price}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink/70 flex-1">{alt.take}</p>
                {alt.slug ? (
                  <Link
                    href={`/compare/${alt.slug}`}
                    className="mt-4 text-sm font-semibold text-brand-cyan hover:underline"
                  >
                    Full comparison →
                  </Link>
                ) : (
                  <Link
                    href="/onboarding"
                    className="mt-4 text-sm font-semibold text-brand-cyan hover:underline"
                  >
                    Start free →
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Comparison table */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">{page.tableHeading}</h2>
        <p className="mt-2 text-ink/60">
          Honest marks both ways — including the rows where {page.competitor} wins outright.
        </p>
        <Card className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm text-left">
              <thead>
                <tr className="border-b border-off-white bg-brand-cyan-soft/30 text-deep-teal">
                  <th className="px-5 py-4 font-semibold w-[30%]">Feature</th>
                  <th className="px-5 py-4 font-semibold w-[35%]">{page.competitor}</th>
                  <th className="px-5 py-4 font-semibold w-[35%]">Bright Ears</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.feature} className="border-b border-off-white last:border-b-0 align-top">
                    <td className="px-5 py-4 font-medium text-deep-teal">{row.feature}</td>
                    <td className="px-5 py-4">
                      <CellContent cell={row.them} />
                    </td>
                    <td className="px-5 py-4 bg-brand-cyan-soft/10">
                      <CellContent cell={row.us} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="mt-3 text-xs text-ink/50">
          Competitor details and pricing recorded from public sources, {LAST_VERIFIED}. Spot
          something stale or unfair? Tell us and we&apos;ll fix it.
        </p>
      </section>

      {/* Where Bright Ears fits */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <Card className="relative overflow-hidden p-7 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-brand-cyan-soft blur-3xl opacity-70"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -left-16 h-44 w-44 rounded-full bg-warm-peach/40 blur-3xl"
          />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">{page.fitHeading}</h2>
            <div className="mt-5 space-y-4 max-w-3xl">
              {page.fitParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-ink/70">
                  {paragraph}
                </p>
              ))}
            </div>
            {page.fitPullQuote && (
              <blockquote className="mt-6 max-w-2xl rounded-xl bg-soft-lavender/15 border border-soft-lavender/30 p-5 text-deep-teal font-medium">
                “{page.fitPullQuote.quote}”
                <footer className="mt-2 text-xs font-normal text-ink/50">
                  — {page.fitPullQuote.source}
                </footer>
              </blockquote>
            )}
          </div>
        </Card>
      </section>

      {/* Pricing strip */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6 sm:p-7">
            <div className="text-sm font-semibold text-ink/50">
              {page.competitor} · verified {LAST_VERIFIED}
            </div>
            <div className="mt-2 text-3xl font-bold text-deep-teal">{page.competitorPrice}</div>
            <p className="mt-2 text-sm text-ink/60">
              Range across published tiers on the vendor&apos;s public pricing page.
            </p>
          </Card>
          <Card className="p-6 sm:p-7 bg-gradient-to-br from-white via-white to-brand-cyan-soft/30">
            <div className="text-sm font-semibold text-ink/50">
              Bright Ears · {BRIGHT_EARS_PRICING.trial}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {BRIGHT_EARS_PRICING.tiers.map((tier) => (
                <div key={tier.name} className="font-bold text-deep-teal">
                  {tier.name} <span className="text-brand-cyan">{tier.price}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink/60">{BRIGHT_EARS_PRICING.overage}</p>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-deep-teal">Frequently asked</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {page.faqs.map((faq) => (
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
            className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-warm-peach/40 blur-3xl"
          />
          <h2 className="relative text-2xl sm:text-4xl font-bold text-deep-teal">{page.ctaHeading}</h2>
          <p className="relative mt-3 text-ink/70 max-w-xl mx-auto">{page.ctaSub}</p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/onboarding" className={`${buttonStyles.primary} px-6 py-3 text-base`}>
              Start free
            </Link>
            <Link href="/compare" className={buttonStyles.secondary}>
              All comparisons
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
