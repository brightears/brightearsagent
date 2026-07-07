import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CRON_FRESHNESS_MS } from "@/lib/ops-stamp";

/**
 * Health check: process up + DB reachable + CRON FRESHNESS (P7.4 — the
 * sequences tick IS the product; a silently-dead cron used to look green
 * everywhere). Used by the Render health check and the external uptime
 * monitor.
 *
 * `ok` covers process/db/auth only — a stale cron must NOT flip the Render
 * health check (restarting the web service doesn't fix a cron). The external
 * monitor should KEYWORD-match on `"cronsHealthy":true` and alert when it
 * disappears.
 */
export async function GET() {
  // Surfaced for monitoring (audit B3-NF): in production a missing Clerk key
  // means the route guard is inactive (we fail closed in proxy.ts), so flag it.
  const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const authMisconfigured = process.env.NODE_ENV === "production" && !clerkConfigured;
  try {
    await db.$queryRaw`SELECT 1`;
    const now = Date.now();
    const stamps = await db.opsStamp.findMany();
    const crons: Record<string, { at: string | null; stale: boolean }> = {};
    for (const [key, freshMs] of Object.entries(CRON_FRESHNESS_MS)) {
      const stamp = stamps.find((s) => s.key === key);
      crons[key] = {
        at: stamp?.at.toISOString() ?? null,
        // Never-stamped reads as not-stale — a fresh deploy shouldn't page
        // anyone; each cron becomes monitorable after its first tick.
        stale: stamp ? now - stamp.at.getTime() > freshMs : false,
      };
    }
    const cronsHealthy = Object.values(crons).every((c) => !c.stale);
    return NextResponse.json({
      ok: !authMisconfigured,
      db: true,
      clerkConfigured,
      cronsHealthy,
      crons,
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, db: false, clerkConfigured }, { status: 503 });
  }
}
