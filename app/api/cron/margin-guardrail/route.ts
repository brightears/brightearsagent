import { NextRequest, NextResponse } from "next/server";
import { computeMargins } from "@/lib/billing/margin";
import { sendEmail } from "@/lib/outbound/send";

export const maxDuration = 300;

/** Nightly: flag any tenant whose month-to-date LLM cost eats below 70% gross margin. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await computeMargins();
  const flagged = rows.filter((r) => r.flagged);

  if (flagged.length && process.env.OPS_ALERT_EMAIL) {
    await sendEmail({
      fromName: "Bright Ears Ops",
      to: process.env.OPS_ALERT_EMAIL,
      replyTo: process.env.OPS_ALERT_EMAIL,
      subject: `Margin guardrail: ${flagged.length} tenant(s) below ${70}%`,
      textBody: flagged
        .map((r) => `${r.businessName} (${r.plan}): $${r.llmCostUsd} LLM cost vs $${r.planUsd} → ${r.grossMarginPct}%`)
        .join("\n"),
    }).catch(() => null);
  }

  return NextResponse.json({ tenants: rows.length, flagged: flagged.map((r) => r.businessName) });
}
