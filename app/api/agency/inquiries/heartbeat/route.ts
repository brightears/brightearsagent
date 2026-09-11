import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inquiryWorkerAuthorized } from "@/lib/agency/inquiries";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (!inquiryWorkerAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const stamp = await db.opsStamp.upsert({
      where: { key: "agency:inquiry-worker" }, update: { at: new Date() },
      create: { key: "agency:inquiry-worker", at: new Date() },
    });
    return NextResponse.json({ ok: true, at: stamp.at }, { headers });
  } catch { return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers }); }
}
