import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { thTH } from "@clerk/localizations/th-TH";
import { appUrlLenient } from "@/lib/app-url";
import { LocaleProvider } from "@/components/locale-provider";
import { getRequestLocale } from "@/lib/i18n/server";
import { SOCIAL_IMAGE } from "@/lib/marketing/site";
import "./globals.css";

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Hunt-led (the retired reactive tagline leaked from here onto every 404 —
  // audit 2026-07). Per-page metadata overrides this; it's the fallback voice.
  title: "Bright Ears — the AI that finds gigs for performers",
  description:
    "Finds venues and gigs for performers of every kind, drafts the outreach and replies in your voice — you just tap Approve.",
  manifest: "/manifest.json",
  // iOS reads apple-touch-icon from metadata, not the manifest (P9.6) — the
  // whole approve-from-phone pitch rides on A2HS looking like a real app.
  icons: { apple: "/brand/apple-touch-icon.png" },
  // OG/Twitter defaults (P6.12): metadataBase absolutizes og:url + the
  // opengraph-image file convention's og:image; key marketing pages set their
  // own og titles via lib/marketing/site.ts pageMeta (Next inherits the ROOT
  // og:title otherwise). Canonical "./" = self-referential per route.
  metadataBase: new URL(appUrlLenient()),
  alternates: { canonical: "./" },
  openGraph: {
    url: "./",
    siteName: "Bright Ears",
    type: "website",
    title: "Bright Ears — the AI that finds gigs for performers",
    description:
      "Finds venues and gigs for performers of every kind, drafts the outreach and replies in your voice — you just tap Approve.",
    images: [SOCIAL_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [SOCIAL_IMAGE] },
  // Staging must never outrank (or become) the real site — noindex everything
  // while APP_URL is the onrender.com host; flips itself at cutover. Pairs
  // with the same gate in app/robots.ts. A MISSING APP_URL reads as staging
  // (noindex on): the safe failure mode is an unindexed site, never an
  // indexed staging host.
  ...(!process.env.APP_URL || process.env.APP_URL.includes("onrender.com")
    ? { robots: { index: false, follow: false } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#00bbe4",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const html = (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
  // Dev single-tenant mode (no Clerk keys) renders without the provider.
  return clerkEnabled ? (
    <ClerkProvider localization={locale === "th" ? thTH : undefined}>{html}</ClerkProvider>
  ) : (
    html
  );
}
