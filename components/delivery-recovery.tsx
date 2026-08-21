"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctLeadEmail } from "@/app/actions/delivery";
import { useI18n } from "@/components/locale-provider";

export function DeliveryRecovery({
  leadId,
  currentEmail,
  reason,
  complaint,
}: {
  leadId: string;
  currentEmail: string | null;
  reason: string | null;
  complaint: boolean;
}) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await correctLeadEmail(leadId, email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-neon-orange/45 bg-[#ffdfba] px-4 py-4 text-ink-stage shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
      <p className="font-semibold">
        {complaint ? c("Follow-up stopped: spam complaint", "หยุดติดตาม: มีการร้องเรียนสแปม") : c("This reply was not delivered", "ส่งข้อความตอบนี้ไม่สำเร็จ")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-stage/75">
        {reason ?? c("The email provider rejected the message.", "ผู้ให้บริการอีเมลปฏิเสธข้อความ")}
      </p>
      {complaint ? (
        <p className="mt-2 text-sm font-medium">
          {c("This is a permanent consent stop. Bright Ears will not send to this recipient again.", "นี่คือการหยุดส่งถาวรตามความยินยอม Bright Ears จะไม่ส่งข้อความถึงผู้รับรายนี้อีก")}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
          <label className="flex-1">
            <span className="sr-only">{c("Correct email address", "อีเมลที่ถูกต้อง")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder={currentEmail ? c(`Different from ${currentEmail}`, `อีเมลที่ไม่ใช่ ${currentEmail}`) : c("Correct email address", "อีเมลที่ถูกต้อง")}
              className="w-full rounded-xl border border-ink-stage/20 bg-white px-3 py-2 text-sm text-ink-stage outline-none focus:border-ink-stage"
            />
            {error && <span className="mt-1 block text-xs font-semibold text-[#7a1800]">{error}</span>}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink-stage px-4 py-2 text-sm font-bold text-cream-bright disabled:opacity-50"
          >
            {pending ? c("Preparing…", "กำลังเตรียม…") : c("Save & prepare reply", "บันทึกและเตรียมข้อความตอบ")}
          </button>
        </form>
      )}
    </div>
  );
}
