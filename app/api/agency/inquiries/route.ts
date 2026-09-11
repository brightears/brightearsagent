import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { boundedJson, InquiryError, inquirySchema } from "@/lib/agency/inquiry-contract";
import { inquiryWorkerAuthorized, pendingAgencyInquiries, saveAgencyInquiry } from "@/lib/agency/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function GET(request: Request) {
  if (!inquiryWorkerAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try { return NextResponse.json({ inquiries: await pendingAgencyInquiries() }, { headers }); }
  catch { return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const allowedOrigin = new URL(process.env.APP_URL || request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== allowedOrigin) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers });
  const ip = clientIp(request);
  if (!rateLimit(`agency-intake-attempt:${ip}`, 20, 600_000).ok) {
    return NextResponse.json({ error: "try_later" }, { status: 429, headers: { ...headers, "Retry-After": "600" } });
  }
  try {
    const parsed = inquirySchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new InquiryError(400, "invalid_request");
    const result = await saveAgencyInquiry(parsed.data, ip);
    return NextResponse.json({ ok: true, reference: result.reference }, { status: result.duplicate ? 200 : 201, headers });
  } catch (error) {
    const status = error instanceof InquiryError ? error.status : 503;
    const code = error instanceof InquiryError ? error.code : "temporarily_unavailable";
    // No form content, address or database error text in public responses/logs.
    if (!(error instanceof InquiryError)) console.error(JSON.stringify({ kind: "agency_intake_failed", at: new Date().toISOString() }));
    return NextResponse.json({ error: code }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "600" } : {}) } });
  }
}
