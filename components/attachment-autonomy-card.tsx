"use client";

// "Smart attachments" autonomy (Control Room → Connections). When the drafter
// detects a client asked for the act's profile or a price, the assistant can
// attach the press kit / a grounded quote automatically. Both default OFF —
// when off, the reply still flags "they asked" so you attach in one tap on
// approval. Design LAW: cream inputs, cyan, mono Kicker, no emoji.
import { useActionState } from "react";
import { updateAttachmentAutonomy } from "@/app/actions/settings";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import { useI18n } from "@/components/locale-provider";

export function AttachmentAutonomyCard({
  autoAttachProfile,
  autoAttachQuote,
}: {
  autoAttachProfile: boolean;
  autoAttachQuote: boolean;
}) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateAttachmentAutonomy(formData),
    null,
  );

  return (
    <Card className="p-6">
      <h3 className="mb-2">
        <Kicker onLight>{c("Smart attachments", "ไฟล์แนบอัจฉริยะ")}</Kicker>
      </h3>
      <p className="mb-4 text-sm text-ink-stage/60">
        {c("When a client asks for your profile or a price, the assistant can attach it for you. Off by default — when off, the reply still flags “they asked” so you attach it in one tap.", "เมื่อลูกค้าขอโปรไฟล์หรือราคา ผู้ช่วยสามารถแนบให้คุณได้ ตัวเลือกนี้ปิดไว้เป็นค่าเริ่มต้น เมื่อปิดอยู่ ระบบยังแจ้งว่าลูกค้าร้องขอ เพื่อให้คุณแนบได้ในคลิกเดียว")}
      </p>
      <form action={formAction} className="space-y-3">
        <label className="flex items-start gap-3 text-sm text-ink-stage/85">
          <input
            type="checkbox"
            name="autoAttachProfile"
            defaultChecked={autoAttachProfile}
            className="mt-0.5 size-4 accent-brand-cyan"
          />
          <span>
            <span className="font-semibold">{c("Auto-attach my press kit", "แนบเพรสคิตอัตโนมัติ")}</span>{" "}{c("when a client wants more about the act.", "เมื่อลูกค้าต้องการข้อมูลเพิ่มเติมเกี่ยวกับการแสดง")}
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink-stage/85">
          <input
            type="checkbox"
            name="autoAttachQuote"
            defaultChecked={autoAttachQuote}
            className="mt-0.5 size-4 accent-brand-cyan"
          />
          <span>
            {/* Explicit {" "}: Turbopack's prod JSX transform eats a leading
                space when the text node wraps lines (founder saw "quotewhen"). */}
            <span className="font-semibold">{c("Auto-attach a quote", "แนบใบเสนอราคาอัตโนมัติ")}</span>{" "}
            {c("when a client asks about price. Built from your own rates, never below your floor — only when there's enough to quote.", "เมื่อลูกค้าถามราคา ระบบสร้างจากราคาของคุณและไม่ต่ำกว่าราคาขั้นต่ำ โดยจะสร้างเมื่อมีข้อมูลเพียงพอเท่านั้น")}
          </span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={pending} className={buttonStyles.primary}>
            {pending ? c("Saving…", "กำลังบันทึก…") : c("Save", "บันทึก")}
          </button>
          {state?.ok && (
            <span className="rounded-full bg-brand-cyan-soft px-3 py-1 text-sm font-semibold text-ink-stage">
              {c("Saved", "บันทึกแล้ว")}
            </span>
          )}
          {state && !state.ok && (
            <span className="text-sm font-medium text-red-600">{state.error}</span>
          )}
        </div>
      </form>
    </Card>
  );
}
