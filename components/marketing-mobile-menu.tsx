"use client";

// Mobile nav for the marketing header (audit C5). Below 640px the desktop nav —
// including the only "Get started" CTA — was `hidden sm:flex` with no fallback,
// so phone visitors had no navigation and no call to action. This adds an
// accessible hamburger toggle (aria-expanded/aria-controls) revealing the links
// + CTA. Shown only below sm; the desktop nav stays `hidden sm:flex`.
import { useState } from "react";
import Link from "next/link";

export function MarketingMobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="marketing-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/25 text-cream-bright transition-colors hover:border-cream/50"
      >
        <span aria-hidden className="relative block h-3.5 w-5">
          <span
            className={`absolute left-0 block h-0.5 w-5 bg-current transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`}
          />
          <span
            className={`absolute left-0 top-1.5 block h-0.5 w-5 bg-current transition-opacity ${open ? "opacity-0" : "opacity-100"}`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-5 bg-current transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`}
          />
        </span>
      </button>
      {open && (
        <div
          id="marketing-mobile-nav"
          className="absolute inset-x-0 top-16 border-b border-cream/10 bg-ink-stage/95 backdrop-blur"
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4 text-sm font-medium">
            {links.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-cream/80 transition-colors hover:text-brand-cyan"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-cream/80 transition-colors hover:text-brand-cyan"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-neon-magenta px-5 py-2.5 text-center font-bold text-white shadow-[0_6px_24px_rgba(255,45,174,0.35)]"
            >
              Get started
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
