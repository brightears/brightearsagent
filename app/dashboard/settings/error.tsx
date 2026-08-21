"use client";

// Friendly error boundary for the settings route (audit C3-NF). The billing
// server actions (startCheckout / openBillingPortal) throw on misconfiguration
// ("Billing not configured yet", "No subscription yet", a Stripe hiccup); without
// this a thrown action crashed to an unstyled Next error page mid-flow.
import { buttonStyles } from "@/components/ui";
import { useI18n } from "@/components/locale-provider";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 text-center">
        <h1 className="text-xl font-extrabold text-cream-bright">{c("Something hit a snag", "เกิดข้อขัดข้อง")}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-cream/70">
          {locale === "th"
            ? "ยังดำเนินการไม่สำเร็จ บัญชีของคุณไม่มีการเปลี่ยนแปลง โปรดลองอีกครั้งหรือกลับไปที่ไปป์ไลน์"
            : `${error.message || "We couldn't complete that just now."} Your account is unchanged — give it another try, or head back to your pipeline.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={buttonStyles.primary}>
            {c("Try again", "ลองอีกครั้ง")}
          </button>
          <a href="/dashboard" className={buttonStyles.secondary}>
            {c("Back to pipeline", "กลับไปที่ไปป์ไลน์")}
          </a>
        </div>
      </div>
    </main>
  );
}
