// Agent-paused banner (audit C3) — surfaces in the app (not just an optional
// push) so an owner sees the agent is paused and how to switch it on. Pure
// presentation (server component): the caller passes the resolved meter + state.
//
// No free trial (founder 2026-06-16): two paused cases only —
//   - NOT subscribed            → agent paused → "subscribe to switch it on"
//   - PAID plan over the lead cap → drafting paused until next month → "upgrade"
//   - subscribed & under cap     → NOT paused → render nothing.
// The CTA links to /dashboard/settings#billing (the plan cards / portal).

import Link from "next/link";
import { Kicker, buttonStyles } from "@/components/ui";
import type { Locale } from "@/lib/i18n/config";

export type AtCapBannerProps = {
  /** Leads counted this month (non-SPAM). */
  used: number;
  /** This plan's monthly lead cap. */
  cap: number;
  /** meterState().overCap — agent paused (unsubscribed) OR used > cap. */
  overCap: boolean;
  /** A live paid subscription exists (billingState().subscribed). */
  subscribed: boolean;
  locale?: Locale;
};

/**
 * Returns the banner, or null when nothing should show. An under-cap paid plan
 * renders nothing — the agent is working.
 */
export function AtCapBanner({ used, cap, overCap, subscribed, locale = "en" }: AtCapBannerProps) {
  // Subscribed and under cap → agent live, no banner. (Unsubscribed is always
  // overCap via isAgentPaused, so it always shows the "subscribe" banner.)
  if (subscribed && !overCap) return null;

  const notSubscribed = !subscribed;
  const c = (english: string, thai: string) => locale === "th" ? thai : english;

  return (
    <section className="mb-8">
      <div className="rounded-3xl border border-[#ffdfba]/40 bg-[#ffdfba] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
        <Kicker onLight>{notSubscribed ? c("Agent paused", "ผู้ช่วยหยุดชั่วคราว") : c("Lead cap reached", "ถึงขีดจำกัดลูกค้าแล้ว")}</Kicker>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm font-medium text-[#7a4100]">
            {notSubscribed ? (
              <>
                {c("Your agent is paused — your setup is saved, but the Hunt isn't finding venues or drafting outreach, and inbound replies are on hold. New inquiries still arrive and nothing is lost. Choose a plan to switch your agent on.", "ผู้ช่วยหยุดชั่วคราว การตั้งค่าของคุณยังบันทึกอยู่ แต่ระบบยังไม่ค้นหาสถานที่ ร่างข้อความแนะนำตัว หรือตอบข้อความใหม่ ข้อความสอบถามยังเข้ามาตามปกติและไม่มีข้อมูลสูญหาย เลือกแผนเพื่อเปิดใช้งานผู้ช่วย")}
              </>
            ) : (
              <>
                {c("You've used", "คุณใช้ไปแล้ว")}{" "}
                <span className="font-bold">
                  {used} of {cap}
                </span>{" "}
                {c("inquiries this month — drafting is paused until next month. Upgrade for more. New inquiries still arrive; nothing is lost, and no surprise bill, ever.", "ข้อความสอบถามในเดือนนี้ ระบบหยุดร่างไว้จนถึงเดือนหน้า อัปเกรดเพื่อเพิ่มจำนวน ข้อความใหม่ยังเข้ามาและไม่มีข้อมูลสูญหายหรือค่าใช้จ่ายเกินคาด")}
              </>
            )}
          </p>
          <Link
            href="/dashboard/settings#billing"
            className={`${buttonStyles.primary} flex-none whitespace-nowrap text-center`}
          >
            {notSubscribed ? c("Choose a plan", "เลือกแผน") : c("Upgrade", "อัปเกรด")}
          </Link>
        </div>
      </div>
    </section>
  );
}
