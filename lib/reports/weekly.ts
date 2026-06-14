import { db } from "@/lib/db";
import { sendEmail } from "@/lib/outbound/send";

export interface WeeklyNumbers {
  businessId: string;
  businessName: string;
  leadsIn: number;
  spamFiltered: number;
  medianFirstReplyMinutes: number | null;
  repliesSent: number;
  engaged: number;
  booked: number;
  inSequence: number;
}

const WEEK = 7 * 24 * 3600 * 1000;

export async function computeWeekly(businessId: string, now = new Date()): Promise<WeeklyNumbers> {
  const since = new Date(now.getTime() - WEEK);
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });

  const [leadsIn, spamFiltered, repliedLeads, repliesSent, engaged, booked, inSequence] =
    await Promise.all([
      db.lead.count({ where: { businessId, createdAt: { gte: since }, status: { not: "SPAM" } } }),
      db.lead.count({ where: { businessId, createdAt: { gte: since }, status: "SPAM" } }),
      db.lead.findMany({
        where: { businessId, firstReplyAt: { gte: since } },
        select: { createdAt: true, firstReplyAt: true },
      }),
      db.message.count({
        where: { lead: { businessId }, direction: "OUTBOUND", createdAt: { gte: since } },
      }),
      db.lead.count({ where: { businessId, status: "ENGAGED", updatedAt: { gte: since } } }),
      db.lead.count({ where: { businessId, bookedAt: { gte: since } } }),
      db.lead.count({ where: { businessId, status: "IN_SEQUENCE" } }),
    ]);

  const replyMinutes = repliedLeads
    .map((l) => (l.firstReplyAt!.getTime() - l.createdAt.getTime()) / 60000)
    .sort((a, b) => a - b);
  const medianFirstReplyMinutes = replyMinutes.length
    ? Math.round(replyMinutes[Math.floor(replyMinutes.length / 2)])
    : null;

  return {
    businessId,
    businessName: business.name,
    leadsIn,
    spamFiltered,
    medianFirstReplyMinutes,
    repliesSent,
    engaged,
    booked,
    inSequence,
  };
}

export function renderWeeklyEmail(n: WeeklyNumbers): { subject: string; body: string } {
  const replyLine =
    n.medianFirstReplyMinutes === null
      ? "No new inquiries needed a first reply this week."
      : n.medianFirstReplyMinutes < 60
        ? `Median first reply: ${n.medianFirstReplyMinutes} minutes. (Most businesses take a day or more — replying first is what couples reward.)`
        : `Median first reply: ${Math.round(n.medianFirstReplyMinutes / 60)} hours.`;

  return {
    subject: `Your week: ${n.leadsIn} leads in, ${n.booked} booked`,
    body: [
      `Here's what happened at ${n.businessName} this week:`,
      ``,
      `• New leads: ${n.leadsIn} (plus ${n.spamFiltered} spam/scam emails filtered out — you never saw them)`,
      `• ${replyLine}`,
      `• Replies sent: ${n.repliesSent}`,
      `• Conversations in progress: ${n.engaged}`,
      `• Being followed up automatically: ${n.inSequence}`,
      `• Booked: ${n.booked} 🎉`,
      ``,
      `Open your pipeline: ${process.env.APP_URL ?? "http://localhost:3000"}/dashboard`,
      ``,
      `— Bright Ears`,
    ].join("\n"),
  };
}

/** Send the weekly report to every active business owner. */
export async function sendWeeklyReports(now = new Date()): Promise<number> {
  const businesses = await db.business.findMany({ select: { id: true, ownerEmail: true } });
  let sent = 0;
  for (const b of businesses) {
    const numbers = await computeWeekly(b.id, now);
    if (numbers.leadsIn === 0 && numbers.repliesSent === 0 && numbers.inSequence === 0) continue; // nothing to report
    const { subject, body } = renderWeeklyEmail(numbers);
    await sendEmail({
      fromName: "Bright Ears",
      to: b.ownerEmail,
      replyTo: "support@brightears.io",
      subject,
      textBody: body,
    });
    sent++;
  }
  return sent;
}
