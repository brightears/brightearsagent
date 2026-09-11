import { NextResponse } from "next/server";
import { z } from "zod";
import { acknowledgeAgencyInquiry, inquiryWorkerAuthorized } from "@/lib/agency/inquiries";
import { boundedJson, InquiryError } from "@/lib/agency/inquiry-contract";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!inquiryWorkerAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new InquiryError(400, "invalid_request");
    const body = z.object({ handoffReference: z.string().trim().min(1).max(200) }).strict().safeParse(await boundedJson(request, 1024));
    if (!body.success) throw new InquiryError(400, "invalid_request");
    return NextResponse.json(await acknowledgeAgencyInquiry(id, body.data.handoffReference), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof InquiryError ? error.code : "temporarily_unavailable" },
      { status: error instanceof InquiryError ? error.status : 503, headers });
  }
}
