// Marketing shell — design language v2 "Neon Collage" (docs/DESIGN.md, THE LAW;
// canonical preview: app/(marketing)/design/b/page.tsx). Ink canvas, cream nav
// links with cyan hover (interface voice), magenta "Start free" pill (show voice).
import Link from "next/link";
import { BrightEarsLogo } from "@/components/ui";
import { MarketingMobileMenu } from "@/components/marketing-mobile-menu";

const NAV = [
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/tools/inquiry-reply-generator", label: "Free tools" },
  { href: "/story", label: "Our story" },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/cookies", label: "Cookies" },
  { href: "/dpa", label: "DPA" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-ink-stage text-cream-bright">
      <header className="sticky top-0 z-40 border-b border-cream/10 bg-ink-stage/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrightEarsLogo size={32} />
            <span className="text-lg font-black tracking-tight text-cream-bright">Bright Ears</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-cream/65 transition-colors hover:text-brand-cyan"
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/onboarding"
              className="rounded-full bg-neon-magenta px-5 py-2 font-bold text-white shadow-[0_6px_24px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90"
            >
              Start free
            </Link>
          </nav>
          <MarketingMobileMenu links={NAV} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-24 border-t border-cream/10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-8 gap-y-8 px-6 py-10 text-sm text-cream/65">
          <div className="flex items-center gap-2.5">
            <BrightEarsLogo size={20} />
            <span>Bright Ears — 20 years in entertainment, now working for your business.</span>
          </div>
          <nav className="flex gap-5">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition-colors hover:text-brand-cyan">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 sm:items-end">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cream/65">
              Legal
            </span>
            <nav className="flex gap-5">
              {LEGAL.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="transition-colors hover:text-brand-cyan"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
