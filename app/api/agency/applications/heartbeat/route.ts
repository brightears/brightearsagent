import { NextResponse } from "next/server";
import { applicationExportAuthorized, recordApplicationExport } from "@/lib/agency/applications";

/** Called by the Talent-desk export after a drained batch; keeps /join open. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const stamp = await recordApplicationExport();
    return NextResponse.json({ ok: true, at: stamp.at }, { headers });
  } catch { return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers }); }
}
