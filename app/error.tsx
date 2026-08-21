"use client";

// Branded root error boundary (audit 2026-07: the only boundary lived under
// /dashboard/settings — anywhere else, a render crash fell through to Next's
// bare default). Same ink-canvas pattern as app/not-found.tsx: logo, calm
// copy, one obvious retry, two exits. No emoji (v2.1 LAW). Nothing here says
// "AI" or shows internals — the agent's work is unaffected by a page hiccup
// and the copy says so.
import Link from "next/link";
import { BrightEarsLogo, buttonStyles } from "@/components/ui";
import { useI18n } from "@/components/locale-provider";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-stage px-6 text-center">
      <BrightEarsLogo size={44} />
      <p className="mt-8 font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">
        {c("A skipped beat", "จังหวะสะดุด")}
      </p>
      <h1 className="mt-3 max-w-xl text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
        {c("This page hit a", "หน้านี้มี")}{" "}
        <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
          {c("wrong note.", "ข้อผิดพลาด")}
        </span>
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/60">
        {c("Something went sideways on our end — your account and your pipeline are untouched, and the agent keeps working. Try again, or head somewhere solid.", "ระบบขัดข้องชั่วคราว บัญชีและไปป์ไลน์ของคุณไม่ได้รับผลกระทบ และผู้ช่วยยังทำงานต่อ โปรดลองอีกครั้งหรือกลับไปหน้าอื่น")}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={reset} className={buttonStyles.primary}>
          {c("Try again", "ลองอีกครั้ง")}
        </button>
        <Link href="/" className={buttonStyles.secondary}>
          {c("Front page", "หน้าหลัก")}
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
