import { NextRequest, NextResponse } from "next/server";
import { runSequenceTick } from "@/lib/sequences/engine";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { stampCron } from "@/lib/ops-stamp";

export const maxDuration = 300;

/** Render cron hits this every 30 minutes (Phase 7). Gated by CRON_SECRET. */
export async function GET(req: NextRequest) {
  if (!checkSharedSecret(process.env.CRON_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await stampCron("cron:sequences");
  const result = await runSequenceTick();
  return NextResponse.json(result);
}
