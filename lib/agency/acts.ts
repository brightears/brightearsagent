// Act types Bright Ears presents to buyers and accepts applications for.
// Formats only: no artist, photo, client or result belongs in this file.
// Application ids follow team/talent/application-form-spec.md (v1, 10 Nov 2026).

export type ActType = "dj" | "dj_with_live" | "solo_instrumentalist" | "singer" | "vocal_duo" | "acoustic_duo_trio" | "jazz_band" | "band" | "percussionist" | "mc_host" | "other";

export const ACT_TYPE_LABELS: Record<ActType, { en: string; th: string }> = {
  dj: { en: "DJ", th: "ดีเจ" },
  dj_with_live: { en: "DJ with live musician (sax, percussion, violin or vocals)", th: "ดีเจร่วมกับนักดนตรีสด (แซกโซโฟน เพอร์คัชชัน ไวโอลิน หรือนักร้อง)" },
  solo_instrumentalist: { en: "Solo instrumentalist", th: "นักดนตรีเดี่ยว" },
  singer: { en: "Singer", th: "นักร้อง" },
  vocal_duo: { en: "Vocal duo", th: "นักร้องคู่" },
  acoustic_duo_trio: { en: "Acoustic duo or trio", th: "วงอะคูสติก 2–3 คน" },
  jazz_band: { en: "Jazz trio or band", th: "วงแจ๊ส (3 ชิ้นหรือวงเต็ม)" },
  band: { en: "Band", th: "วงดนตรี" },
  percussionist: { en: "Percussionist", th: "นักเพอร์คัชชัน" },
  mc_host: { en: "MC or host", th: "พิธีกร / MC" },
  other: { en: "Other", th: "อื่น ๆ" },
};

/** Buyer-facing groups on /acts. Each lists formats we can scope, not acts on file. */
export type BuyerAct = {
  id: "dj" | "dj_live" | "solo" | "vocal" | "small_band" | "mc";
  applicationTypes: ActType[];
  name: { en: string; th: string };
  body: { en: string; th: string };
  settings: { en: string; th: string };
  /** Matching ENQUIRY_ACT_OPTIONS value, preselected from the /acts card. */
  enquiry: string;
};

export const BUYER_ACTS: BuyerAct[] = [
  {
    id: "dj", enquiry: "DJ", applicationTypes: ["dj"],
    name: { en: "Resident and guest DJs", th: "ดีเจประจำและดีเจรับเชิญ" },
    body: { en: "The core of our venue programmes. One DJ for a lounge evening, or two DJs splitting a night into an early and a late set.", th: "หัวใจของโปรแกรมดนตรีประจำสถานที่ ดีเจหนึ่งคนสำหรับค่ำคืนในเลานจ์ หรือดีเจสองคนแบ่งเป็นเซ็ตหัวค่ำและเซ็ตดึก" },
    settings: { en: "Hotel bars · rooftops · restaurants · events", th: "บาร์ในโรงแรม · รูฟท็อป · ร้านอาหาร · อีเวนต์" },
  },
  {
    id: "dj_live", enquiry: "DJ with a live musician", applicationTypes: ["dj_with_live", "percussionist"],
    name: { en: "DJ with a live musician", th: "ดีเจร่วมกับนักดนตรีสด" },
    body: { en: "A DJ joined by saxophone, percussion, violin or a vocalist. The DJ holds the groove and the musician plays over it.", th: "ดีเจเล่นร่วมกับแซกโซโฟน เพอร์คัชชัน ไวโอลิน หรือนักร้อง ดีเจคุมจังหวะ นักดนตรีเล่นสดไปพร้อมกัน" },
    settings: { en: "Brunches · sunset sessions · receptions · launches", th: "บรันช์ · ช่วงพระอาทิตย์ตก · งานเลี้ยงรับรอง · งานเปิดตัว" },
  },
  {
    id: "solo", enquiry: "Solo instrumentalist", applicationTypes: ["solo_instrumentalist"],
    name: { en: "Solo instrumentalists", th: "นักดนตรีเดี่ยว" },
    body: { en: "Saxophone, violin, piano or guitar on its own, for rooms where music should stay in the background until someone stops to listen.", th: "แซกโซโฟน ไวโอลิน เปียโน หรือกีตาร์เดี่ยว สำหรับพื้นที่ที่ดนตรีควรคลออยู่เบื้องหลัง แต่ไพเราะพอให้คนหยุดฟัง" },
    settings: { en: "Lobbies · dinners · cocktail hours", th: "ล็อบบี้ · มื้อค่ำ · ช่วงค็อกเทล" },
  },
  {
    id: "vocal", enquiry: "Singer or vocal duo", applicationTypes: ["singer", "vocal_duo"],
    name: { en: "Singers and vocal duos", th: "นักร้องและนักร้องคู่" },
    body: { en: "A singer with backing tracks, or a duo with guitar or keys. Tell us the languages your guests speak and the songs they expect.", th: "นักร้องพร้อมแบ็กกิ้งแทร็ก หรือนักร้องคู่พร้อมกีตาร์หรือคีย์บอร์ด บอกเราว่าแขกของคุณใช้ภาษาอะไร และคาดหวังเพลงแบบไหน" },
    settings: { en: "Dinners · weddings · private parties", th: "มื้อค่ำ · งานแต่งงาน · งานส่วนตัว" },
  },
  {
    id: "small_band", enquiry: "Acoustic or jazz trio", applicationTypes: ["acoustic_duo_trio", "jazz_band", "band"],
    name: { en: "Acoustic and jazz trios", th: "วงอะคูสติกและวงแจ๊ส" },
    body: { en: "Two or three musicians for jazz, bossa nova, soul or acoustic pop. Space, power and sound are agreed before we confirm.", th: "นักดนตรี 2–3 คน เล่นแจ๊ส บอสซาโนวา โซล หรืออะคูสติกป๊อป เราตกลงเรื่องพื้นที่ ไฟฟ้า และเครื่องเสียงก่อนยืนยันงาน" },
    settings: { en: "Brunches · dinners · gala receptions", th: "บรันช์ · มื้อค่ำ · งานกาลา" },
  },
  {
    id: "mc", enquiry: "MC or host", applicationTypes: ["mc_host"],
    name: { en: "MCs and hosts", th: "พิธีกรและ MC" },
    body: { en: "A host in Thai, English or both, to run the programme, the countdown and the moments a DJ should not have to announce.", th: "พิธีกรภาษาไทย อังกฤษ หรือทั้งสองภาษา ดำเนินรายการ นับถอยหลัง และช่วงประกาศที่ไม่ควรให้ดีเจทำเอง" },
    settings: { en: "Corporate events · New Year’s Eve · galas", th: "งานองค์กร · คืนส่งท้ายปีเก่า · งานกาลา" },
  },
];

