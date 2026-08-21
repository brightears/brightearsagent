"use client";

import { useI18n } from "@/components/locale-provider";

/**
 * Legal copy is intentionally not machine-translated. The English text is the
 * reviewed, controlling version until qualified Thai counsel approves a Thai
 * legal translation. Thai readers get a prominent explanation instead of an
 * unofficial translation presented as binding law.
 */
export function LegalLanguageNotice() {
  const { locale } = useI18n();
  if (locale !== "th") return null;

  return (
    <div role="note" className="mb-8 rounded-2xl border border-[#ffdfba] bg-[#ffdfba]/60 px-5 py-4 text-ink-stage">
      <p className="font-semibold">หมายเหตุเกี่ยวกับภาษา</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-stage/75">
        เอกสารกฎหมายด้านล่างแสดงเป็นภาษาอังกฤษ ซึ่งเป็นฉบับที่ผ่านการตรวจสอบและมีผลใช้บังคับ
        Bright Ears จะเพิ่มฉบับภาษาไทยเมื่อได้รับการตรวจทานจากผู้เชี่ยวชาญด้านกฎหมายแล้ว
      </p>
    </div>
  );
}
