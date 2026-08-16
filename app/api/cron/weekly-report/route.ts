import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReports } from "@/lib/reports/weekly";
import { runEpkFreshnessSweep } from "@/lib/epk/freshness";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { stampCronCompletion } from "@/lib/ops-stamp";

export const maxDuration = 300;

/** Render cron hits this weekly (Monday morning per-region tuning at Phase 7). */
export async function GET(req: NextRequest) {
  if (!checkSharedSecret(process.env.CRON_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { sent, failed } = await sendWeeklyReports();
  // P12.6: the EPK freshness sweep rides the weekly cadence — link-rot nags
  // land alongside the report, never as extra noise days.
  const freshness = await runEpkFreshnessSweep();
  const allReportAttemptsFailed = failed > 0 && sent === 0;
  const allFreshnessChecksFailed =
    freshness.checked > 0 && freshness.failed === freshness.checked;
  const payload = { sent, failed, freshness };

  if (allReportAttemptsFailed || allFreshnessChecksFailed) {
    return NextResponse.json(
      {
        ...payload,
        error: "Weekly customer workload failed systemically",
      },
      { status: 503 },
    );
  }

  await stampCronCompletion("cron:weekly-report");
  return NextResponse.json(payload);
}
