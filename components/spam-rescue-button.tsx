"use client";

// One-tap spam rescue (P10.6): flips the lead back to NEW, drafts the reply
// the classifier withheld, and lands the owner on it — the full "Not spam →
// draft reply" promise in a single tap.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rescueFromSpam } from "@/app/actions/drafts";
import { buttonStyles } from "@/components/ui";
import { useI18n } from "@/components/locale-provider";

export function SpamRescueButton({ leadId }: { leadId: string }) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRescue = () =>
    startTransition(async () => {
      setError(null);
      const result = await rescueFromSpam(leadId);
      if (!result.ok) {
        setError(result.error ?? c("Something went wrong — try again.", "เกิดข้อผิดพลาด โปรดลองอีกครั้ง"));
        return;
      }
      router.push(`/dashboard/leads/${result.leadId}`);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onRescue}
        disabled={isPending}
        className={`${buttonStyles.secondaryOnLight} text-sm whitespace-nowrap`}
      >
        {isPending ? c("Rescuing…", "กำลังกู้คืน…") : c("Not spam — draft reply", "ไม่ใช่สแปม — ร่างข้อความตอบ")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
