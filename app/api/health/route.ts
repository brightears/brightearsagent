import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  cronCompletionHealth,
  cronDeploymentGraceStartedAt,
} from "@/lib/ops-stamp";
import { validateProductionRuntimeConfig } from "@/lib/production-config";

/**
 * Health check: process up + DB reachable + CRON FRESHNESS (P7.4 — the
 * sequences tick IS the product; a silently-dead cron used to look green
 * everywhere). Used by the Render health check and the external uptime
 * monitor.
 *
 * `ok` is production readiness, not merely process liveness: critical config,
 * the database and cron completion freshness must all be healthy. Returning a
 * real non-2xx matters because both Render and the external monitor judge HTTP
 * status; neither can be assumed to inspect a JSON boolean.
 */
export async function GET() {

  const config = validateProductionRuntimeConfig(process.env);
  const clerkConfigured =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
  try {
    await db.$queryRaw`SELECT 1`;
    const stamps = await db.opsStamp.findMany();
    const crons = cronCompletionHealth(stamps);
    const cronsHealthy = Object.values(crons).every((c) => !c.stale);
    const ready = config.ok && cronsHealthy;
    const publicConfig = {
      ok: config.ok,
      issueCount: config.issues.length,
      issues: config.issues.map(({ key, code }) => ({ key, code })),
    };
    return NextResponse.json(
      {
        ok: ready,
        db: true,
        config: publicConfig,
        clerkConfigured,
        cronsHealthy,
        crons,
        cronGraceStartedAt: cronDeploymentGraceStartedAt().toISOString(),
        ts: new Date().toISOString(),
      },
      // Render judges health by HTTP status, not JSON. A missing critical
      // runtime dependency must therefore block the deploy with a real 503.
      { status: ready ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        db: false,
        config: {
          ok: config.ok,
          issueCount: config.issues.length,
          issues: config.issues.map(({ key, code }) => ({ key, code })),
        },
        clerkConfigured,
      },
      { status: 503 },
    );
  }
}
