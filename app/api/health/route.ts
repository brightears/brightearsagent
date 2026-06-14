import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Health check: process up + DB reachable. Used by Render health checks and uptime monitors. */
export async function GET() {
  // Surfaced for monitoring (audit B3-NF): in production a missing Clerk key
  // means the route guard is inactive (we fail closed in proxy.ts), so flag it.
  const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const authMisconfigured = process.env.NODE_ENV === "production" && !clerkConfigured;
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: !authMisconfigured,
      db: true,
      clerkConfigured,
      ts: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, db: false, clerkConfigured }, { status: 503 });
  }
}
