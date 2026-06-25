// Hosted one-page EPK (Phase 10.1) — the landing page every agent pitch
// links to. WHITE-LABEL INVARIANT (CLAUDE.md rule 7): this page represents
// THE ARTIST. Zero Bright Ears branding, zero AI mention, no app chrome.
// Design language v2 "Neon Collage" applied brand-neutrally: ink canvas,
// display-black type with one gradient word, cream poster panels, sticker
// chips, mono kickers — it reads as the artist's own poster page.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { videoEmbedUrl } from "@/lib/profile/video";
import { GradientBlob, RingsBackdrop, StickerChip, VinylDisc } from "@/components/collage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function getEpkBusiness(slug: string) {
  const business = await db.business.findUnique({
    where: { slug },
    include: {
      packages: { where: { active: true }, orderBy: { priceMin: "asc" } },
    },
  });
  if (!business || !business.epkEnabled) return null;
  return business;
}

/** Friendly label for a social/streaming link, inferred from its host. */
function socialLabel(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "Link";
  }
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("tiktok")) return "TikTok";
  if (host.includes("soundcloud")) return "SoundCloud";
  if (host.includes("mixcloud")) return "Mixcloud";
  if (host.includes("spotify")) return "Spotify";
  if (host.includes("youtube") || host.includes("youtu.be")) return "YouTube";
  if (host.includes("bandcamp")) return "Bandcamp";
  if (host === "x.com" || host.includes("twitter")) return "X";
  if (host.includes("facebook") || host === "fb.com") return "Facebook";
  if (host.includes("linkedin")) return "LinkedIn";
  return host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getEpkBusiness(slug);
  if (!business) return {};
  const title = business.headline || business.name;
  const description =
    business.bio && business.bio.length > 160
      ? `${business.bio.slice(0, 157).trimEnd()}…`
      : business.bio || `Booking and availability — ${business.name}.`;
  return {
    title: `${title} — ${business.name}`,
    description,
    // White-label: don't inherit the app's PWA manifest link on the artist's page.
    manifest: null,
    openGraph: {
      title,
      description,
      type: "profile",
      ...(business.photoUrls[0] ? { images: [business.photoUrls[0]] } : {}),
    },
  };
}

/* Brand-neutral kicker — mono ALL-CAPS, cream/50, magenta square (the show
   voice; cyan is the PRODUCT voice and this page isn't the product). */
function EpkKicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-cream/65">
      <span aria-hidden className="size-1 flex-none bg-neon-magenta" />
      {children}
    </span>
  );
}

/* Gradient pull quote — words painted along the magenta→orange spectrum. */
function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

function GradientQuote({ quote }: { quote: string }) {
  const words = quote.split(/\s+/).filter(Boolean);
  return (
    <p className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.1]">
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          style={{ color: lerpHex("#ff2dae", "#ff8a00", words.length > 1 ? i / (words.length - 1) : 0) }}
        >
          {word}{" "}
        </span>
      ))}
    </p>
  );
}

/* Headline with the LAST word gradient-painted (the v2 signature). */
function PaintedHeadline({ text }: { text: string }) {
  const at = text.lastIndexOf(" ");
  const head = at === -1 ? "" : text.slice(0, at + 1);
  const last = at === -1 ? text : text.slice(at + 1);
  return (
    <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[0.95] text-cream-bright">
      {head}
      <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
        {last}
      </span>
    </h1>
  );
}

