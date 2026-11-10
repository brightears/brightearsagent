import type { Metadata } from "next";
import { appUrlLenient } from "@/lib/app-url";
import type { Locale } from "@/lib/i18n/config";
import { localeAlternates } from "@/lib/i18n/routing";

export const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Bright Ears — DJs and music for venues and events",
} as const;

/**
 * Marketing-site metadata plumbing (P6.12, audit 2026-07: zero OG/Twitter
 * tags on all 19 public pages — every link shared into a DJ community
 * unfurled as a bare URL; /story's Organization schema pointed at the
 * agency's domain with a 404 logo).
 *
 * siteOrigin is env-driven: the onrender.com staging host today, the real
 * domain at cutover — schema and canonicals correct themselves when APP_URL
 * flips. (Staging is noindexed anyway; see app/robots.ts.)
 */
export function siteOrigin(): string {
  return appUrlLenient();
}

/**
 * Per-page metadata with explicit OG/Twitter titles. Next.js inheritance
 * REPLACES nothing when a page omits openGraph — it inherits the ROOT's
 * og:title verbatim — so key pages set their own (docs: generate-metadata
 * "Inheriting fields"). Supplying openGraph here also replaces the root
 * openGraph object, so the shared image must be repeated explicitly.
 */
export function pageMeta(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      // Route-relative so metadataBase resolves the canonical URL for each
      // marketing page instead of silently omitting og:url.
      url: "./",
      siteName: "Bright Ears",
      type: "website",
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
  };
}

/**
 * Metadata for a marketing page that exists in English and Thai. The rewrite
 * that serves /th/<page> hides the /th from Next, so a route-relative "./"
 * canonical or og:url would point the Thai page at the English URL; both are
 * set explicitly from the language being rendered instead. `openGraph`
 * overrides individual Open Graph fields (it replaces the root object, so the
 * defaults repeat the shared image and site name).
 */
export function localizedPageMeta(input: {
  path: string;
  locale: Locale;
  title: string;
  description?: string;
  openGraph?: { title?: string; description?: string; images?: Array<typeof SOCIAL_IMAGE> };
  extra?: Omit<Metadata, "title" | "description" | "alternates" | "openGraph">;
}): Metadata {
  const alternates = localeAlternates(input.path, input.locale);
  return {
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    alternates,
    openGraph: {
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      url: alternates.canonical,
      siteName: "Bright Ears",
      type: "website",
      locale: input.locale === "th" ? "th_TH" : "en_US",
      alternateLocale: input.locale === "th" ? ["en_US"] : ["th_TH"],
      images: [SOCIAL_IMAGE],
      ...input.openGraph,
    },
    ...input.extra,
  };
}

/** Organization schema — one true shape for every JSON-LD emitter. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bright Ears",
    url: siteOrigin(),
    logo: `${siteOrigin()}/brand/logo.png`,
  };
}

/** SoftwareApplication schema with the three real offers (price rich results). */
export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Bright Ears",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteOrigin(),
    description:
      "The AI booking agent for performers of every kind — finds venues, drafts outreach and replies in your voice; you approve.",
    offers: [
      { "@type": "Offer", name: "Starter", price: "25", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro", price: "79", priceCurrency: "USD" },
      { "@type": "Offer", name: "Studio", price: "149", priceCurrency: "USD" },
    ],
  };
}
