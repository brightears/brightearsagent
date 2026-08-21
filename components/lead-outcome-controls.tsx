"use client";

// Always-on lead outcome controls (audit C1). "Mark booked" / "Mark dead" also
// live inside DraftReview, but that panel only renders when a PENDING draft
// exists — so a lead with no pending draft (REPLIED, IN_SEQUENCE, ENGAGED, NEW…)
// had NO way to record the core booked-or-dead outcome from the app, leaving the
// pipeline's BOOKED/DEAD columns and the weekly "booked" stat unreachable. This
// renders on the lead detail page for any non-terminal lead without a draft.
//
// Styled for the ink canvas (cream-on-ink), unlike DraftReview which sits on a
// cream panel.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markBooked, markDead, draftReplyForLead } from "@/app/actions/drafts";
import { buttonStyles } from "@/components/ui";
import { parseFeeToMinor } from "@/lib/quote/fee";
import { useI18n } from "@/components/locale-provider";

const bookedButtonStyle =
  "rounded-full border-[1.5px] border-cream/30 text-cream/85 font-semibold px-4 py-2 transition-all hover:border-transparent hover:bg-gradient-to-r hover:from-neon-magenta hover:to-neon-orange hover:text-ink-stage disabled:opacity-40";

const deadButtonStyle =
  "rounded-full border border-red-400/40 text-red-300 font-semibold px-4 py-2 transition-colors hover:bg-red-500/10 disabled:opacity-40";

type ActionResult = { ok: boolean; error?: string; confirmationDrafted?: boolean };
type Note = { kind: "success" | "error"; text: string };

export function LeadOutcomeControls({
  leadId,
  feeCurrency = "USD",
  suggestedFeeMinor = null,
}: {
  leadId: string;
  /** 11.1 fee capture: the artist's currency + a grounded prefill (quote). */
  feeCurrency?: string;
  suggestedFeeMinor?: number | null;
}) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const [done, setDone] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [fee, setFee] = useState(
    suggestedFeeMinor != null ? String(suggestedFeeMinor / 100) : "",
  );
  const busy = isPending || done;

  const run = (action: () => Promise<ActionResult>, text: string) =>
    startTransition(async () => {
      setNote(null);
      const result = await action();
      if (!result.ok) {
        setNote({ kind: "error", text: result.error ?? c("Something went wrong — try again.", "เกิดข้อผิดพลาด โปรดลองอีกครั้ง") });
        return;
      }
      setNote({ kind: "success", text });
      setDone(true);
      setTimeout(() => router.refresh(), 1500);
    });

  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-raised p-5">
      {note && (
        <p
          className={`mb-3 rounded-xl px-3 py-2 text-sm font-medium ${
            note.kind === "success" ? "bg-brand-cyan-soft text-ink-stage" : "bg-red-500/15 text-red-300"
          }`}
        >
          {note.text}
        </p>
      )}

      {/* Draft a reply (audit C1-NF): when a prospect has replied (ENGAGED) the
          sequence stops with no new draft — let the owner generate one in-app
          instead of leaving the thread. Also retries a failed auto-draft. */}
      <p className="mb-2 text-xs text-cream/60">
        {c("Want to write back? Draft a reply in your voice — you approve it before it sends.", "ต้องการตอบกลับใช่ไหม ให้ผู้ช่วยร่างด้วยน้ำเสียงของคุณ และคุณอนุมัติก่อนส่ง")}
      </p>
      <button
        type="button"
        onClick={() =>
          run(() => draftReplyForLead(leadId), c("Draft ready below — review and send.", "ร่างพร้อมแล้วด้านล่าง โปรดตรวจและส่ง"))
        }
        disabled={busy}
        className={`${buttonStyles.primary} mb-5`}
      >
        {isPending ? c("Drafting…", "กำลังร่าง…") : c("Draft a reply", "ร่างข้อความตอบ")}
      </button>

      <p className="mb-3 border-t border-cream/10 pt-4 text-xs text-cream/60">
        {c("Settled this one outside the thread? Set the outcome — follow-ups stop instantly.", "ตกลงงานกันนอกบทสนทนานี้ใช่ไหม บันทึกผลลัพธ์แล้วระบบจะหยุดติดตามทันที")}
      </p>
      {bookingOpen ? (
        <div className="space-y-2">
          <label
            htmlFor="outcome-fee"
            className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cream/55"
          >
            {c("Fee — optional, stays private", "ค่าจ้าง — ไม่บังคับและเก็บเป็นส่วนตัว")} ({feeCurrency})
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="outcome-fee"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              disabled={busy}
              placeholder="e.g. 15000"
              className="w-36 rounded-xl border border-cream/20 bg-ink-stage px-3 py-2 text-base sm:text-sm text-cream-bright focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() =>
                run(
                  () => markBooked(leadId, parseFeeToMinor(fee) ?? undefined),
                  c("Marked booked — follow-ups stopped; if a confirmation email was drafted it appears below for your approval.", "บันทึกว่าจองงานแล้วและหยุดการติดตาม หากระบบร่างอีเมลยืนยันไว้ ร่างจะปรากฏด้านล่างให้คุณอนุมัติ"),
                )
              }
              disabled={busy}
              className={bookedButtonStyle}
            >
              {c("Confirm booked", "ยืนยันว่าจองงานแล้ว")}
            </button>
            <button
              type="button"
              onClick={() => setBookingOpen(false)}
              disabled={busy}
              className="text-sm font-semibold text-cream/45 transition-colors hover:text-cream/70"
            >
              {c("Cancel", "ยกเลิก")}
            </button>
          </div>
          <p className="text-[11px] text-cream/45">
            {c("Powers your booked-value receipts — the client never sees it.", "ใช้คำนวณมูลค่างานที่จอง ลูกค้าจะไม่เห็นข้อมูลนี้")}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            disabled={busy}
            className={bookedButtonStyle}
          >
            {c("Mark booked", "บันทึกว่าจองงานแล้ว")}
          </button>
          <button
            type="button"
            onClick={() => run(() => markDead(leadId), c("Marked dead — all follow-ups stopped.", "บันทึกว่าไม่สำเร็จและหยุดการติดตามทั้งหมดแล้ว"))}
            disabled={busy}
            className={deadButtonStyle}
          >
            {c("Mark dead", "บันทึกว่าไม่สำเร็จ")}
          </button>
        </div>
      )}
    </div>
  );
}
