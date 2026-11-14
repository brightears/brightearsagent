import { NextResponse } from "next/server";
import { z } from "zod";
import { applicationExportAuthorized, artistApplicationPhoto } from "@/lib/agency/applications";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
/** Talent-desk export only: the applicant's private photo. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  try {
    const photo = await artistApplicationPhoto(id);
    if (!photo) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
    return new Response(Buffer.from(photo.bytes), { headers: { ...headers, "Content-Type": photo.contentType, "Content-Disposition": "attachment", "X-Content-SHA256": photo.sha256 } });
  } catch { return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers }); }
}
