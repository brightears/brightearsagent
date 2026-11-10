import { z } from "zod";
import { ACT_TYPE_LABELS, type ActType } from "./acts";

// Public artist application (/join). Fields, values and rules follow
// team/talent/application-form-spec.md v1 (10 November 2026). The form never
// asks for ID, passport, bank, date of birth, address or work-permit documents.

type Label = { en: string; th: string };
const options = <T extends string>(values: Record<T, Label>) => values;

export const ACT_TYPES = Object.keys(ACT_TYPE_LABELS) as [ActType, ...ActType[]];
export const CITIES = options({
  bangkok: { en: "Bangkok", th: "กรุงเทพฯ" }, pattaya: { en: "Pattaya", th: "พัทยา" }, hua_hin: { en: "Hua Hin", th: "หัวหิน" },
  phuket: { en: "Phuket", th: "ภูเก็ต" }, chiang_mai: { en: "Chiang Mai", th: "เชียงใหม่" },
  other_thailand: { en: "Elsewhere in Thailand", th: "จังหวัดอื่นในประเทศไทย" }, outside_thailand: { en: "Outside Thailand", th: "ต่างประเทศ" },
});
export const TRAVEL = options({
  bangkok: { en: "Bangkok", th: "กรุงเทพฯ" }, pattaya: { en: "Pattaya", th: "พัทยา" }, hua_hin: { en: "Hua Hin", th: "หัวหิน" },
  phuket: { en: "Phuket", th: "ภูเก็ต" }, samui: { en: "Samui", th: "เกาะสมุย" }, chiang_mai: { en: "Chiang Mai", th: "เชียงใหม่" }, overseas: { en: "Overseas", th: "ต่างประเทศ" },
});
export const LANGUAGES = options({
  thai: { en: "Thai", th: "ไทย" }, english: { en: "English", th: "อังกฤษ" }, chinese: { en: "Chinese", th: "จีน" },
  japanese: { en: "Japanese", th: "ญี่ปุ่น" }, russian: { en: "Russian", th: "รัสเซีย" }, other: { en: "Other", th: "อื่น ๆ" },
});
export const YEARS = options({
  under_1: { en: "Under 1 year", th: "น้อยกว่า 1 ปี" }, "1_3": { en: "1–3 years", th: "1–3 ปี" }, "3_5": { en: "3–5 years", th: "3–5 ปี" },
  "5_10": { en: "5–10 years", th: "5–10 ปี" }, over_10: { en: "Over 10 years", th: "มากกว่า 10 ปี" },
});
export const GENRES = options({
  deep_house: { en: "Deep house", th: "ดีพเฮาส์" }, house: { en: "House", th: "เฮาส์" }, afro_house: { en: "Afro house", th: "แอโฟรเฮาส์" },
  nu_disco: { en: "Nu-disco", th: "นูดิสโก้" }, disco_funk: { en: "Disco & funk", th: "ดิสโก้และฟังก์" }, soulful_house: { en: "Soulful house", th: "โซลฟูลเฮาส์" },
  lounge_downtempo: { en: "Lounge & downtempo", th: "เลานจ์และดาวน์เทมโป" }, chill_balearic: { en: "Chill & Balearic", th: "ชิลล์และบาเลียริก" },
  hip_hop_rnb: { en: "Hip-hop & R&B", th: "ฮิปฮอปและอาร์แอนด์บี" }, open_format_top40: { en: "Open format & Top 40", th: "โอเพนฟอร์แมตและเพลงฮิต" },
  latin: { en: "Latin", th: "ลาติน" }, jazz: { en: "Jazz", th: "แจ๊ส" }, bossa_nova: { en: "Bossa nova", th: "บอสซาโนวา" },
  soul_motown: { en: "Soul & Motown", th: "โซลและโมทาวน์" }, acoustic_pop: { en: "Acoustic pop", th: "อะคูสติกป๊อป" }, thai_pop: { en: "Thai pop", th: "เพลงป๊อปไทย" },
  luk_thung: { en: "Luk thung", th: "ลูกทุ่ง" }, chinese_pop: { en: "Chinese pop", th: "เพลงป๊อปจีน" }, classical: { en: "Classical", th: "คลาสสิก" },
  rock: { en: "Rock", th: "ร็อก" }, reggae: { en: "Reggae", th: "เร็กเก" }, techno: { en: "Techno", th: "เทคโน" }, other: { en: "Other", th: "อื่น ๆ" },
});
export const SETTINGS = options({
  hotel_bar_lounge: { en: "Hotel bar or lounge", th: "บาร์หรือเลานจ์ในโรงแรม" }, rooftop: { en: "Rooftop", th: "รูฟท็อป" },
  restaurant_dinner: { en: "Restaurant dinner", th: "มื้อค่ำในร้านอาหาร" }, brunch: { en: "Brunch", th: "บรันช์" },
  pool_beach_club: { en: "Pool or beach club", th: "พูลคลับหรือบีชคลับ" }, lobby: { en: "Lobby", th: "ล็อบบี้" }, club: { en: "Club", th: "คลับ" },
  wedding: { en: "Wedding", th: "งานแต่งงาน" }, corporate_gala: { en: "Corporate event or gala", th: "งานองค์กรหรืองานกาลา" },
  private_party: { en: "Private party", th: "งานส่วนตัว" }, festival: { en: "Festival", th: "เทศกาลดนตรี" }, none_yet: { en: "None yet", th: "ยังไม่เคย" },
});
export const SET_LENGTHS = options({
  "45min": { en: "45 min", th: "45 นาที" }, "60min": { en: "60 min", th: "60 นาที" }, "2x45": { en: "2 × 45 min", th: "2 × 45 นาที" },
  "3x45": { en: "3 × 45 min", th: "3 × 45 นาที" }, "2h": { en: "2 hours", th: "2 ชั่วโมง" }, "3h": { en: "3 hours", th: "3 ชั่วโมง" }, "4h": { en: "4 hours", th: "4 ชั่วโมง" },
});
export const EQUIPMENT = options({
  dj_controller_or_players: { en: "DJ controller or players", th: "ดีเจคอนโทรลเลอร์หรือเครื่องเล่น" }, pa_speakers: { en: "PA speakers", th: "ลำโพง PA" },
  microphones: { en: "Microphones", th: "ไมโครโฟน" }, instrument_amp: { en: "Instrument amp", th: "แอมป์เครื่องดนตรี" },
  in_ear_monitors: { en: "In-ear monitors", th: "อินเอียร์มอนิเตอร์" }, lighting: { en: "Lighting", th: "ไฟเวที" }, none: { en: "None", th: "ไม่มี" },
});
export const NIGHTS = options({
  mon: { en: "Mon", th: "จ." }, tue: { en: "Tue", th: "อ." }, wed: { en: "Wed", th: "พ." }, thu: { en: "Thu", th: "พฤ." },
  fri: { en: "Fri", th: "ศ." }, sat: { en: "Sat", th: "ส." }, sun: { en: "Sun", th: "อา." }, daytime_weekends: { en: "Weekend daytime", th: "กลางวันเสาร์–อาทิตย์" },
});
export const FEES = options({
  under_1000: { en: "Under THB 1,000", th: "ต่ำกว่า 1,000 บาท" }, "1000_1500": { en: "THB 1,000–1,500", th: "1,000–1,500 บาท" },
  "1500_2500": { en: "THB 1,500–2,500", th: "1,500–2,500 บาท" }, "2500_4000": { en: "THB 2,500–4,000", th: "2,500–4,000 บาท" },
  "4000_6000": { en: "THB 4,000–6,000", th: "4,000–6,000 บาท" }, over_6000: { en: "Over THB 6,000", th: "มากกว่า 6,000 บาท" },
  per_event_quote: { en: "I quote per event", th: "เสนอราคาเป็นรายงาน" },
});
export const RIGHT_TO_WORK = options({
  thai_national: { en: "Thai national", th: "สัญชาติไทย" }, foreigner_with_work_permit: { en: "Foreigner with a work permit", th: "ชาวต่างชาติที่มีใบอนุญาตทำงาน" },
  foreigner_no_work_permit: { en: "Foreigner without a work permit", th: "ชาวต่างชาติที่ยังไม่มีใบอนุญาตทำงาน" }, prefer_to_discuss: { en: "I’d rather discuss it", th: "ขอคุยรายละเอียดภายหลัง" },
});
export const CHANNELS = options({
  line: { en: "LINE", th: "LINE" }, email: { en: "Email", th: "อีเมล" }, phone: { en: "Phone", th: "โทรศัพท์" }, instagram: { en: "Instagram", th: "Instagram" },
});
export const HEARD_FROM = options({
  referral_bright_ears_artist: { en: "A Bright Ears artist", th: "ศิลปินของ Bright Ears" }, venue: { en: "A venue", th: "สถานที่ที่เคยเล่น" },
  instagram: { en: "Instagram", th: "Instagram" }, google: { en: "Google", th: "Google" }, friend: { en: "A friend", th: "เพื่อน" }, other: { en: "Other", th: "อื่น ๆ" },
});

