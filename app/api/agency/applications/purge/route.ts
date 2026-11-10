import { NextResponse } from "next/server";
import { applicationExportAuthorized, purgeExportedApplications } from "@/lib/agency/applications";

/** Deletes site copies exported more than 30 days ago and applications uncollected after 30 days. Talent-desk credential only. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try { return NextResponse.json(await purgeExportedApplications(), { headers }); }
  catch { return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers }); }
}
