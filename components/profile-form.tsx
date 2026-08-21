"use client";

// Artist-profile editor (Phase 10.1) — the ammunition the sales agent pitches
// with. One form, sectioned into white Cards with editorial Kickers (DESIGN.md
// v2.1 rule 2). Tag inputs are comma-separated text, split server-side (v1).
import { useActionState, useState } from "react";
import { updateArtistProfile } from "@/app/actions/profile";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import { PhotoUploader } from "@/components/photo-uploader";
import { useI18n } from "@/components/locale-provider";

export type ArtistProfile = {
  headline: string | null;
  bio: string | null;
  genres: string[];
  eventTypes: string[];
  pitchLanguages: string[];
  videoLinks: string[];
  photoUrls: string[];
  socialLinks: string[];
  riderNotes: string | null;
  reviewQuotes: string[];
  notableVenues: string[];
  travelPolicy: string | null;
  feeFloor: number | null;
  feeSweetSpot: number | null;
  gigTypes: string[];
  acceptsTravel: boolean;
  residencyRate: number | null;
  residencyRateUnit: string;
  oneOffHours: number | null;
  epkEnabled: boolean;
  currency: string;
};

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputCls =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-stage/60 mb-1";
const hintCls = "mt-1 text-xs text-ink-stage/45";

const cents = (v: number | null) => (v === null ? "" : String(v / 100));

