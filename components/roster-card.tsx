import { addPerformer, setPerformerActive, updatePerformer } from "@/app/actions/performers";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import type { Performer, PerformerKind } from "@/app/generated/prisma/client";
import type { Locale } from "@/lib/i18n/config";

// Roster (P13.1) — Studio's multi-performer claim, restored honestly. Server
// component: plain forms bound to tenant-scoped actions; the plan's
// rosterCap renders as honest signage AND is re-enforced at save.

const KIND_OPTIONS: { value: PerformerKind; label: string }[] = [
  { value: "DJ", label: "DJ" },
  { value: "BAND", label: "Band" },
  { value: "SINGER", label: "Singer" },
  { value: "MUSICIAN", label: "Musician" },
  { value: "MAGICIAN", label: "Magician" },
  { value: "DANCER", label: "Dancer" },
  { value: "MC", label: "MC / host" },
  { value: "COMEDIAN", label: "Comedian" },
  { value: "PHOTO_BOOTH", label: "Photo booth" },
  { value: "OTHER", label: "Other" },
];

const inputCls =
  "rounded-xl border border-ink-stage/15 bg-white px-3 py-2 text-base sm:text-sm text-ink-stage focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40";

export function RosterCard({
  performers,
  rosterCap,
  locale = "en",
}: {
  performers: Performer[];
  rosterCap: number;
  locale?: Locale;
}) {
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const active = performers.filter((p) => p.active);
  const inactive = performers.filter((p) => !p.active);
  const capReached = active.length >= rosterCap;

  return (
    <Card className="p-6">
      <h3 className="mb-1">
        <Kicker onLight>{c("Roster", "รายชื่อผู้แสดง")}</Kicker>
      </h3>
      <p className="mb-4 text-sm text-ink-stage/60">
        {c("Who performs under this act. Gigs tag a performer, and availability is checked per performer — ", "ผู้ที่แสดงภายใต้ชื่อนี้ งานแต่ละงานจะระบุผู้แสดงและตรวจวันว่างแยกกัน — ")}{rosterCap === 1
          ? c("your plan covers one performer; Studio adds the roster.", "แผนของคุณรองรับผู้แสดง 1 คน และ Studio รองรับหลายคน")
          : c(`your plan covers up to ${rosterCap} active performers.`, `แผนของคุณรองรับผู้แสดงที่เปิดใช้งานได้สูงสุด ${rosterCap} คน`)}
      </p>

      {performers.length > 0 && (
        <ul className="mb-5 space-y-3">
          {[...active, ...inactive].map((p) => (
            <li key={p.id} className={p.active ? "" : "opacity-55"}>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await updatePerformer(p.id, formData);
                }}
                className="flex flex-wrap items-center gap-2.5"
              >
                <input
                  name="name"
                  defaultValue={p.name}
                  maxLength={80}
                  required
                  aria-label={c("Performer name", "ชื่อผู้แสดง")}
                  className={`${inputCls} w-44`}
                />
                <select name="kind" defaultValue={p.kind} aria-label={c("Performer kind", "ประเภทผู้แสดง")} className={inputCls}>
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {locale === "th" ? ({ DJ: "ดีเจ", BAND: "วงดนตรี", SINGER: "นักร้อง", MUSICIAN: "นักดนตรี", MAGICIAN: "นักมายากล", DANCER: "นักเต้น", MC: "พิธีกร", COMEDIAN: "นักแสดงตลก", PHOTO_BOOTH: "โฟโต้บูธ", OTHER: "อื่น ๆ" } as const)[k.value] : k.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm`}>
                  {c("Save", "บันทึก")}
                </button>
                <button
                  type="submit"
                  formAction={async () => {
                    "use server";
                    await setPerformerActive(p.id, !p.active);
                  }}
                  className="text-sm font-semibold text-ink-stage/45 transition-colors hover:text-ink-stage/70"
                >
                  {p.active ? c("Deactivate", "ปิดใช้งาน") : c("Reactivate", "เปิดใช้อีกครั้ง")}
                </button>
                {!p.active && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/40">
                    {c("Inactive — history kept", "ปิดใช้งาน — เก็บประวัติไว้")}
                  </span>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}

      {capReached ? (
        rosterCap === 1 && (
          <p className="text-xs text-ink-stage/55">
            {c("Running more than one performer?", "มีผู้แสดงมากกว่าหนึ่งคนใช่ไหม")}{" "}
            <a href="#billing" className="font-semibold text-brand-cyan hover:opacity-80">
              Studio
            </a>{" "}
            {c("routes inquiries across a roster.", "ช่วยจัดสรรข้อความสอบถามให้ผู้แสดงแต่ละคน")}
          </p>
        )
      ) : (
        <form
          action={async (formData: FormData) => {
            "use server";
            await addPerformer(formData);
          }}
          className="flex flex-wrap items-center gap-2.5 border-t border-ink-stage/10 pt-4"
        >
          <input
            name="name"
            placeholder={c("Performer name", "ชื่อผู้แสดง")}
            maxLength={80}
            required
            aria-label={c("New performer name", "ชื่อผู้แสดงใหม่")}
            className={`${inputCls} w-44`}
          />
          <select name="kind" aria-label={c("New performer kind", "ประเภทผู้แสดงใหม่")} className={inputCls}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {locale === "th" ? ({ DJ: "ดีเจ", BAND: "วงดนตรี", SINGER: "นักร้อง", MUSICIAN: "นักดนตรี", MAGICIAN: "นักมายากล", DANCER: "นักเต้น", MC: "พิธีกร", COMEDIAN: "นักแสดงตลก", PHOTO_BOOTH: "โฟโต้บูธ", OTHER: "อื่น ๆ" } as const)[k.value] : k.label}
              </option>
            ))}
          </select>
          <button type="submit" className={`${buttonStyles.primary} px-4 py-2 text-sm`}>
            {c("Add performer", "เพิ่มผู้แสดง")}
          </button>
        </form>
      )}
    </Card>
  );
}