export default async function EpkPage({ params }: Props) {
  const { slug } = await params;
  const business = await getEpkBusiness(slug);
  if (!business) notFound();

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: business.currency,
    maximumFractionDigits: 0,
  });
  const priceLabel = (minCents: number, maxCents: number | null) =>
    maxCents !== null && maxCents !== minCents
      ? `${money.format(minCents / 100)}–${money.format(maxCents / 100)}`
      : money.format(minCents / 100);

  const embedUrl = business.videoLinks.map(videoEmbedUrl).find((u): u is string => u !== null);
  const contactEmail = business.replyToEmail || business.ownerEmail;
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(
    `Availability inquiry — ${business.name}`,
  )}`;
  const headline = business.headline || business.name;
  const quote = business.reviewQuotes[0];

  return (
    <main className="min-h-screen bg-ink-stage text-cream-bright">
      <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-14 sm:pt-20">
        {/* HERO — name kicker, painted headline, bio, genre stickers. */}
        <header className="relative overflow-hidden rounded-3xl border border-cream/10 bg-ink-raised px-7 py-10 sm:px-10 sm:py-14">
          <RingsBackdrop />
          <div className="relative">
            <EpkKicker>
              {business.name}
              {business.serviceCities.length > 0 && ` — ${business.serviceCities.join(" / ")}`}
            </EpkKicker>
            <div className="mt-4 max-w-3xl">
              <PaintedHeadline text={headline} />
            </div>
            {business.bio && (
              <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-cream/70">
                {business.bio}
              </p>
            )}
            {business.genres.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2.5">
                {business.genres.map((genre, i) => (
                  <StickerChip
                    key={genre}
                    tone={i === 0 ? "magenta" : "cream"}
                    rotate={i % 3 === 0 ? -2 : i % 3 === 1 ? 1.5 : 0}
                  >
                    {genre}
                  </StickerChip>
                ))}
              </div>
            )}
            <div className="mt-9">
              <a
                href={mailto}
                className="inline-block rounded-full bg-neon-magenta px-7 py-3 font-bold text-white shadow-[0_8px_28px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90"
              >
                Check availability
              </a>
            </div>
          </div>
        </header>

        {/* VIDEO — the first recognizable YouTube/Vimeo link, lazy iframe. */}
        {embedUrl && (
          <section className="mt-14">
            <EpkKicker>See it live</EpkKicker>
            <div className="relative mt-4">
              <GradientBlob tone="show" className="-bottom-8 -left-8 h-40 w-56" />
              <div className="relative aspect-video overflow-hidden rounded-3xl bg-ink-raised shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
                <iframe
                  src={embedUrl}
                  title={`${business.name} — performance video`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </div>
          </section>
        )}

        {/* PHOTOS — asymmetric grid of external images. */}
        {business.photoUrls.length > 0 && (
          <section className="mt-14">
            <EpkKicker>The room, mid-set</EpkKicker>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {business.photoUrls.slice(0, 9).map((url, i) => (
                /* External URLs (v1, no upload infra) — plain img, not next/image. */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`${business.name} — photo ${i + 1}`}
                  loading="lazy"
                  className={`h-52 w-full rounded-2xl object-cover sm:h-60 ${
                    i % 5 === 0 ? "col-span-2 sm:col-span-1" : ""
                  }`}
                />
              ))}
            </div>
          </section>
        )}

        {/* QUOTE — the gradient pull-quote on a cream poster, vinyl bleed. */}
        {quote && (
          <section className="mt-14">
            <div className="relative overflow-hidden rounded-3xl bg-cream px-7 py-10 sm:px-10 sm:py-12">
              <VinylDisc size={120} tone="dark" className="-bottom-14 -right-12" />
              <div className="relative max-w-3xl">
                <GradientQuote quote={`“${quote}”`} />
                {business.reviewQuotes.slice(1).map((q) => (
                  <p key={q} className="mt-5 text-lg font-semibold text-ink-stage/70">
                    “{q}”
                  </p>
                ))}
                <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-stage/45">
                  What clients say
                </p>
              </div>
            </div>
          </section>
        )}

        {/* NOTABLE VENUES — a single mono statement line. */}
        {business.notableVenues.length > 0 && (
          <section className="mt-14">
            <EpkKicker>Rooms played</EpkKicker>
            <p className="mt-3 font-mono text-sm font-bold uppercase tracking-[0.18em] leading-loose text-cream/75">
              {business.notableVenues.join("  ·  ")}
            </p>
          </section>
        )}

        {/* PACKAGES — names + price ranges on a cream poster panel. */}
        {business.packages.length > 0 && (
          <section className="mt-14">
            <EpkKicker>Packages</EpkKicker>
            <div className="mt-4 overflow-hidden rounded-3xl bg-cream">
              <ul className="divide-y divide-ink-stage/10">
                {business.packages.map((pkg) => (
                  <li
                    key={pkg.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-7 py-5 sm:px-9"
                  >
                    <div>
                      <p className="text-lg font-extrabold tracking-tight text-ink-stage">
                        {pkg.name}
                      </p>
                      {pkg.description && (
                        <p className="mt-0.5 max-w-xl text-sm text-ink-stage/55">{pkg.description}</p>
                      )}
                    </div>
                    <p className="font-mono text-sm font-bold text-ink-stage">
                      {priceLabel(pkg.priceMin, pkg.priceMax)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* SERVICE AREA + travel policy + practicals. */}
        {(business.serviceCities.length > 0 || business.travelPolicy || business.insured) && (
          <section className="mt-14">
            <EpkKicker>Where we play</EpkKicker>
            <div className="mt-3 max-w-2xl space-y-2 text-base text-cream/70">
              {business.serviceCities.length > 0 && (
                <p>
                  Based around{" "}
                  <span className="font-semibold text-cream-bright">
                    {business.serviceCities.join(", ")}
                  </span>
                  .
                </p>
              )}
              {business.travelPolicy && <p>{business.travelPolicy}</p>}
              {business.insured && <p>Fully insured.</p>}
            </div>
          </section>
        )}

        {/* RIDER — how the act performs and what it needs on the day. */}
        {business.riderNotes && (
          <section className="mt-14">
            <EpkKicker>What I bring &amp; need</EpkKicker>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-base leading-relaxed text-cream/70">
              {business.riderNotes}
            </p>
          </section>
        )}

        {/* SOCIAL & STREAMING — host-labelled link chips. White-label: only the
            artist's own links. */}
        {business.socialLinks.length > 0 && (
          <section className="mt-14">
            <EpkKicker>Find me</EpkKicker>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {business.socialLinks.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-full border border-cream/25 bg-cream/5 px-4 py-2 text-sm font-semibold text-cream/80 transition-colors hover:border-brand-cyan hover:text-cream-bright"
                >
                  {socialLabel(url)}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* CLOSING CTA — one action on this page, repeated once at the end. */}
        <section className="mt-16">
          <div className="relative overflow-hidden rounded-3xl bg-ink-raised border border-cream/10 px-7 py-12 sm:px-10 text-center">
            <GradientBlob tone="show" className="-top-12 left-1/2 h-32 w-64 -translate-x-1/2" />
            <div className="relative">
              <p className="text-3xl sm:text-5xl font-black tracking-tighter leading-[0.95]">
                Got a date in{" "}
                <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
                  mind?
                </span>
              </p>
              <a
                href={mailto}
                className="mt-8 inline-block rounded-full bg-neon-magenta px-8 py-3.5 font-bold text-white shadow-[0_8px_28px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90"
              >
                Check availability
              </a>
              <p className="mt-5">
                <a
                  href={`/epk/${business.slug}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-cream/55 underline-offset-4 hover:text-cream-bright hover:underline"
                >
                  Download one-pager (PDF)
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* FOOTER — the artist's name and the year. Nothing else, ever. */}
        <footer className="mt-12 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cream/35">
          {business.name} · {new Date().getFullYear()}
        </footer>
      </div>
    </main>
  );
}
