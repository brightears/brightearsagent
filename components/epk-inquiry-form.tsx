"use client";

// The EPK availability form (P12.5) — WHITE-LABEL: this is the ARTIST's
// page; the form speaks as them and never mentions any product. Submissions
// feed the tenant's own inbound pipeline (app/actions/epk.ts).
import { useActionState } from "react";
import { submitEpkInquiry, type EpkInquiryState } from "@/app/actions/epk";
import type { Locale } from "@/lib/i18n/config";

// Focus ring is cyan per docs/DESIGN.md — interaction voice, even on show surfaces.
const inputCls =
  "w-full rounded-xl border border-cream/20 bg-ink-stage px-3.5 py-2.5 text-base text-cream-bright placeholder:text-cream/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/30";

export function EpkInquiryForm({ slug, artistName, locale = "en" }: { slug: string; artistName: string; locale?: Locale }) {
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const [state, formAction, pending] = useActionState<EpkInquiryState, FormData>(
    submitEpkInquiry.bind(null, slug),
    null,
  );

  if (state?.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-cream/15 bg-ink-stage px-6 py-8 text-center">
        <p className="text-xl font-black tracking-tight text-cream-bright">{c("Inquiry sent.", "ส่งคำขอแล้ว")}</p>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">
          {c(`${artistName} replies personally — usually fast. Keep an eye on your inbox.`, `${artistName} จะตอบกลับโดยตรง ปกติใช้เวลาไม่นาน โปรดตรวจอีเมลของคุณ`) }
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-3 text-left">
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="name"
          required
          placeholder={c("Your name", "ชื่อของคุณ")}
          aria-label={c("Your name", "ชื่อของคุณ")}
          className={inputCls}
        />
        <input
          name="email"
          type="email"
          required
          placeholder={c("Your email", "อีเมลของคุณ")}
          aria-label={c("Your email", "อีเมลของคุณ")}
          className={inputCls}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="eventType"
          placeholder={c("Event type (wedding, party…)", "ประเภทงาน (งานแต่ง ปาร์ตี้…)")}
          aria-label={c("Event type", "ประเภทงาน")}
          className={inputCls}
        />
        <input name="eventDate" type="date" aria-label={c("Event date", "วันที่จัดงาน")} className={inputCls} />
      </div>
      <textarea
        name="message"
        rows={4}
        placeholder={c("A few words about your event — venue, vibe, timings…", "เล่าเกี่ยวกับงานของคุณสักเล็กน้อย เช่น สถานที่ บรรยากาศ และเวลา")}
        aria-label={c("About your event", "เกี่ยวกับงานของคุณ")}
        className={inputCls}
      />
      {state && !state.ok && state.error && (
        <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-medium text-red-300">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-neon-magenta px-7 py-3 font-bold text-ink-stage shadow-[0_8px_28px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? c("Sending…", "กำลังส่ง…") : c("Check availability", "เช็กวันว่าง")}
      </button>
    </form>
  );
}
