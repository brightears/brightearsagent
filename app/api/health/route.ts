import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Health check: process up + DB reachable. Used by Render health checks and uptime monitors. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: false }, { status: 503 });
  }
}