export function ProfileForm({
  profile,
  uploadsEnabled,
}: {
  profile: ArtistProfile;
  uploadsEnabled: boolean;
}) {
  const { locale, t } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateArtistProfile(formData),
    null,
  );
  // When uploads are on, photos are managed by the uploader and submitted via a
  // hidden field; otherwise the textarea (paste URLs) carries them.
  const [photoUrls, setPhotoUrls] = useState(profile.photoUrls);

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-5">
          <Kicker onLight>{t("onboarding.step.basics")}</Kicker>
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="headline" className={labelCls}>
              {c("Headline", "คำแนะนำตัว")}
            </label>
            <input
              id="headline"
              name="headline"
              maxLength={80}
              placeholder="High-energy act for rooms that want a full dance floor"
              defaultValue={profile.headline ?? ""}
              className={inputCls}
            />
            <p className={hintCls}>{c("One line, under 80 characters — it's what a venue reads first.", "หนึ่งประโยคไม่เกิน 80 ตัวอักษร เป็นข้อความแรกที่สถานที่จะเห็น")}</p>
          </div>
          <div>
            <label htmlFor="bio" className={labelCls}>
              {t("onboarding.profile.bio")}
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={5}
              placeholder="40-120 words, in your voice. Who you are, what a night with you sounds like, why rooms rebook you."
              defaultValue={profile.bio ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-5">
          <Kicker onLight>{c("Your act", "งานแสดงของคุณ")}</Kicker>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="genres" className={labelCls}>
              {c("Genres & vibe", "แนวเพลงและบรรยากาศ")}
            </label>
            <input
              id="genres"
              name="genres"
              placeholder="house, disco, open format, motown"
              defaultValue={profile.genres.join(", ")}
              className={inputCls}
            />
            <p className={hintCls}>{c("Comma-separated, 5–10 tags. How the agent matches you to venues.", "ใส่ 5–10 คำ คั่นด้วยเครื่องหมายจุลภาค เพื่อช่วยจับคู่คุณกับสถานที่")}</p>
          </div>
          <div>
            <label htmlFor="eventTypes" className={labelCls}>
              {c("Event types", "ประเภทงาน")}
            </label>
            <input
              id="eventTypes"
              name="eventTypes"
              placeholder="weddings, corporate, club nights, private parties"
              defaultValue={profile.eventTypes.join(", ")}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pitchLanguages" className={labelCls}>
              {c("Pitch languages", "ภาษาสำหรับติดต่อสถานที่")}
            </label>
            <input
              id="pitchLanguages"
              name="pitchLanguages"
              placeholder="en, th"
              defaultValue={profile.pitchLanguages.join(", ")}
              className={inputCls}
            />
            <p className={hintCls}>{c("Language codes the agent may pitch in. Defaults to en.", "รหัสภาษาที่ผู้ช่วยใช้ได้ เช่น th, en")}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-5">
          <Kicker onLight>{c("Proof", "หลักฐานผลงาน")}</Kicker>
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="videoLinks" className={labelCls}>
              {c("Performance videos (optional)", "วิดีโอการแสดง (ไม่บังคับ)")}
            </label>
            <textarea
              id="videoLinks"
              name="videoLinks"
              rows={2}
              placeholder={"https://youtube.com/watch?v=...\nhttps://vimeo.com/..."}
              defaultValue={profile.videoLinks.join("\n")}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
            <p className={hintCls}>
              {c("Add a YouTube or Vimeo link if you have one. The first one headlines your press kit.", "เพิ่มลิงก์ YouTube หรือ Vimeo หากมี ลิงก์แรกจะแสดงเด่นในเพรสคิต")}
            </p>
          </div>
          <div>
            <label htmlFor="photoUrls" className={labelCls}>
              {c("Photos", "รูปภาพ")}
            </label>
            {uploadsEnabled ? (
              <>
                <PhotoUploader
                  value={photoUrls}
                  onAdd={(u) => setPhotoUrls((p) => [...p, u])}
                  onRemove={(u) => setPhotoUrls((p) => p.filter((x) => x !== u))}
                />
                <input type="hidden" name="photoUrls" value={photoUrls.join("\n")} />
                <p className={hintCls}>{c("A great action shot wins bookings — add a few, your best first.", "รูปขณะแสดงงานช่วยให้ได้งาน เพิ่มหลายรูปและวางรูปที่ดีที่สุดไว้ก่อน")}</p>
              </>
            ) : (
              <>
                <textarea
                  id="photoUrls"
                  name="photoUrls"
                  rows={4}
                  placeholder={"https://...jpg — one image URL per line"}
                  defaultValue={profile.photoUrls.join("\n")}
                  className={`${inputCls} font-mono text-xs leading-relaxed`}
                />
                <p className={hintCls}>
                  Paste direct image URLs (your site, Google Photos share, Dropbox) — at least 3. Uploads come later.
                </p>
              </>
            )}
          </div>
          <div>
            <label htmlFor="socialLinks" className={labelCls}>
              {t("onboarding.profile.socialLinks")}
            </label>
            <textarea
              id="socialLinks"
              name="socialLinks"
              rows={3}
              placeholder={"https://instagram.com/...\nhttps://soundcloud.com/...\nhttps://open.spotify.com/artist/..."}
              defaultValue={profile.socialLinks.join("\n")}
              className={`${inputCls} font-mono text-xs leading-relaxed`}
            />
            <p className={hintCls}>
              {c("Instagram, TikTok, X, SoundCloud, Mixcloud, Spotify, YouTube — one link per line. They show on your press kit.", "Instagram, TikTok, X, SoundCloud, Mixcloud, Spotify หรือ YouTube หนึ่งลิงก์ต่อบรรทัด และจะแสดงในเพรสคิต")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reviewQuotes" className={labelCls}>
                {c("Client quotes", "คำรีวิวจากลูกค้า")}
              </label>
              <textarea
                id="reviewQuotes"
                name="reviewQuotes"
                rows={3}
                placeholder={"Best decision of our wedding.\nThe floor never emptied."}
                defaultValue={profile.reviewQuotes.join("\n")}
                className={inputCls}
              />
              <p className={hintCls}>{c("1–3 short quotes, one per line.", "คำรีวิวสั้น ๆ 1–3 ข้อความ หนึ่งข้อความต่อบรรทัด")}</p>
            </div>
            <div>
              <label htmlFor="notableVenues" className={labelCls}>
                {c("Notable venues", "สถานที่เด่นที่เคยแสดง")}
              </label>
              <input
                id="notableVenues"
                name="notableVenues"
                placeholder="The Driskill, Hotel Van Zandt"
                defaultValue={profile.notableVenues.join(", ")}
                className={inputCls}
              />
              <p className={hintCls}>{c("Bookers recognize rooms, not bios.", "ชื่อสถานที่ช่วยให้ผู้จ้างเห็นประสบการณ์ของคุณได้เร็ว")}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2">
          <Kicker onLight>{c("Rate & reach", "เรตและพื้นที่รับงาน")}</Kicker>
        </h3>
        <p className={`${hintCls} mb-5`}>
          {c("The cities you're based in are set in ", "เมืองหลักของคุณตั้งค่าได้ใน ")}
          <a href="#hunt" className="font-semibold text-brand-cyan hover:opacity-80">
            {t("settings.control.hunt")}
          </a>
          .
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <span className={labelCls}>{t("onboarding.profile.workTypes")}</span>
            <div className="flex flex-wrap gap-2.5">
              <label className="flex items-center gap-2 rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  name="gigTypes"
                  value="one-off"
                  defaultChecked={profile.gigTypes.includes("one-off")}
                  className="size-4 accent-brand-cyan"
                />
                {t("onboarding.profile.oneOff")}
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  name="gigTypes"
                  value="residency"
                  defaultChecked={profile.gigTypes.includes("residency")}
                  className="size-4 accent-brand-cyan"
                />
                {t("onboarding.profile.residencies")}
              </label>
            </div>
            <p className={hintCls}>
              {c("Most artists do both — a one-off party and a regular weekly slot price differently.", "ศิลปินส่วนใหญ่รับทั้งสองแบบ โดยงานครั้งเดียวและงานประจำมักใช้เรตต่างกัน")}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="travelPolicy" className={labelCls}>
              {c("Travel policy", "เงื่อนไขการเดินทาง")}
            </label>
            <input
              id="travelPolicy"
              name="travelPolicy"
              placeholder="Within 100 miles included; beyond that, travel at cost."
              defaultValue={profile.travelPolicy ?? ""}
              className={inputCls}
            />
            <label className="mt-2.5 flex items-center gap-2.5 text-sm text-ink-stage/80">
              <input
                type="checkbox"
                name="acceptsTravel"
                defaultChecked={profile.acceptsTravel}
                className="size-4 accent-brand-cyan"
              />
              {t("onboarding.profile.acceptsTravel")}
            </label>
            <p className={hintCls}>
              {c("When on, the agent surfaces strong rooms outside your service cities too.", "เมื่อเปิด ผู้ช่วยจะแนะนำสถานที่ที่เหมาะนอกเมืองหลักด้วย")}
            </p>
          </div>
          <div>
            <label htmlFor="feeFloor" className={labelCls}>
              {c(`One-off floor (${profile.currency})`, `ค่าจ้างขั้นต่ำสำหรับงานครั้งเดียว (${profile.currency})`)}
            </label>
            <input
              id="feeFloor"
              name="feeFloor"
              inputMode="numeric"
              placeholder="1200"
              defaultValue={cents(profile.feeFloor)}
              className={inputCls}
            />
            <p className={hintCls}>{c(`The agent never pitches a one-off below this. Whole ${profile.currency}.`, `ผู้ช่วยจะไม่เสนอค่าจ้างต่ำกว่านี้ ระบุเป็นหน่วย ${profile.currency}`)}</p>
            <div className="mt-2">
              <label htmlFor="oneOffHours" className={labelCls}>
                {c("Covers up to (hours)", "ครอบคลุมไม่เกิน (ชั่วโมง)")}
              </label>
              <input
                id="oneOffHours"
                name="oneOffHours"
                inputMode="numeric"
                placeholder="4"
                defaultValue={profile.oneOffHours ?? ""}
                className={inputCls}
              />
              <p className={hintCls}>
                {c("What the one-off price includes, e.g. 4 hours — quotes say it clearly.", "ระบุว่าราคางานครั้งเดียวครอบคลุมกี่ชั่วโมง เพื่อให้ใบเสนอราคาชัดเจน")}
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="feeSweetSpot" className={labelCls}>
              {c(`Sweet spot (${profile.currency})`, `เรตเป้าหมาย (${profile.currency})`)}
            </label>
            <input
              id="feeSweetSpot"
              name="feeSweetSpot"
              inputMode="numeric"
              placeholder="1800"
              defaultValue={cents(profile.feeSweetSpot)}
              className={inputCls}
            />
            <p className={hintCls}>{c("The fee the agent aims for.", "ค่าจ้างที่ผู้ช่วยจะพยายามเสนอ")}</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="residencyRate" className={labelCls}>
              {t("onboarding.profile.residencyRate", { currency: profile.currency })}
            </label>
            <div className="flex gap-2">
              <input
                id="residencyRate"
                name="residencyRate"
                inputMode="numeric"
                placeholder="800"
                defaultValue={cents(profile.residencyRate)}
                className={`${inputCls} min-w-0 flex-1`}
              />
              <select
                name="residencyRateUnit"
                aria-label={t("onboarding.profile.rateUnit")}
                defaultValue={profile.residencyRateUnit ?? "night"}
                className="flex-none rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors"
              >
                <option value="night">{t("onboarding.profile.perNight")}</option>
                <option value="hour">{t("onboarding.profile.perHour")}</option>
              </select>
            </div>
            <p className={hintCls}>
              {t("onboarding.profile.residencyHint")}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="riderNotes" className={labelCls}>
              {c("How you perform & what you need", "รูปแบบการแสดงและสิ่งที่ต้องเตรียม")}
            </label>
            <textarea
              id="riderNotes"
              name="riderNotes"
              rows={4}
              placeholder={"How your set works and what the venue provides — space, power, sound, setup time, what you bring, what's included."}
              defaultValue={profile.riderNotes ?? ""}
              className={inputCls}
            />
            <p className={hintCls}>
              {t("onboarding.profile.riderHint")}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2.5 text-sm text-ink-stage/80">
              <input
                type="checkbox"
                name="epkEnabled"
                defaultChecked={profile.epkEnabled}
                className="size-4 accent-brand-cyan"
              />
              {c("Keep my press kit page live", "เปิดหน้าเพรสคิตของฉันไว้")}
            </label>
            <p className={hintCls}>
              {c("Your hosted one-page press kit — every pitch the agent sends links to it.", "เพรสคิตออนไลน์หนึ่งหน้าของคุณ ทุกข้อความแนะนำตัวจะมีลิงก์ไปที่หน้านี้")}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? t("common.saving") : c("Save profile", "บันทึกโปรไฟล์")}
        </button>
        {state?.ok && (
          <span className="rounded-full bg-brand-cyan-soft px-3 py-1 text-sm font-semibold text-ink-stage">
            {t("settings.saved")}
          </span>
        )}
        {state && !state.ok && (
          <span className="text-sm font-medium text-red-400">{state.error}</span>
        )}
      </div>
    </form>
  );
}
