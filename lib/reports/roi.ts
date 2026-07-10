import { db } from "@/lib/db";
import { sendEmail } from "@/lib/outbound/send";
import { reportError } from "@/lib/report-error";
import { PLAN_PRICES_USD } from "@/lib/billing/margin";
import { formatMinor } from "@/lib/quote/fee";
import type { PlanTier } from "@/app/generated/prisma/enums";

/**
 * Monthly ROI receipt (P11.4): on the 1st, each PAYING tenant gets one email
 * putting last month's work next to what they paid. Honesty rules:
 *   - real data only — a month where the agent did nothing sends nothing
 *     (no-empty-digests guardrail);
 *   - booked value appears ONLY when fees were actually captured (11.1), in
 *     the artist's own currency, never converted, never projected;
 *   - the subscription price is stated plainly in USD next to it — we put
 *     the two numbers side by side and let the artist do the math.
 */
export interface MonthlyRoi {
  businessId: string;
  businessName: string;
  monthLabel: string; // "June 2026"
  answered: number; // replies sent (outbound messages)
  pitched: number; // venue pitches sent
  venuesFound: number;
  won: number; // leads booked
  bookedValueMinor: number; // 0 = no fees captured
  currency: string;
  plan: PlanTier;
  planUsd: number;
}

export async function computeMonthlyRoi(
  businessId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<MonthlyRoi> {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  const window = { gte: monthStart, lt: monthEnd };

  const [answered, pitched, venuesFound, won, bookedValueMinor] = await Promise.all([
    db.message.count({ where: { lead: { businessId }, direction: "OUTBOUND", createdAt: window } }),
    db.venuePitch.count({ where: { businessId, sentAt: window } }),
    db.venue.count({ where: { businessId, createdAt: window } }),
    db.lead.count({ where: { businessId, bookedAt: window } }),
    db.gig
      .aggregate({
        _sum: { value: true },
        where: { businessId, value: { not: null }, lead: { bookedAt: window } },
      })
      .then((a) => a._sum.value ?? 0),
  ]);

  return {
    businessId,
    businessName: business.name,
    monthLabel: monthStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    answered,
    pitched,
    venuesFound,
    won,
    bookedValueMinor,
    currency: business.currency,
    plan: business.plan,
    planUsd: PLAN_PRICES_USD[business.plan],
  };
}

export function renderRoiEmail(r: MonthlyRoi): { subject: string; body: string } {
  const wonLine =
    r.won > 0
      ? `WON         ${r.won} gig${r.won === 1 ? "" : "s"} booked${
          r.bookedValueMinor > 0 ? ` — ${formatMinor(r.bookedValueMinor, r.currency)} recorded` : ""
        }`
      : `WON         none recorded this month — the pipeline above is how they arrive`;

  return {
    subject: `${r.monthLabel} at ${r.businessName}: ${r.answered} answered, ${r.pitched} pitched, ${r.won} booked`,
    body: [
      `Your ${r.monthLabel} receipt — what the agent did next to what it cost:`,
      ``,
      `ANSWERED    ${r.answered} client ${r.answered === 1 ? "email" : "emails"} sent in your voice`,
      `THE HUNT    ${r.venuesFound} venues found · ${r.pitched} pitches out from your own mailbox`,
      wonLine,
      ``,
      `YOUR PLAN   ${r.plan.charAt(0)}${r.plan.slice(1).toLowerCase()} — $${r.planUsd}/month`,
      ``,
      `Every number above is something that actually happened — nothing projected, nothing padded. Fee amounts only appear when you record them on "Mark booked".`,
      ``,
      `${process.env.APP_URL ?? "http://localhost:3000"}/dashboard/results`,
      ``,
      `— Bright Ears`,
    ].join("\n"),
  };
}

/** Prior-calendar-month window for a given "now" (UTC month boundaries). */
export function priorMonthWindow(now: Date): { start: Date; end: Date } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end };
}

/**
 * Send the receipts — paying tenants only (an ROI email for a $0 plan is
 * noise), nothing-happened months skipped, per-tenant failures isolated.
 */
export async function sendMonthlyRoiReceipts(
  now = new Date(),
): Promise<{ sent: number; skipped: number; failed: number }> {
  const { start, end } = priorMonthWindow(now);
  const businesses = await db.business.findMany({
    where: { plan: { not: "TRIAL" } },
    select: { id: true, ownerEmail: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const b of businesses) {
    try {
      const roi = await computeMonthlyRoi(b.id, start, end);
      if (roi.answered === 0 && roi.pitched === 0 && roi.won === 0 && roi.venuesFound === 0) {
        skipped++; // no empty digests — silence is honest here
        continue;
      }
      const { subject, body } = renderRoiEmail(roi);
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
      void reportError(err, { kind: "roi-receipt", businessId: b.id });
    }
  }
  return { sent, skipped, failed };
}
