import { createHash, createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { InquiryError } from "./inquiry-contract";
import { inquiryIntakeReady, inquiryWorkerAuthorized } from "./inquiries";
import type { ArtistApplicationInput, PhotoType } from "./application-contract";

// The Talent desk pulls applications with the same Mac-side Bearer credential as
// the enquiry worker (AGENCY_INQUIRY_TOKEN). Applications never enter the
// enquiry queue, so the hourly Vinyl handoff is unchanged.
export const applicationExportAuthorized = inquiryWorkerAuthorized;
export const APPLICATION_EXPORT_STAMP = "agency:application-export";
/** The form closes when no export has succeeded for this long, so nobody applies into an unread queue. */
export const APPLICATION_EXPORT_WINDOW_MS = 8 * 86_400_000;

export function applicationReference(id: string): string { return `BE-APP-${id}`; }

export type ApplicationPhoto = { bytes: Uint8Array; contentType: PhotoType };

export async function saveArtistApplication(input: ArtistApplicationInput, photo: ApplicationPhoto | null, ip: string) {
  if (!inquiryIntakeReady()) throw new InquiryError(503, "temporarily_unavailable");
  if (input.website) throw new InquiryError(400, "invalid_request");
  const photoHash = photo ? createHash("sha256").update(photo.bytes).digest("hex") : null;
  const hash = createHash("sha256").update(JSON.stringify({
    locale: input.locale, application: input.application, photo: photoHash,
  })).digest("hex");
  const clientHash = createHmac("sha256", process.env.AGENCY_INQUIRY_TOKEN!)
    .update(`agency-application:${ip}`).digest("hex");

  return db.$transaction(async tx => {
    // Separate lock from enquiries: applications never block a buyer brief.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(783441103)`;
    const previous = await tx.artistApplication.findUnique({ where: { submissionKey: input.submissionKey } });
    if (previous) {
      if (previous.requestHash !== hash) throw new InquiryError(409, "submission_changed");
      return { reference: applicationReference(previous.id), duplicate: true };
    }
    const exporter = await tx.opsStamp.findUnique({ where: { key: APPLICATION_EXPORT_STAMP } });
    if (!exporter || exporter.at.getTime() < Date.now() - APPLICATION_EXPORT_WINDOW_MS) {
      throw new InquiryError(503, "temporarily_unavailable");
    }
    const now = Date.now();
    const [recent, daily] = await Promise.all([
      tx.artistApplication.count({ where: { clientHash, createdAt: { gte: new Date(now - 3_600_000) } } }),
      tx.artistApplication.count({ where: { createdAt: { gte: new Date(now - 86_400_000) } } }),
    ]);
    if (recent >= 3 || daily >= 50) throw new InquiryError(429, "try_later");
    const { consent_age, consent_data, ...details } = input.application;
    const application = await tx.artistApplication.create({ data: {
      submissionKey: input.submissionKey, requestHash: hash, locale: input.locale,
      sourcePath: input.sourcePath || "/join", actType: details.act_type,
      details: { ...details, consent: { age: consent_age, data: consent_data, at: new Date(now).toISOString(), locale: input.locale } },
      utm: input.utm && Object.keys(input.utm).length ? input.utm : undefined,
      clientHash,
      photo: photo ? { create: { contentType: photo.contentType, byteSize: photo.bytes.byteLength, sha256: photoHash!, bytes: Buffer.from(photo.bytes) } } : undefined,
    } });
    return { reference: applicationReference(application.id), duplicate: false };
  });
}

export async function pendingArtistApplications() {
  const applications = await db.artistApplication.findMany({
    where: { exportedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 25,
    select: {
      id: true, createdAt: true, locale: true, sourcePath: true, actType: true, details: true, utm: true, status: true,
      photo: { select: { contentType: true, byteSize: true, sha256: true } },
    },
  });
  return applications.map(application => ({ ...application, reference: applicationReference(application.id) }));
}

export async function artistApplicationPhoto(id: string) {
  return db.artistApplicationPhoto.findUnique({ where: { applicationId: id }, select: { contentType: true, bytes: true, sha256: true } });
}

/** Marks an application as copied to the Talent desk and drops the network hash. */
export async function acknowledgeArtistApplication(id: string, exportReference: string) {
  const updated = await db.artistApplication.updateMany({
    where: { id, exportedAt: null },
    data: { exportedAt: new Date(), exportReference, clientHash: null },
  });
  if (updated.count) return { acknowledged: true };
  const existing = await db.artistApplication.findUnique({ where: { id }, select: { exportReference: true } });
  if (!existing) throw new InquiryError(404, "not_found");
  if (existing.exportReference !== exportReference) throw new InquiryError(409, "export_changed");
  return { acknowledged: true };
}

export async function recordApplicationExport() {
  return db.opsStamp.upsert({
    where: { key: APPLICATION_EXPORT_STAMP }, update: { at: new Date() },
    create: { key: APPLICATION_EXPORT_STAMP, at: new Date() },
  });
}

/** Site copies are kept 30 days after export; the Talent desk holds the 12-month record. */
export const EXPORTED_RETENTION_MS = 30 * 86_400_000;
export async function purgeExportedApplications(now = Date.now()) {
  const removed = await db.artistApplication.deleteMany({ where: { exportedAt: { lt: new Date(now - EXPORTED_RETENTION_MS) } } });
  return { removed: removed.count };
}
