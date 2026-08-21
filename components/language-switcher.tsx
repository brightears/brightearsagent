"use client";

import { usePathname } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { useI18n } from "@/components/locale-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const nextLocale = locale === "th" ? "en" : "th";

  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={nextLocale} />
      <input type="hidden" name="returnTo" value={pathname} />
      <button
        type="submit"
        aria-label={locale === "th" ? t("language.switchToEnglish") : t("language.switchToThai")}
        className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:border-cyan hover:text-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
      >
        {compact ? (nextLocale === "th" ? "ไทย" : "EN") : nextLocale === "th" ? "ไทย" : "English"}
      </button>
    </form>
  );
}
