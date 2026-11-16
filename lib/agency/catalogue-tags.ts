// Client-safe: used by the /artists filter and by lib/agency/catalogue.ts.
/** What a buyer filters by on /artists. Roster categories map onto the same tags. */
export const ACT_TAGS = {
  dj: { en: "DJ", th: "ดีเจ" },
  sax: { en: "Saxophone", th: "แซกโซโฟน" },
  piano: { en: "Piano", th: "เปียโน" },
  guitar: { en: "Guitar", th: "กีตาร์" },
  violin: { en: "Violin", th: "ไวโอลิน" },
  percussion: { en: "Percussion", th: "เพอร์คัชชัน" },
  vocals: { en: "Vocals", th: "นักร้อง" },
  band: { en: "Band", th: "วงดนตรี" },
  mc: { en: "MC or host", th: "พิธีกร / MC" },
  musician: { en: "Live musician", th: "นักดนตรีสด" },
} as const;
export type ActTag = keyof typeof ACT_TAGS;
