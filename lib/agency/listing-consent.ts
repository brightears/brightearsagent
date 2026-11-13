// Optional consent on /join to a public profile on brightears.io. The roster is a
// catalogue buyers choose from; an applicant is listed only after ticking this
// box and checking the profile Bright Ears sends them.
//
// Changing either wording means a new version: stored answers keep the version
// the applicant actually saw. The Thai still needs a native read (team/web).
export const LISTING_CONSENT_VERSION = "listing-v1-2026-11-13";

export const LISTING_CONSENT_TEXT = {
  en: "Optional: I agree that Bright Ears may publish a public profile of my act on brightears.io, using the act name, bio, photo and links I sent with this form. Bright Ears sends me the profile to check before it goes live and removes it if I ask at info@brightears.io.",
  th: "ไม่บังคับ: ข้าพเจ้ายินยอมให้ Bright Ears เผยแพร่โปรไฟล์สาธารณะของการแสดงของข้าพเจ้าบน brightears.io โดยใช้ชื่อการแสดง ประวัติ รูปภาพ และลิงก์ที่ข้าพเจ้าส่งมากับแบบฟอร์มนี้ Bright Ears จะส่งโปรไฟล์ให้ข้าพเจ้าตรวจสอบก่อนเผยแพร่ และจะลบออกเมื่อข้าพเจ้าขอทางอีเมล info@brightears.io",
} as const;

/** The sentence in the required data consent that says what is published. */
export const PUBLISHING_SENTENCE = {
  en: "Bright Ears publishes nothing from this form unless I also tick the public profile box below, and then sends me the profile to check before it goes live. Bright Ears does not share the form outside Bright Ears without asking me first.",
  th: "Bright Ears จะไม่เผยแพร่ข้อมูลจากแบบฟอร์มนี้ เว้นแต่ข้าพเจ้าจะเลือกช่องโปรไฟล์สาธารณะด้านล่างด้วย ซึ่งในกรณีนั้น Bright Ears จะส่งโปรไฟล์ให้ข้าพเจ้าตรวจสอบก่อนเผยแพร่ และจะไม่ส่งต่อแบบฟอร์มนี้ให้บุคคลภายนอก Bright Ears โดยไม่ถามข้าพเจ้าก่อน",
} as const;
