import type { Metadata } from "next";

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
  return (process.env.APP_URL ?? "https://brightears-app.onrender.com").replace(/\/$/, "");
}

/**
 * Per-page metadata with explicit OG/Twitter titles. Next.js inheritance
 * REPLACES nothing when a page omits openGraph — it inherits the ROOT's
 * og:title verbatim — so key pages set their own (docs: generate-metadata
 * "Inheriting fields"). The og image itself comes from the root
 * app/opengraph-image.tsx file convention and needs no mention here.
 */
export function pageMeta(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: { title, description, siteName: "Bright Ears", type: "website" },
    twitter: { card: "summary_large_image", title, description },
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
