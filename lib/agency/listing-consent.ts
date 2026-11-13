// Optional consent on /join to a public profile on brightears.io. The roster is a
// catalogue buyers choose from; an applicant is listed only after ticking this
// box and checking the profile Bright Ears sends them.
//
// Changing any consent wording here means a new version: stored answers keep the version
// the applicant actually saw. The Thai still needs a native read (team/web).
// v1 (13 Nov 2026, never released): public profile only.
// v2 (13 Nov 2026): also shown to Bright Ears clients; fees excluded.
export const LISTING_CONSENT_VERSION = "listing-v2-2026-11-13";

export const LISTING_CONSENT_TEXT = {
  en: "Optional: I agree that Bright Ears may show a profile of my act to its clients and publish it on brightears.io, using the act name, bio, photo and links I sent with this form, never my fees. Bright Ears sends me the profile to check before it goes live and removes it if I ask at info@brightears.io.",
  th: "ไม่บังคับ: ข้าพเจ้ายินยอมให้ Bright Ears นำโปรไฟล์การแสดงของข้าพเจ้าไปเสนอให้ลูกค้า และเผยแพร่บน brightears.io โดยใช้ชื่อการแสดง ประวัติ รูปภาพ และลิงก์ที่ข้าพเจ้าส่งมากับแบบฟอร์มนี้ โดยไม่รวมค่าตัว Bright Ears จะส่งโปรไฟล์ให้ข้าพเจ้าตรวจสอบก่อนเผยแพร่ และจะลบออกเมื่อข้าพเจ้าขอทางอีเมล info@brightears.io",
} as const;

/** The sentence in the required data consent that says what is published. */
export const PUBLISHING_SENTENCE = {
  en: "Bright Ears does not publish this form or share it outside Bright Ears without asking me first. If I tick the profile box below, Bright Ears sends me my profile to check before it goes live.",
  th: "Bright Ears จะไม่เผยแพร่แบบฟอร์มนี้หรือส่งต่อให้บุคคลภายนอก Bright Ears โดยไม่ถามข้าพเจ้าก่อน หากข้าพเจ้าเลือกช่องโปรไฟล์ด้านล่าง Bright Ears จะส่งโปรไฟล์ให้ข้าพเจ้าตรวจสอบก่อนเผยแพร่",
} as const;
