"use client";

import { useActionState } from "react";
import { createGig } from "@/app/actions/gigs";
import { buttonStyles } from "@/components/ui";
import { StickerChip } from "@/components/collage";
import { useI18n } from "@/components/locale-provider";

type ActionResult = { ok: boolean; error?: string } | null;

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputStyles =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelStyles = "block text-xs font-semibold text-ink-stage/60 uppercase tracking-wide mb-1";

export function GigForm({ performers }: { performers: { id: string; name: string }[] }) {
  const { locale, t } = useI18n();
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(
    (_prev, formData) => createGig(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="gig-date" className={labelStyles}>{t("dashboard.gig.date")}</label>
        <input id="gig-date" name="date" type="date" required className={inputStyles} />
      </div>

      <div>
        <label htmlFor="gig-title" className={labelStyles}>{t("dashboard.gig.title")}</label>
        <input
          id="gig-title"
          name="title"
          type="text"
          required
          placeholder={locale === "th" ? "งานแต่งคุณณัฐ" : "Nguyen wedding"}
          className={inputStyles}
        />
      </div>

      <div>
        <label htmlFor="gig-venue" className={labelStyles}>{t("dashboard.gig.venue")}</label>
        <input
          id="gig-venue"
          name="venue"
          type="text"
          placeholder={locale === "th" ? "โรงแรมริมแม่น้ำ" : "Lakeside Manor"}
          className={inputStyles}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="gig-start" className={labelStyles}>{t("dashboard.gig.start")}</label>
          <input id="gig-start" name="startTime" type="time" className={inputStyles} />
        </div>
        <div>
          <label htmlFor="gig-end" className={labelStyles}>{t("dashboard.gig.end")}</label>
          <input id="gig-end" name="endTime" type="time" className={inputStyles} />
        </div>
      </div>

      <div>
        <label htmlFor="gig-performer" className={labelStyles}>{t("dashboard.gig.performer")}</label>
        <select id="gig-performer" name="performerId" defaultValue="" className={inputStyles}>
          <option value="">{t("dashboard.gig.unassigned")}</option>
          {performers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
        {pending ? t("dashboard.gig.adding") : t("dashboard.gig.add")}
      </button>

      {result && !result.ok && <p className="text-xs text-red-600">{result.error}</p>}
      {result?.ok && (
        // Tiny show-voice celebration — the sanctioned sticker chip (docs/DESIGN.md).
        <p>
          <StickerChip tone="magenta" rotate={-2}>
            {t("dashboard.gig.added")}
          </StickerChip>
        </p>
      )}
    </form>
  );
}
