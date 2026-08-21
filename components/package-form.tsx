"use client";

import { useActionState, useState } from "react";
import { createPackage, updatePackage } from "@/app/actions/packages";
import { buttonStyles } from "@/components/ui";
import { StickerChip } from "@/components/collage";
import { useI18n } from "@/components/locale-provider";

type ActionResult = { ok: boolean; error?: string } | null;

export interface PackageFormInitial {
  id: string;
  name: string;
  description: string;
  priceMinDollars: number;
  priceMaxDollars: number | null;
  eventTypes: string[];
  active: boolean;
}

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputStyles =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelStyles = "block text-xs font-semibold text-ink-stage/60 uppercase tracking-wide mb-1";

/**
 * Add mode (no `initial`): always-open form that creates a package.
 * Edit mode (`initial` set): collapsed behind an "Edit" button; saves via
 * updatePackage and folds shut on success.
 */
export function PackageForm({
  initial,
  currency = "USD",
}: {
  initial?: PackageFormInitial;
  // The artist's fee currency (Business.currency) — a Thai DJ prices in THB,
  // so the labels must never hardcode "$".
  currency?: string;
}) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const [open, setOpen] = useState(!initial);
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => {
      if (!initial) return createPackage(formData);
      const res = await updatePackage(formData);
      if (res.ok) setOpen(false);
      return res;
    },
    null,
  );

  if (initial && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonStyles.secondaryOnLight} text-sm px-3 py-1.5`}>
        {c("Edit", "แก้ไข")}
      </button>
    );
  }

  const uid = initial?.id ?? "new";

  return (
    <form action={formAction} className="space-y-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <label htmlFor={`pkg-name-${uid}`} className={labelStyles}>{c("Name", "ชื่อแพ็กเกจ")}</label>
        <input
          id={`pkg-name-${uid}`}
          name="name"
          type="text"
          required
          defaultValue={initial?.name}
          placeholder={c("6-hour wedding package", "แพ็กเกจงานแต่ง 6 ชั่วโมง")}
          className={inputStyles}
        />
      </div>

      <div>
        <label htmlFor={`pkg-desc-${uid}`} className={labelStyles}>{c("Description", "รายละเอียด")}</label>
        <textarea
          id={`pkg-desc-${uid}`}
          name="description"
          rows={3}
          defaultValue={initial?.description}
          placeholder={c("What's included — hours, gear, extras. The AI quotes from this.", "ระบุสิ่งที่รวมอยู่ เช่น จำนวนชั่วโมง อุปกรณ์ และบริการเสริม ผู้ช่วยจะใช้อ้างอิงราคา")}
          className={inputStyles}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`pkg-min-${uid}`} className={labelStyles}>{c("Price from", "ราคาเริ่มต้น")} ({currency})</label>
          <input
            id={`pkg-min-${uid}`}
            name="priceMin"
            type="number"
            required
            min={0}
            step="0.01"
            defaultValue={initial?.priceMinDollars}
            placeholder="1800"
            className={inputStyles}
          />
        </div>
        <div>
          <label htmlFor={`pkg-max-${uid}`} className={labelStyles}>{c("To", "ถึง")} ({currency})</label>
          <input
            id={`pkg-max-${uid}`}
            name="priceMax"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial?.priceMaxDollars ?? ""}
            placeholder="2200"
            className={inputStyles}
          />
        </div>
      </div>
      {/* One hint line under the row (founder preview: the long label wrapped
          and knocked the inputs out of line). */}
      <p className="-mt-2 text-xs text-ink-stage/50">{c("Leave “To” blank for a fixed price.", "หากเป็นราคาเดียว ให้เว้นช่อง “ถึง” ว่างไว้")}</p>

      <div>
        <label htmlFor={`pkg-types-${uid}`} className={labelStyles}>{c("Event types (comma-separated)", "ประเภทงาน (คั่นด้วยจุลภาค)")}</label>
        <input
          id={`pkg-types-${uid}`}
          name="eventTypes"
          type="text"
          defaultValue={initial?.eventTypes.join(", ")}
          placeholder={c("wedding, corporate, birthday", "งานแต่ง, งานบริษัท, วันเกิด")}
          className={inputStyles}
        />
      </div>

      {initial && (
        <label className="flex items-center gap-2 text-sm text-ink-stage/80">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial.active}
            className="size-4 accent-brand-cyan"
          />
          {c("Active (the AI can quote this package)", "เปิดใช้งาน (ผู้ช่วยเสนอราคาแพ็กเกจนี้ได้)")}
        </label>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={`${buttonStyles.primary} flex-1`}>
          {pending ? c("Saving…", "กำลังบันทึก…") : initial ? c("Save changes", "บันทึกการแก้ไข") : c("Add package", "เพิ่มแพ็กเกจ")}
        </button>
        {initial && (
          <button type="button" onClick={() => setOpen(false)} className={buttonStyles.secondaryOnLight}>
            {c("Cancel", "ยกเลิก")}
          </button>
        )}
      </div>

      {result && !result.ok && <p className="text-xs text-red-600">{result.error}</p>}
      {!initial && result?.ok && (
        // Tiny show-voice celebration — the sanctioned sticker chip (docs/DESIGN.md).
        <p>
          <StickerChip tone="magenta" rotate={-2}>
            {c("Package added", "เพิ่มแพ็กเกจแล้ว")}
          </StickerChip>
        </p>
      )}
    </form>
  );
}
