import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
  // Staging must never outrank (or become) the real site — noindex everything
  // while APP_URL is the onrender.com host; flips itself at cutover. Pairs
  // with the same gate in app/robots.ts.
  ...(process.env.APP_URL?.includes("onrender.com")
    ? { robots: { index: false, follow: false } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: "#00bbe4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const html = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
  // Dev single-tenant mode (no Clerk keys) renders without the provider.
  return clerkEnabled ? <ClerkProvider>{html}</ClerkProvider> : html;
}
