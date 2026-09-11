import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { InquiryError, type AgencyInquiryInput } from "./inquiry-contract";

export function inquiryWorkerAuthorized(request: Request): boolean {
  const token = process.env.AGENCY_INQUIRY_TOKEN?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!token || token.length < 32) return false;
  const actual = Buffer.from(supplied), expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function inquiryIntakeReady(): boolean {
  return (process.env.AGENCY_INQUIRY_TOKEN?.trim().length ?? 0) >= 32;
}

export function inquiryReference(id: string): string { return `BE-${id}`; }

export async function saveAgencyInquiry(input: AgencyInquiryInput, ip: string) {
  if (!inquiryIntakeReady()) throw new InquiryError(503, "temporarily_unavailable");
  if (input.website) throw new InquiryError(400, "invalid_request");
  const hash = createHash("sha256").update(JSON.stringify({
    locale: input.locale, source: input.source, brief: input.brief,
  })).digest("hex");
  const clientHash = createHmac("sha256", process.env.AGENCY_INQUIRY_TOKEN!)
    .update(`agency-intake:${ip}`).digest("hex");

  return db.$transaction(async tx => {
    // Very low-volume intake: one database lock makes duplicate and shared
    // limits consistent across retries, concurrent requests and restarts.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(783441102)`;
    const previous = await tx.agencyInquiry.findUnique({ where: { submissionKey: input.submissionKey } });
    if (previous) {
      if (previous.requestHash !== hash) throw new InquiryError(409, "submission_changed");
      return { reference: inquiryReference(previous.id), duplicate: true };
    }
    const worker = await tx.opsStamp.findUnique({ where: { key: "agency:inquiry-worker" } });
    if (!worker || worker.at.getTime() < Date.now() - 3 * 3_600_000) {
      throw new InquiryError(503, "temporarily_unavailable");
    }
    const now = Date.now();
    const [recent, daily] = await Promise.all([
      tx.agencyInquiry.count({ where: { clientHash, createdAt: { gte: new Date(now - 600_000) } } }),
      tx.agencyInquiry.count({ where: { createdAt: { gte: new Date(now - 86_400_000) } } }),
    ]);
    if (recent >= 5 || daily >= 100) throw new InquiryError(429, "try_later");
    const inquiry = await tx.agencyInquiry.create({ data: {
      submissionKey: input.submissionKey, requestHash: hash,
      locale: input.locale, source: input.source, brief: input.brief, clientHash,
    } });
    return { reference: inquiryReference(inquiry.id), duplicate: false };
  });
}

export async function pendingAgencyInquiries() {
  const inquiries = await db.agencyInquiry.findMany({
    where: { acknowledgedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 25,
    select: { id: true, createdAt: true, locale: true, source: true, brief: true },
  });
  return inquiries.map(inquiry => ({ ...inquiry, reference: inquiryReference(inquiry.id) }));
}

export async function acknowledgeAgencyInquiry(id: string, handoffReference: string) {
  const updated = await db.agencyInquiry.updateMany({
    where: { id, acknowledgedAt: null },
    data: { acknowledgedAt: new Date(), handoffReference },
  });
  if (updated.count) return { acknowledged: true };
  const existing = await db.agencyInquiry.findUnique({ where: { id }, select: { handoffReference: true } });
  if (!existing) throw new InquiryError(404, "not_found");
  if (existing.handoffReference !== handoffReference) throw new InquiryError(409, "handoff_changed");
  return { acknowledged: true };
}
