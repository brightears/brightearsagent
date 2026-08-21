import { saveVenueNotesForm } from "@/app/actions/venues";
import type { Locale } from "@/lib/i18n/config";

/**
 * Private field notes on a venue card (P12.4 residency play kit): names met,
 * visits, what the room was like on a Friday. The residency game is played
 * in person over months — the card is where that memory should live. Never
 * leaves the dashboard, never enters a pitch. Native <details>, no JS.
 */
export function VenueNotes({ venueId, notes, locale = "en" }: { venueId: string; notes: string | null; locale?: Locale }) {
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  return (
    <details className="mt-3 border-t border-ink-stage/10 pt-2">
      <summary className="cursor-pointer list-none font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45 transition-colors hover:text-brand-cyan [&::-webkit-details-marker]:hidden">
        {c("Your notes", "บันทึกของคุณ")}{notes ? " ·" : ""} {notes ? notes.slice(0, 40) + (notes.length > 40 ? "…" : "") : ""}
      </summary>
      <form action={saveVenueNotesForm.bind(null, venueId)} className="mt-2 space-y-2">
        <textarea
          name="staffNotes"
          defaultValue={notes ?? ""}
          rows={3}
          maxLength={2000}
          placeholder={c("Names met, visits, what the room was like — private, never sent anywhere.", "ชื่อคนที่พบ วันที่ไปเยี่ยม หรือบรรยากาศของสถานที่ เป็นข้อมูลส่วนตัวและจะไม่ถูกส่งออกไป")}
          className="w-full rounded-xl border border-ink-stage/15 bg-white p-2.5 text-base sm:text-sm leading-relaxed text-ink-stage placeholder:text-ink-stage/35 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40"
        />
        <button
          type="submit"
          className="rounded-full border-[1.5px] border-ink-stage/25 px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-stage/70 transition-colors hover:border-brand-cyan hover:text-brand-cyan"
        >
          {c("Save notes", "บันทึกโน้ต")}
        </button>
      </form>
    </details>
  );
}
