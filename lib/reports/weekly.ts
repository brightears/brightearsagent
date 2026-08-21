import { db } from "@/lib/db";
import { sendEmail } from "@/lib/outbound/send";
import { reportError } from "@/lib/report-error";
import { formatMinor } from "@/lib/quote/fee";
// Strict tier on purpose: these links land in customer emails — better to
// throw than mail out a localhost/staging dashboard link.
import { appUrl } from "@/lib/app-url";
import { normalizeLocale } from "@/lib/i18n/config";

export interface WeeklyNumbers {
  businessId: string;
  businessName: string;
  locale?: string;
  leadsIn: number;
  spamFiltered: number;
  medianFirstReplyMinutes: number | null;
  repliesSent: number;
  engaged: number;
  booked: number;
  /** 11.1: sum of captured gig fees for the week (minor units); 0 = none captured. */
  bookedValue: number;
  /** The artist's own currency (Business.currency) for the value line. */
  currency: string;
  inSequence: number;
  // The Hunt (P8.6 — the report used to cover only the reactive half, so the
  // agent's proactive week was invisible unless the artist opened the app):
  venuesFound: number;
  pitchesSent: number;
  venueReplies: number;
  /** Action line: drafts sitting unapproved right now. */
  draftsWaiting: number;
}

const WEEK = 7 * 24 * 3600 * 1000;

export async function computeWeekly(businessId: string, now = new Date()): Promise<WeeklyNumbers> {
  const since = new Date(now.getTime() - WEEK);
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });

  const [leadsIn, spamFiltered, repliedLeads, repliesSent, engaged, booked, inSequence, venuesFound, pitchesSent, venueReplies, draftsWaiting, bookedValue] =
    await Promise.all([
      db.lead.count({ where: { businessId, createdAt: { gte: since }, status: { not: "SPAM" } } }),
      db.lead.count({ where: { businessId, createdAt: { gte: since }, status: "SPAM" } }),
      db.lead.findMany({
        where: { businessId, firstReplyAt: { gte: since } },
        select: {
          createdAt: true,
          firstReplyAt: true,
          messages: {
            where: { direction: "OUTBOUND" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { bouncedAt: true },
          },
        },
      }),
      db.message.count({
        where: {
          lead: { businessId },
          direction: "OUTBOUND",
          createdAt: { gte: since },
          bouncedAt: null,
        },
      }),
      db.lead.count({ where: { businessId, status: "ENGAGED", updatedAt: { gte: since } } }),
      db.lead.count({ where: { businessId, bookedAt: { gte: since } } }),
      db.lead.count({ where: { businessId, status: "IN_SEQUENCE" } }),
      db.venue.count({ where: { businessId, createdAt: { gte: since } } }),
      db.venuePitch.count({ where: { businessId, sentAt: { gte: since } } }),
      db.venue.count({ where: { businessId, repliedAt: { gte: since } } }),
      db.draft.count({ where: { status: "PENDING", lead: { businessId } } }),
      db.gig
        .aggregate({
          _sum: { value: true },
          where: { businessId, value: { not: null }, lead: { bookedAt: { gte: since } } },
        })
        .then((a) => a._sum.value ?? 0),
    ]);

  const replyMinutes = repliedLeads
    .filter((lead) => !lead.messages[0]?.bouncedAt)
    .map((l) => (l.firstReplyAt!.getTime() - l.createdAt.getTime()) / 60000)
    .sort((a, b) => a - b);
  const medianFirstReplyMinutes = replyMinutes.length
    ? Math.round(replyMinutes[Math.floor(replyMinutes.length / 2)])
    : null;

  return {
    businessId,
    businessName: business.name,
    locale: business.locale,
    leadsIn,
    spamFiltered,
    medianFirstReplyMinutes,
    repliesSent,
    engaged,
    booked,
    bookedValue,
    currency: business.currency,
    inSequence,
    venuesFound,
    pitchesSent,
    venueReplies,
    draftsWaiting,
  };
}

