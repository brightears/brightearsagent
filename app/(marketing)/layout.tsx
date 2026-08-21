// Marketing shell — design language v2 "Neon Collage" (docs/DESIGN.md, THE LAW;
// canonical preview: app/(marketing)/design/b/page.tsx). Ink canvas, cream nav
// links with cyan hover (interface voice), magenta profile CTA (show voice).
import Link from "next/link";
import { BrightEarsLogo } from "@/components/ui";
import { MarketingMobileMenu } from "@/components/marketing-mobile-menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "@/lib/i18n/server";
import { TranslationCoverageNotice } from "@/components/translation-coverage-notice";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getTranslations();
  const nav = [
    { href: "/pricing", label: t("nav.pricing") },
    { href: "/compare", label: t("nav.compare") },
    { href: "/tools/inquiry-reply-generator", label: t("nav.freeTools") },
    { href: "/story", label: t("nav.story") },
  ];
  const legal = [
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/terms", label: t("footer.terms") },
    { href: "/acceptable-use", label: t("footer.acceptableUse") },
    { href: "/cookies", label: t("footer.cookies") },
    { href: "/dpa", label: t("footer.dpa") },
  ];
  return (
    <div className="flex flex-1 flex-col bg-ink-stage text-cream-bright">
      <header className="sticky top-0 z-40 border-b border-cream/10 bg-ink-stage/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrightEarsLogo size={32} />
            <span className="text-lg font-black tracking-tight text-cream-bright">Bright Ears</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-cream/65 transition-colors hover:text-brand-cyan"
              >
                {n.label}
              </Link>
            ))}
            {/* Returning customers had no way back in (audit 2026-07) — quiet
                interface-voice link; the CTA keeps the show voice. */}
            <Link
              href="/dashboard"
              prefetch={false}
              className="text-cream/65 transition-colors hover:text-brand-cyan"
            >
              {t("nav.signIn")}
            </Link>
            <Link
              href="/onboarding"
              prefetch={false}
              className="whitespace-nowrap rounded-full bg-neon-magenta px-5 py-2 font-bold text-ink-stage shadow-[0_6px_24px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90"
            >
              {t("nav.buildProfile")}
            </Link>
            <LanguageSwitcher compact />
          </nav>
          <MarketingMobileMenu links={nav} />
        </div>
      </header>
      <TranslationCoverageNotice />
      <main className="flex-1">{children}</main>
      <footer className="mt-24 border-t border-cream/10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-8 gap-y-8 px-6 py-10 text-sm text-cream/65">
          <div className="flex items-center gap-2.5">
            <BrightEarsLogo size={20} />
            <span>Bright Ears — {t("footer.tagline")}</span>
          </div>
          <nav className="flex gap-5">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="transition-colors hover:text-brand-cyan">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 sm:items-end">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cream/65">
              {t("footer.legal")}
            </span>
            <nav className="flex gap-5">
              {legal.map((l) => (
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
