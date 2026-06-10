import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReports } from "@/lib/reports/weekly";

export const maxDuration = 300;

/** Render cron hits this weekly (Monday morning per-region tuning at Phase 7). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await sendWeeklyReports();
  return NextResponse.json({ sent });
}
