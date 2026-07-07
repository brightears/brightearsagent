import { NextRequest, NextResponse } from "next/server";
import { computeMargins } from "@/lib/billing/margin";
import { reconcileStripe, computeHeartbeat, renderHeartbeat } from "@/lib/ops/nightly";
import { sendEmail } from "@/lib/outbound/send";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { stampCron } from "@/lib/ops-stamp";

export const maxDuration = 300;

/**
 * The nightly ops pass (rides the original margin-guardrail schedule, daily
 * 02:00 UTC — no new Render job needed):
 *  1. Margin guardrail: flag tenants whose LLM cost eats below 70% gross.
 *  2. Stripe reconciliation (P7.11): diff Stripe truth vs Business rows,
 *     self-heal desyncs — the webhook is the single thread holding plan truth
 *     and two desync classes have already been found the hard way.
 *  3. Heartbeat digest (P7.12): one proof-of-life email to OPS_ALERT_EMAIL,
 *     sent EVERY night, so a silent day reads as the anomaly it is.
 */
export async function GET(req: NextRequest) {
  if (!checkSharedSecret(process.env.CRON_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await stampCron("cron:margin-guardrail");

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

  const reconcile = await reconcileStripe();
  const heartbeat = await computeHeartbeat();

  if (process.env.OPS_ALERT_EMAIL) {
    await sendEmail({
      fromName: "Bright Ears Ops",
      to: process.env.OPS_ALERT_EMAIL,
      replyTo: process.env.OPS_ALERT_EMAIL,
      subject: `Ops heartbeat: ${heartbeat.leadsIn} in · ${heartbeat.repliesSent} replies · ${heartbeat.pitchesSent} pitches${
        heartbeat.staleCrons.length || reconcile.issues.length ? " · ATTENTION" : ""
      }`,
      textBody: renderHeartbeat(heartbeat, { flagged: flagged.length, tenants: rows.length }, reconcile),
    }).catch(() => null);
  }

  return NextResponse.json({
    tenants: rows.length,
    flagged: flagged.map((r) => r.businessName),
    reconcile,
    heartbeat,
  });
}