// 8 MB, not the 10 MB in the spec: proxy.ts buffers request bodies only up to
// 10 MB (Next proxyClientMaxBodySize), and a truncated multipart body would fail.
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type PhotoType = keyof typeof PHOTO_TYPES;
/** Multipart body ceiling: one photo plus the JSON payload and boundaries. */
export const MAX_APPLICATION_BODY = MAX_PHOTO_BYTES + 64 * 1024;

const keys = <T extends string>(values: Record<T, Label>) => Object.keys(values) as [T, ...T[]];
const text = (max: number) => z.string().trim().max(max);
const optionalEnum = <T extends string>(values: Record<T, Label>) => z.union([z.enum(keys(values)), z.literal("")]).default("");
const many = <T extends string>(values: Record<T, Label>, max: number) => z.array(z.enum(keys(values))).max(max).default([]).transform(list => [...new Set(list)]);

/** A 13-digit number starting 1–8, the Thai national ID pattern, with spaces or dashes ignored. */
export function containsThaiIdNumber(value: string): boolean {
  return /(?<!\d)[1-8]\d{12}(?!\d)/.test(value.replace(/(?<=\d)[\s-]+(?=\d)/g, ""));
}

/** Thai or international number to E.164, or null. */
export function normalizePhone(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  if (!/^[+\d][\d\s().-]*$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  if (digits.startsWith("0") && (digits.length === 9 || digits.length === 10)) return "+66" + digits.slice(1);
  if (digits.startsWith("66") && (digits.length === 10 || digits.length === 11)) return "+" + digits;
  return null;
}

function httpsUrl(domains?: string[]) {
  return text(300).refine(value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) return false;
      const host = url.hostname.toLowerCase();
      return !domains || domains.some(domain => host === domain || host.endsWith("." + domain));
    } catch { return false; }
  }, "invalid_url");
}

