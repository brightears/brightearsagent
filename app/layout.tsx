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
  title: "Bright Ears — your gigs, answered and booked",
  description:
    "The AI office for DJ and entertainment businesses: every inquiry answered in minutes, in your voice, with your real availability — you just tap Approve.",
  manifest: "/manifest.json",
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
