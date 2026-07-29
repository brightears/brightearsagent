import { NextRequest, NextResponse } from "next/server";
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
export async function GET(req: NextRequest) {
  // Temporary, secret-gated diagnostic for the per-IP rate limiter.
  //
  // lib/rate-limit clientIp() takes the RIGHT-most x-forwarded-for hop, chosen
  // to stop a client spoofing the left-most one. On Render that may instead be
  // Render's own proxy, identical for every visitor — which would make every
  // "per IP" bucket one global bucket, and cap the homepage demo at 5 uses per
  // day for the entire internet. Guessing the header layout is what created the
  // bug; this reads the actual shape from production instead. Gated on
  // CRON_SECRET so it is not a public fingerprinting endpoint, and removed once
  // the limiter is fixed.
  if (req.nextUrl.searchParams.get("diag") && process.env.CRON_SECRET &&
      req.nextUrl.searchParams.get("diag") === process.env.CRON_SECRET) {
    const names = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip", "x-client-ip", "forwarded"];
    const forwarded: Record<string, string | null> = {};
    for (const n of names) forwarded[n] = req.headers.get(n);
    const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((h) => h.trim()).filter(Boolean);
    return NextResponse.json({
      forwarded,
      xffHops: xff,
      hopCount: xff.length,
      currentClientIpWouldBe: xff[xff.length - 1] ?? "unknown",
      leftMostWouldBe: xff[0] ?? "unknown",
    });
  }

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
