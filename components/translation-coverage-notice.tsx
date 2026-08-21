"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/components/locale-provider";

const THAI_PAGES = new Set(["/", "/pricing"]);
const LEGAL_PREFIXES = ["/privacy", "/terms", "/acceptable-use", "/cookies", "/dpa"];

/** Marks secondary editorial/SEO reference pages that are not part of the
 * localized product journey. Legal pages carry their own stronger notice. */
export function TranslationCoverageNotice() {
  const pathname = usePathname();
  const { locale } = useI18n();
  if (
    locale !== "th" ||
    THAI_PAGES.has(pathname) ||
    LEGAL_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) return null;

  return (
    <div role="note" className="border-b border-brand-cyan/25 bg-brand-cyan/10 px-6 py-2.5 text-center text-sm text-cream/75">
      หน้านี้เป็นบทความอ้างอิงภาษาอังกฤษ ส่วนการสมัคร การตั้งค่า และการใช้งาน Bright Ears รองรับภาษาไทยแล้ว
    </div>
  );
}
