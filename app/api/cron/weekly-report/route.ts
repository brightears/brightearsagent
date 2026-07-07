import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReports } from "@/lib/reports/weekly";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { stampCron } from "@/lib/ops-stamp";

export const maxDuration = 300;

/** Render cron hits this weekly (Monday morning per-region tuning at Phase 7). */
export async function GET(req: NextRequest) {
  if (!checkSharedSecret(process.env.CRON_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await stampCron("cron:weekly-report");
  const { sent, failed } = await sendWeeklyReports();
  return NextResponse.json({ sent, failed });
}
