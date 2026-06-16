import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, buttonStyles } from "@/components/ui";
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

function MarkChip({ cell }: { cell: TableCell }) {
  if (cell.mark === "na") return null;
  // v2 badge fills (docs/DESIGN.md) — all opaque, dark text on soft tints (AA+).
  const styles = {
    yes: "bg-brand-cyan-soft text-ink-stage",
    partial: "bg-[#ffdfba] text-[#7a4100]",
    no: "bg-cream text-ink-stage/55",
  } as const;
  const labels = { yes: "Yes", partial: "Partly", no: "No" } as const;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[cell.mark]}`}
    >
      {labels[cell.mark]}
    </span>
  );
}

function CellContent({ cell }: { cell: TableCell }) {
  return (
    <div>
      <MarkChip cell={cell} />
      <p
        className={
          cell.mark === "na" ? "font-medium text-ink-stage/80" : "mt-1.5 text-ink-stage/70"
        }
      >
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
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd(page.faqs) }}
      />

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
        <div className="relative max-w-6xl mx-auto px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <Link
            href="/compare"
            className="text-sm font-medium text-cream/55 hover:text-brand-cyan transition-colors"
          >
            ← All comparisons
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <InkChip>{page.heroEyebrow}</InkChip>
            <InkChip>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-neon-magenta" />
              Last verified {LAST_VERIFIED}
            </InkChip>
          </div>
          <h1 className="mt-5 text-3xl sm:text-5xl font-black text-cream-bright tracking-tight max-w-3xl">
            {page.heroHeading}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-cream/70 max-w-2xl">{page.heroSub}</p>
          <div className="mt-8">
            <Link href="/onboarding" className={buttonStyles.show}>
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* What the competitor is great at — generosity is the credibility play */}
      <section className="relative max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-cream-bright">
          {page.greatAtHeading}
        </h2>
        <p className="mt-2 text-cream/60 max-w-2xl">{page.greatAtIntro}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {page.greatAt.map((item) => (
            <Card key={item.point} className="p-6">
              <h3 className="font-bold text-ink-stage">{item.point}</h3>
              <p className="mt-2 text-sm text-ink-stage/70">{item.detail}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Alternatives grid (only on the alternatives page) */}
      {page.alternatives && (
        <section className="relative max-w-6xl mx-auto px-6 pb-16">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-cream-bright">
            {page.alternativesHeading}
          </h2>
          {page.alternativesIntro && (
            <p className="mt-2 text-cream/60 max-w-2xl">{page.alternativesIntro}</p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.alternatives.map((alt) => (
              <Card key={alt.name} className="p-6 flex flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold text-ink-stage">{alt.name}</h3>
                  <span className="text-sm font-semibold text-ink-stage/70 whitespace-nowrap">
                    {alt.price}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-stage/70 flex-1">{alt.take}</p>
                {alt.slug ? (
                  <Link
                    href={`/compare/${alt.slug}`}
                    className="mt-4 text-sm font-bold text-ink-stage underline decoration-brand-cyan decoration-2 underline-offset-2 hover:text-brand-cyan transition-colors"
                  >
                    Full comparison →
                  </Link>
                ) : (
                  <Link
                    href="/onboarding"
                    className="mt-4 text-sm font-bold text-ink-stage underline decoration-brand-cyan decoration-2 underline-offset-2 hover:text-brand-cyan transition-colors"
                  >
                    Get started →
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Comparison table — cream poster panel, our column cyan-tinted */}
      <section className="relative max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-cream-bright">
          {page.tableHeading}
        </h2>
        <p className="mt-2 text-cream/60">
          Honest marks both ways — including the rows where {page.competitor} wins outright.
        </p>
        <div className="relative mt-6">
          <GradientBlob tone="show" className="-top-8 -right-8 h-36 w-56" />
          <div className="relative overflow-hidden rounded-3xl bg-cream shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm text-left">
                <thead>
                  <tr className="bg-ink-stage text-cream">
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] w-[30%]">
                      Feature
                    </th>
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] w-[35%]">
                      {page.competitor}
                    </th>
                    <th className="px-5 py-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] w-[35%]">
                      Bright Ears
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-b border-ink-stage/10 last:border-b-0 align-top"
                    >
                      <td className="px-5 py-4 font-bold text-ink-stage">{row.feature}</td>
                      <td className="px-5 py-4">
                        <CellContent cell={row.them} />
                      </td>
                      <td className="px-5 py-4 border-l-4 border-l-brand-cyan bg-brand-cyan-soft/30">
                        <CellContent cell={row.us} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-cream/60">
          Competitor details and pricing recorded from public sources, {LAST_VERIFIED}. Spot
          something stale or unfair? Tell us and we&apos;ll fix it.
        </p>
      </section>

      {/* Where Bright Ears fits — cream poster with collage accents */}
      <section className="relative max-w-6xl mx-auto px-6 pb-16">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-8 -left-8 h-36 w-56" />
          <div className="relative overflow-hidden rounded-3xl bg-cream p-7 sm:p-10 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <VinylDisc size={150} tone="dark" className="-right-16 -top-16" />
            <HaloRing width={200} height={70} tilt={12} className="-left-12 -bottom-10" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage">
                {page.fitHeading}
              </h2>
              <div className="mt-5 space-y-4 max-w-3xl">
                {page.fitParagraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="text-ink-stage/70">
                    {paragraph}
                  </p>
                ))}
              </div>
              {page.fitPullQuote && (
                <blockquote className="mt-6 max-w-2xl rounded-xl border-l-4 border-neon-magenta bg-cream-bright p-5 font-medium text-ink-stage">
                  “{page.fitPullQuote.quote}”
                  <footer className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                    — {page.fitPullQuote.source}
                  </footer>
                </blockquote>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing strip — two cream posters, ours gradient-painted */}
      <section className="relative max-w-6xl mx-auto px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6 sm:p-7">
            <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-stage/50">
              {page.competitor} · verified {LAST_VERIFIED}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-ink-stage">
              {page.competitorPrice}
            </div>
            <p className="mt-2 text-sm text-ink-stage/65">
              Range across published tiers on the vendor&apos;s public pricing page.
            </p>
          </Card>
          <div className="relative">
            <GradientBlob tone="show" className="-bottom-6 right-8 h-28 w-56" />
            <Card className="relative p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <StickerChip tone="ink" rotate={-2}>
                  Bright Ears
                </StickerChip>
                <span className="text-xs text-ink-stage/60">{BRIGHT_EARS_PRICING.trial}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
                {BRIGHT_EARS_PRICING.tiers.map((tier) => (
                  <div key={tier.name} className="font-bold text-ink-stage">
                    {tier.name} <span className={`font-black tracking-tight ${GRAD}`}>{tier.price}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-ink-stage/65">{BRIGHT_EARS_PRICING.overage}</p>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-cream-bright">
          Frequently asked
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {page.faqs.map((faq) => (
            <div key={faq.question} className="rounded-2xl bg-cream p-6">
              <h3 className="font-bold text-ink-stage">{faq.question}</h3>
              <p className="mt-2 text-sm text-ink-stage/70">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band — cream poster with collage, magenta show pill */}
      <section className="relative max-w-6xl mx-auto px-6 pb-8">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-9 left-12 h-40 w-80" />
          <div className="relative overflow-hidden rounded-3xl bg-cream px-8 py-12 sm:p-12 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] rotate-[-0.6deg]">
            <HaloRing width={300} height={108} tilt={-12} className="left-1/2 top-6 -ml-40" />
            <VinylDisc size={160} tone="orange" spin className="-bottom-12 -right-10" />
            <span aria-hidden className="absolute left-[12%] top-9 text-xl text-ink-stage/25">
              &#10022;
            </span>
            <h2 className="relative text-2xl sm:text-4xl font-black tracking-tight text-ink-stage">
              {page.ctaHeading}
            </h2>
            <p className="relative mt-3 text-ink-stage/70 max-w-xl mx-auto">{page.ctaSub}</p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/onboarding"
                className="inline-block rounded-full bg-neon-magenta px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
              >
                Get started
              </Link>
              <Link href="/compare" className={buttonStyles.secondaryOnLight}>
                All comparisons
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
