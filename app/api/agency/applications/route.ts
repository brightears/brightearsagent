import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { boundedBytes, InquiryError } from "@/lib/agency/inquiry-contract";
import { applicationIssues, applicationSchema, MAX_APPLICATION_BODY, MAX_PHOTO_BYTES, sniffPhotoType } from "@/lib/agency/application-contract";
import { applicationExportAuthorized, pendingArtistApplications, saveArtistApplication, type ApplicationPhoto } from "@/lib/agency/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/** Talent-desk export only. Never public. */
export async function GET(request: Request) {
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try { return NextResponse.json({ applications: await pendingArtistApplications() }, { headers }); }
  catch { return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const allowedOrigin = new URL(process.env.APP_URL || request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== allowedOrigin) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
  const ip = clientIp(request);
  if (!rateLimit(`agency-application-attempt:${ip}`, 10, 3_600_000).ok) {
    return NextResponse.json({ error: "try_later" }, { status: 429, headers: { ...headers, "Retry-After": "3600" } });
  }
  try {
    const type = request.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("multipart/form-data")) throw new InquiryError(415, "multipart_required");
    const body = await boundedBytes(request, MAX_APPLICATION_BODY);
    let form: FormData;
    try { form = await new Response(new Blob([body]), { headers: { "content-type": type } }).formData(); }
    catch { throw new InquiryError(400, "invalid_request"); }
    const payload = form.get("payload");
    if (typeof payload !== "string" || payload.length > 32_768) throw new InquiryError(400, "invalid_request");
    let json: unknown;
    try { json = JSON.parse(payload); } catch { throw new InquiryError(400, "invalid_request"); }
    const parsed = applicationSchema.safeParse(json);
    if (!parsed.success) {
      const issues = applicationIssues(parsed.error);
      return NextResponse.json({ error: issues.some(issue => issue.code === "id_number") ? "id_number" : "invalid_request", fields: [...new Set(issues.map(issue => issue.field))] }, { status: 400, headers });
    }
    let photo: ApplicationPhoto | null = null;
    const file = form.get("photo");
    if (file !== null && typeof file !== "string" && file.size > 0) {
      if (file.size > MAX_PHOTO_BYTES) throw new InquiryError(413, "photo_too_large");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentType = sniffPhotoType(bytes);
      if (!contentType) throw new InquiryError(415, "photo_type");
      photo = { bytes, contentType };
    } else if (typeof file === "string" && file) throw new InquiryError(400, "invalid_request");
    const result = await saveArtistApplication(parsed.data, photo, ip);
    return NextResponse.json({ ok: true, reference: result.reference }, { status: result.duplicate ? 200 : 201, headers });
  } catch (error) {
    const status = error instanceof InquiryError ? error.status : 503;
    const code = error instanceof InquiryError ? error.code : "temporarily_unavailable";
    // No form content, address or database error text in public responses or logs.
    if (!(error instanceof InquiryError)) console.error(JSON.stringify({ kind: "agency_application_failed", at: new Date().toISOString() }));
    return NextResponse.json({ error: code }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "3600" } : {}) } });
  }
}
