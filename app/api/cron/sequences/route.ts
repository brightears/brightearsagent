import { ASSISTANT_RUNTIME_RETIRED } from "@/lib/assistant-runtime";
import { NextRequest, NextResponse } from "next/server";
import { runSequenceTick } from "@/lib/sequences/engine";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { stampCronCompletion } from "@/lib/ops-stamp";

export const maxDuration = 300;

/** Render cron hits this every 30 minutes (Phase 7). Gated by CRON_SECRET. */
export async function GET(req: NextRequest) {
  if (!checkSharedSecret(process.env.CRON_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (ASSISTANT_RUNTIME_RETIRED) return NextResponse.json({status:"retired",workPerformed:false});
  const result = await runSequenceTick();
  if (result.draftAttempts > 0 && result.draftFailures === result.draftAttempts) {
    return NextResponse.json(
      { ...result, error: "All attempted sequence draft generations failed" },
      { status: 503 },
    );
  }
  await stampCronCompletion("cron:sequences");
  return NextResponse.json(result);
}