/** Agency-app public categories we display, mapped to the buyer group. */
export const PUBLIC_ROSTER_CATEGORIES: Record<string, BuyerAct["id"]> = {
  DJ: "dj", MUSICIAN: "solo", SINGER: "vocal", BAND: "small_band", MC: "mc",
};

/** Enquiry choices. Values are stored as English labels so Vinyl reads them as written. */
export const ENQUIRY_ACT_OPTIONS = [
  { en: "DJ", th: "ดีเจ" },
  { en: "DJ with a live musician", th: "ดีเจร่วมกับนักดนตรีสด" },
  { en: "Solo instrumentalist", th: "นักดนตรีเดี่ยว" },
  { en: "Singer or vocal duo", th: "นักร้องหรือนักร้องคู่" },
  { en: "Acoustic or jazz trio", th: "วงอะคูสติกหรือวงแจ๊ส" },
  { en: "MC or host", th: "พิธีกร / MC" },
  { en: "Not sure yet", th: "ยังไม่แน่ใจ" },
] as const;

export const ENQUIRY_VENUE_TYPES = [
  { en: "Hotel bar or lounge", th: "บาร์หรือเลานจ์ในโรงแรม" },
  { en: "Rooftop bar", th: "รูฟท็อปบาร์" },
  { en: "Restaurant", th: "ร้านอาหาร" },
  { en: "Pool or beach club", th: "พูลคลับหรือบีชคลับ" },
  { en: "Club or bar", th: "คลับหรือบาร์" },
  { en: "Event space or ballroom", th: "สถานที่จัดงานหรือห้องบอลรูม" },
  { en: "Private home or villa", th: "บ้านหรือวิลล่าส่วนตัว" },
  { en: "Other", th: "อื่น ๆ" },
] as const;

export const ENQUIRY_NIGHTS = [
  { en: "One-off event", th: "งานครั้งเดียว" },
  { en: "1 night a week", th: "สัปดาห์ละ 1 คืน" },
  { en: "2–3 nights a week", th: "สัปดาห์ละ 2–3 คืน" },
  { en: "4–6 nights a week", th: "สัปดาห์ละ 4–6 คืน" },
  { en: "Every night", th: "ทุกคืน" },
  { en: "Not sure yet", th: "ยังไม่แน่ใจ" },
] as const;