export const FREE_TEXT_FIELDS = ["act_name", "contact_name", "instrument_or_role", "genres_other", "venues_played", "bio", "photo_credit", "line_id", "referred_by"] as const;

export const applicationFieldsSchema = z.object({
  act_name: text(80).min(2),
  contact_name: text(80).min(2),
  act_type: z.enum(ACT_TYPES),
  instrument_or_role: text(120).default(""),
  members: z.number().int().min(1).max(12),
  base_city: z.enum(keys(CITIES)),
  travel: many(TRAVEL, 7),
  languages: many(LANGUAGES, 6),
  years_performing: z.enum(keys(YEARS)),
  genres: z.array(z.enum(keys(GENRES))).min(1).max(6).transform(list => [...new Set(list)]),
  genres_other: text(120).default(""),
  settings_played: z.array(z.enum(keys(SETTINGS))).min(1).max(12).transform(list => [...new Set(list)]),
  venues_played: text(400).default(""),
  set_lengths: many(SET_LENGTHS, 7),
  own_equipment: many(EQUIPMENT, 7),
  bio: text(600).default(""),
  mix_or_video_url: httpsUrl().pipe(z.string().min(1)),
  instagram_url: httpsUrl(["instagram.com"]).default(""),
  facebook_url: httpsUrl(["facebook.com", "fb.com"]).default(""),
  soundcloud_url: httpsUrl(["soundcloud.com"]).default(""),
  mixcloud_url: httpsUrl(["mixcloud.com"]).default(""),
  youtube_url: httpsUrl(["youtube.com", "youtu.be"]).default(""),
  website_url: httpsUrl().default(""),
  photo_credit: text(80).default(""),
  available_nights: many(NIGHTS, 8),
  earliest_start: text(10).default(""),
  expected_fee_per_hour_thb: optionalEnum(FEES),
  right_to_work: optionalEnum(RIGHT_TO_WORK),
  email: z.union([z.email().max(150), z.literal("")]).default("").transform(value => value.trim().toLowerCase()),
  line_id: text(40).default(""),
  phone: text(30).default(""),
  preferred_channel: z.enum(keys(CHANNELS)),
  heard_from: optionalEnum(HEARD_FROM),
  referred_by: text(80).default(""),
  consent_age: z.literal(true),
  consent_data: z.literal(true),
}).strict().superRefine((value, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (value.act_type !== "dj" && value.instrument_or_role.length < 2) issue("instrument_or_role", "required");
  if (value.bio && value.bio.length < 40) issue("bio", "too_short");
  if (value.line_id && !/^[^\s]{3,40}$/.test(value.line_id)) issue("line_id", "invalid");
  if (value.phone && normalizePhone(value.phone) === null) issue("phone", "invalid");
  if (!value.email && !value.line_id && !value.phone) issue("contact", "contact_required");
  if (value.earliest_start) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(value.earliest_start) && new Date(value.earliest_start).toISOString().slice(0, 10) === value.earliest_start;
    // One day of slack for visitors west of Bangkok.
    if (!valid || Date.parse(value.earliest_start) < Date.now() - 2 * 86_400_000) issue("earliest_start", "invalid");
  }
  for (const field of FREE_TEXT_FIELDS) if (containsThaiIdNumber(String(value[field] ?? ""))) issue(field, "id_number");
}).transform(value => ({ ...value, phone: normalizePhone(value.phone) ?? "" }));

export const applicationSchema = z.object({
  submissionKey: z.uuid(),
  locale: z.enum(["en", "th"]),
  website: text(200).optional().default(""),
  sourcePath: text(200).optional().default("/join"),
  utm: z.object({ source: text(100), medium: text(100), campaign: text(100), term: text(100), content: text(100) }).partial().strict().optional(),
  application: applicationFieldsSchema,
}).strict();

export type ArtistApplicationInput = z.infer<typeof applicationSchema>;
export type ApplicationFields = z.input<typeof applicationFieldsSchema>;

/** Field names with problems, for messages in the page language. */
export function applicationIssues(error: z.ZodError): { field: string; code: string }[] {
  return error.issues.map(issue => {
    const field = String(issue.path[issue.path[0] === "application" ? 1 : 0] ?? "form");
    return { field, code: issue.message === "id_number" ? "id_number" : issue.message === "contact_required" ? "contact_required" : "invalid" };
  });
}

/** Detects the image type from its first bytes; the browser-supplied type is not trusted. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  const starts = (...values: number[]) => values.every((value, i) => bytes[i] === value);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}
