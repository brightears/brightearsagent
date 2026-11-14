import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { InquiryError } from "@/lib/agency/inquiry-contract";
import { applicationIssues, applicationSchema, MAX_APPLICATION_BODY, MAX_PHOTO_BYTES, sniffPhotoType } from "@/lib/agency/application-contract";
import {
  applicationExportAuthorized, applicationsOpen, pendingArtistApplications, purgeApplicationsSoon, saveArtistApplication,
  type ApplicationPhoto,
} from "@/lib/agency/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/** Uploads parsed at the same time, per process. A Starter instance has 512 MB. */
const MAX_CONCURRENT_UPLOADS = 3;
let activeUploads = 0;
const activeAddresses = new Set<string>();

/** Talent-desk export only. Never public. */
export async function GET(request: Request) {
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try { return NextResponse.json({ applications: await pendingArtistApplications() }, { headers }); }
  catch { return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers }); }
}

/** The request body, stopped as soon as it passes `max` bytes. */
function limitedBody(request: Request, max: number) {
  const state = { bytes: 0, overflow: false };
  const stream = request.body!.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      state.bytes += chunk.byteLength;
      if (state.bytes > max) { state.overflow = true; controller.error(new InquiryError(413, "body_too_large")); }
      else controller.enqueue(chunk);
    },
  }));
  return { stream, state };
}

const refuse = (status: number, error: string, retryAfter?: number) =>
  NextResponse.json({ error }, { status, headers: { ...headers, ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } });

export async function POST(request: Request) {
  // Everything that can refuse a request runs before a byte of the body is read.
  const allowedOrigin = new URL(process.env.APP_URL || request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== allowedOrigin) return refuse(403, "invalid_origin");
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data") || !request.body) return refuse(415, "multipart_required");
  const declared = request.headers.get("content-length");
  if (declared && !(Number(declared) <= MAX_APPLICATION_BODY)) return refuse(413, "body_too_large");
  const ip = clientIp(request);
  if (!rateLimit(`agency-application-attempt:${ip}`, 6, 3_600_000).ok) return refuse(429, "try_later", 3600);
  purgeApplicationsSoon();
  try { if (!(await applicationsOpen())) return refuse(503, "temporarily_unavailable"); }
  catch { return refuse(503, "temporarily_unavailable"); }
  if (activeUploads >= MAX_CONCURRENT_UPLOADS || activeAddresses.has(ip)) return refuse(503, "busy", 30);

  activeUploads++; activeAddresses.add(ip);
  try {
    const body = limitedBody(request, MAX_APPLICATION_BODY);
    let form: FormData;
    try { form = await new Response(body.stream, { headers: { "content-type": type } }).formData(); }
    catch { throw body.state.overflow ? new InquiryError(413, "body_too_large") : new InquiryError(400, "invalid_request"); }
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
    return NextResponse.json(
      { ok: true, reference: result.reference, ...(photo && !result.photoStored ? { photo: "not_stored" } : {}) },
      { status: result.duplicate ? 200 : 201, headers },
    );
  } catch (error) {
    const status = error instanceof InquiryError ? error.status : 503;
    const code = error instanceof InquiryError ? error.code : "temporarily_unavailable";
    // No form content, address or database error text in public responses or logs.
    if (!(error instanceof InquiryError)) console.error(JSON.stringify({ kind: "agency_application_failed", at: new Date().toISOString() }));
    return refuse(status, code, status === 429 ? 3600 : undefined);
  } finally {
    activeUploads--; activeAddresses.delete(ip);
  }
}
