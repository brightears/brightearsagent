import Image from "next/image";
import Link from "next/link";

const NAV = [
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/tools/inquiry-reply-generator", label: "Free tools" },
  { href: "/story", label: "Our story" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-off-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/logo.svg" alt="Bright Ears" width={32} height={32} className="bg-deep-teal rounded-lg p-1" />
            <span className="font-bold text-deep-teal text-lg">Bright Ears</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-ink/70 hover:text-brand-cyan transition-colors">
                {n.label}
              </Link>
            ))}
            <Link
              href="/onboarding"
              className="rounded-xl bg-brand-cyan text-white font-semibold px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-off-white mt-24">
        <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-ink/50 flex flex-wrap gap-6 justify-between">
          <div className="flex items-center gap-2">
            <Image src="/brand/logo.svg" alt="" width={20} height={20} className="bg-deep-teal rounded p-0.5" />
            <span>Bright Ears — 20 years in entertainment, now working for your business.</span>
          </div>
          <div className="flex gap-5">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-brand-cyan">
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
