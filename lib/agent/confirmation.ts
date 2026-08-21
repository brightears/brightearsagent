import { db } from "@/lib/db";
import { notifyBusiness } from "@/lib/notify";
import { formatMinor } from "@/lib/quote/fee";
import { normalizeLocale, languageTag } from "@/lib/i18n/config";

/**
 * Booking-confirmation draft (P11.2): created the moment a lead is marked
 * BOOKED. Deliberately DETERMINISTIC — a confirmation is a contractual
 * email; the details (date, venue, fee, booking link) must be the real ones,
 * so there is no LLM in this path, just the artist's saved greeting/signoff
 * around grounded facts. The owner approves it like any draft; it is the one
 * draft sendDraftReply allows on a BOOKED lead (isConfirmation carve-out),
 * it never starts a follow-up sequence, and wantsQuote pre-arms the quote
 * PDF attachment (the written record of the fee).
 */
export async function draftBookingConfirmation(
  leadId: string,
  feeMinor: number | null,
): Promise<string | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { business: true },
  });
  if (!lead || !lead.clientEmail || lead.optedOut) return null;

  // Dedupe like every other draft path — never stack PENDING drafts.
  const existing = await db.draft.findFirst({
    where: { leadId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) return null;

  const b = lead.business;
  const ownerThai = normalizeLocale(b.locale) === "th";
  // Confirmation copy follows the client-facing language when Thai is visible
  // in the inquiry; otherwise it preserves the English behavior. This path is
  // deterministic because a booking confirmation carries contractual facts.
  const clientThai = /[\u0E00-\u0E7F]/.test(`${lead.rawSubject ?? ""}\n${lead.rawBody}`);
  const firstName = (lead.clientName ?? "").trim().split(/\s+/)[0] || (clientThai ? "คุณ" : "there");
  const greeting = (b.voiceGreeting ?? (clientThai ? "สวัสดี [name]," : "Hi [name],")).replace(/\[name\]/gi, firstName);
  const signoff = b.voiceSignoff ?? (clientThai ? "ขอบคุณครับ/ค่ะ" : "Best regards,");

  const when = lead.eventDate
    ? lead.eventDate.toLocaleDateString(clientThai ? languageTag("th") : languageTag("en"), {
        timeZone: b.timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const what = clientThai
    ? [lead.eventType, when ? `วันที่ ${when}` : null, lead.venue ? `ที่ ${lead.venue}` : null].filter(Boolean).join(" ")
    : [lead.eventType, when ? `on ${when}` : null, lead.venue ? `at ${lead.venue}` : null].filter(Boolean).join(" ");

  const body = clientThai
    ? [
        greeting,
        "",
        `ข่าวดีครับ/ค่ะ ยืนยันวันจัดงานเรียบร้อยแล้ว${what ? ` สำหรับ${what}` : ""} เรายินดีมากที่จะได้เป็นส่วนหนึ่งของงานนี้`,
        ...(feeMinor ? ["", `ค่าจ้างตามที่ตกลงคือ ${formatMinor(feeMinor, b.currency)}`] : []),
        ...(b.bookingLinkUrl ? ["", `ยืนยันการจองให้เรียบร้อยได้ที่: ${b.bookingLinkUrl}`] : []),
        "",
        "หากเวลา สถานที่ หรือรายละเอียดพิเศษมีการเปลี่ยนแปลง โปรดตอบกลับอีเมลนี้ แล้วเราจะช่วยจัดการให้",
        "",
        signoff,
        b.name,
      ].join("\n")
    : [
        greeting,
        "",
        `Wonderful news — consider the date locked in${what ? ` for your ${what}` : ""}. We're thrilled to be part of it.`,
        ...(feeMinor ? ["", `As agreed, the fee is ${formatMinor(feeMinor, b.currency)}.`] : []),
        ...(b.bookingLinkUrl ? ["", `To make everything official, you can complete the booking here: ${b.bookingLinkUrl}`] : []),
        "",
        "If any detail changes — timings, address, special requests — just reply to this email and we'll take care of it.",
        "",
        signoff,
        b.name,
      ].join("\n");

  const draft = await db.draft.create({
    data: {
      leadId,
      subject: clientThai
        ? `ยืนยันการจอง${when ? ` — ${when}` : ""}: ${lead.eventType ?? "งานของคุณ"}`
        : `Booked${when ? ` — ${when}` : ""}: ${lead.eventType ?? "your event"} confirmation`,
      body,
      isConfirmation: true,
      // Pre-arm the quote PDF ONLY when no fee was captured (P15 review): the
      // quote engine prices from packages/floor, which can DIFFER from the
      // agreed fee stated in the body — attaching both would put two
      // contradictory numbers in one email. A captured fee IS the record.
      wantsQuote: feeMinor == null,
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  });

  void notifyBusiness(b, {
    title: ownerThai ? `ร่างยืนยันการจองพร้อมแล้ว: ${lead.clientName ?? "งานใหม่ของคุณ"}` : `Confirmation ready: ${lead.clientName ?? "your new booking"}`,
    body: ownerThai ? "ร่างอีเมลยืนยันการจองพร้อมแล้ว กดครั้งเดียวเพื่อส่ง" : "The booking-confirmation email is drafted — one tap sends it.",
    url: `/dashboard/leads/${leadId}`,
    emailBody: ownerThai
      ? `คุณบันทึก ${lead.clientName ?? "ลูกค้า"} ว่าจองงานแล้ว ร่างอีเมลยืนยัน${b.bookingLinkUrl ? "พร้อมลิงก์การจอง " : ""}และตัวเลือกใบเสนอราคา PDF กำลังรอให้คุณอนุมัติ`
      : `You marked ${lead.clientName ?? "a lead"} as booked — a confirmation email (details, ${b.bookingLinkUrl ? "your booking link, " : ""}quote PDF option) is drafted and waiting for your approval.`,
  }).catch(() => null);

  return draft.id;
}