export function renderWeeklyEmail(n: WeeklyNumbers): { subject: string; body: string } {
  if (normalizeLocale(n.locale) === "th") {
    const replyLine = n.medianFirstReplyMinutes === null
      ? "สัปดาห์นี้ยังไม่มีข้อความติดต่อที่ต้องตอบครั้งแรก"
      : `เวลามัธยฐานในการตอบครั้งแรก ${n.medianFirstReplyMinutes} นาที`;
    return {
      subject: `สรุปสัปดาห์: ข้อความติดต่อ ${n.leadsIn} รายการ${n.pitchesSent > 0 ? ` · ส่งแนะนำตัว ${n.pitchesSent} รายการ` : ""} · จองสำเร็จ ${n.booked} งาน`,
      body: [
        `ผลงานที่ผู้ช่วยทำให้ ${n.businessName} ในสัปดาห์นี้:`,
        "",
        `ข้อความติดต่อ   เข้าใหม่ ${n.leadsIn} · ส่งคำตอบ ${n.repliesSent} · กรองสแปม ${n.spamFiltered}`,
        `                 ${replyLine}`,
        `ค้นหาสถานที่    พบ ${n.venuesFound} แห่ง · ส่งแนะนำตัว ${n.pitchesSent} · สถานที่ตอบกลับ ${n.venueReplies}`,
        `กำลังดำเนินการ  สนทนาอยู่ ${n.engaged} · ติดตามอัตโนมัติ ${n.inSequence}`,
        `จองสำเร็จ       ${n.booked}${n.bookedValue > 0 ? ` — มูลค่า ${formatMinor(n.bookedValue, n.currency)}` : ""}`,
        "",
        n.draftsWaiting > 0
          ? `มีร่าง ${n.draftsWaiting} รายการรอให้คุณอนุมัติ: ${appUrl()}/dashboard`
          : `ไม่มีรายการรอคุณตรวจ ระบบเป็นปัจจุบันแล้ว ${appUrl()}/dashboard`,
        "",
        "— Bright Ears",
      ].join("\n"),
    };
  }
  const replyLine =
    n.medianFirstReplyMinutes === null
      ? "No new inquiries needed a first reply this week."
      : n.medianFirstReplyMinutes < 60
        ? `Median first reply: ${n.medianFirstReplyMinutes} minutes. (Most businesses take a day or more — replying first is what clients reward.)`
        : `Median first reply: ${Math.round(n.medianFirstReplyMinutes / 60)} hours.`;

  // v2 (P8.6): scannable value-receipt shape — a few BIG lines the artist can
  // read in five seconds, the Hunt's work finally on the record, and ONE
  // action line. Celebration, never an upsell (research: the report email IS
  // the retention surface).
  const subjectHunt = n.pitchesSent > 0 ? `, ${n.pitchesSent} pitches out` : "";
  return {
    subject: `Your week: ${n.leadsIn} inquiries in${subjectHunt}, ${n.booked} booked`,
    body: [
      `What your agent did at ${n.businessName} this week:`,
      ``,
      `INQUIRIES   ${n.leadsIn} in · ${n.repliesSent} replies sent · ${n.spamFiltered} spam filtered before you saw them`,
      `            ${replyLine}`,
      `THE HUNT    ${n.venuesFound} venues found · ${n.pitchesSent} pitches out · ${n.venueReplies} venue ${n.venueReplies === 1 ? "reply" : "replies"}`,
      `IN MOTION   ${n.engaged} conversations going · ${n.inSequence} in automatic follow-up`,
      `BOOKED      ${n.booked}${n.bookedValue > 0 ? ` — worth ${formatMinor(n.bookedValue, n.currency)}` : ""}`,
      ``,
      n.draftsWaiting > 0
        ? `${n.draftsWaiting} draft${n.draftsWaiting === 1 ? " is" : "s are"} waiting for your tap: ${appUrl()}/dashboard`
        : `Nothing is waiting on you — the machine is current. ${appUrl()}/dashboard`,
      ``,
      `— Bright Ears`,
    ].join("\n"),
  };
}

/** Send the weekly report to every active business owner. Per-tenant errors
 *  are isolated (P7.7): one bad address or transient send failure must never
 *  stop the rest of the fleet's reports. */
export async function sendWeeklyReports(now = new Date()): Promise<{ sent: number; failed: number }> {
  const businesses = await db.business.findMany({ select: { id: true, ownerEmail: true } });
  let sent = 0;
  let failed = 0;
  for (const b of businesses) {
    try {
      const numbers = await computeWeekly(b.id, now);
      const nothingHappened =
        numbers.leadsIn === 0 &&
        numbers.repliesSent === 0 &&
        numbers.inSequence === 0 &&
        numbers.venuesFound === 0 &&
        numbers.pitchesSent === 0;
      if (nothingHappened) continue; // nothing to report — no empty digests
      const { subject, body } = renderWeeklyEmail(numbers);
      await sendEmail({
        fromName: "Bright Ears",
        to: b.ownerEmail,
        replyTo: "support@brightears.io",
        subject,
        textBody: body,
      });
      sent++;
    } catch (err) {
      failed++;
      void reportError(err, { kind: "weekly-report", businessId: b.id });
    }
  }
  return { sent, failed };
}
