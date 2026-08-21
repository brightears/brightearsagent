import Link from "next/link";
import { BrightEarsLogo } from "@/components/ui";
import { getTranslations } from "@/lib/i18n/server";

/**
 * Branded 404 (audit 2026-07: lost visitors hit Next's bare default — no nav,
 * no logo, no way home — wearing the retired root-title tagline). Ink canvas,
 * typography-first, one obvious exit. No emoji (v2.1 LAW).
 */
export default async function NotFound() {
  const { locale } = await getTranslations();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-stage px-6 text-center">
      <BrightEarsLogo size={44} />
      <p className="mt-8 font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">
        {c("404 — nothing playing here", "404 — ไม่พบหน้านี้")}
      </p>
      <h1 className="mt-3 max-w-xl text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
        {c("This page missed its", "หน้านี้ไม่ผ่าน")}{" "}
        <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
          {c("soundcheck.", "การซาวด์เช็ก")}
        </span>
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/60">
        {c("The link is broken or the page moved on. The gigs haven't — head back and let the agent keep hunting.", "ลิงก์อาจไม่ถูกต้องหรือหน้านี้ถูกย้าย กลับไปหน้าหลักเพื่อให้ผู้ช่วยค้นหางานต่อ")}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-full bg-brand-cyan px-5 py-2.5 font-bold text-ink-stage transition-opacity hover:opacity-90"
        >
          {c("Back to the front page", "กลับหน้าหลัก")}
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-cream/60 hover:text-brand-cyan"
        >
          {c("Your dashboard →", "แดชบอร์ดของคุณ →")}
        </Link>
      </div>
    </main>
  );
}
