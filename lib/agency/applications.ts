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

/**
 * Total photo bytes the site may hold. Photos are deleted as soon as the Talent
 * desk acknowledges an export, so this is effectively the unexported backlog.
 * 100 MB is about 10% of a 1 GB Postgres disk and holds 33 photos at the 3 MB
 * maximum (60 or more at the usual resized size): several weeks of real
 * applications, while one sender can no longer fill the enquiry database.
 * Over the cap, new applications are still saved, without the photo.
 */
export const MAX_STORED_PHOTO_BYTES = 100 * 1024 * 1024;
/** Unexported applications are deleted after this long, so a stopped desk cannot leave data on the site. */
export const UNEXPORTED_RETENTION_MS = 30 * 86_400_000;

export function applicationReference(id: string): string { return `BE-APP-${id}`; }

export type ApplicationPhoto = { bytes: Uint8Array<ArrayBuffer>; contentType: PhotoType };

let openCache: { open: boolean; until: number } | null = null;
/**
 * Cheap pre-check, run before the upload body is read. Cached for a minute so a
 * burst of requests cannot turn into a burst of queries. The transaction in
 * saveArtistApplication re-checks the stamp authoritatively.
 */
export async function applicationsOpen(now = Date.now()): Promise<boolean> {
  if (!inquiryIntakeReady()) return false;
  if (openCache && openCache.until > now) return openCache.open;
  const exporter = await db.opsStamp.findUnique({ where: { key: APPLICATION_EXPORT_STAMP }, select: { at: true } });
  const open = !!exporter && exporter.at.getTime() >= now - APPLICATION_EXPORT_WINDOW_MS;
  openCache = { open, until: now + 60_000 };
  return open;
}

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
    const previous = await tx.artistApplication.findUnique({
      where: { submissionKey: input.submissionKey },
      select: { id: true, requestHash: true, details: true },
    });
    if (previous) {
      if (previous.requestHash !== hash) throw new InquiryError(409, "submission_changed");
      const withheld = !!(previous.details as Record<string, unknown> | null)?.photo_not_stored;
      return { reference: applicationReference(previous.id), duplicate: true, photoStored: !photo || !withheld };
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
    let storedPhoto = photo;
    if (photo) {
      const stored = await tx.artistApplicationPhoto.aggregate({ _sum: { byteSize: true } });
      if ((stored._sum.byteSize ?? 0) + photo.bytes.byteLength > MAX_STORED_PHOTO_BYTES) storedPhoto = null;
    }
    const { consent_age, consent_data, ...details } = input.application;
    const application = await tx.artistApplication.create({ data: {
      submissionKey: input.submissionKey, requestHash: hash, locale: input.locale,
      sourcePath: input.sourcePath || "/join", actType: details.act_type,
      details: {
        ...details,
        ...(photo && !storedPhoto ? { photo_not_stored: "storage_full" } : {}),
        consent: { age: consent_age, data: consent_data, at: new Date(now).toISOString(), locale: input.locale },
      },
      utm: input.utm && Object.keys(input.utm).length ? input.utm : undefined,
      clientHash,
      photo: storedPhoto ? { create: {
        contentType: storedPhoto.contentType, byteSize: storedPhoto.bytes.byteLength, sha256: photoHash!,
        // Shares the upload's memory instead of copying it again.
        bytes: Buffer.from(storedPhoto.bytes.buffer, storedPhoto.bytes.byteOffset, storedPhoto.bytes.byteLength),
      } } : undefined,
    } });
    return { reference: applicationReference(application.id), duplicate: false, photoStored: storedPhoto === photo };
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

/**
 * Marks an application as copied to the Talent desk, drops the network hash and
 * deletes the site's photo copy. The export script only acknowledges after it has
 * written the photo locally and checked its SHA-256, so the desk holds the photo.
 */
export async function acknowledgeArtistApplication(id: string, exportReference: string) {
  return db.$transaction(async tx => {
    const updated = await tx.artistApplication.updateMany({
      where: { id, exportedAt: null },
      data: { exportedAt: new Date(), exportReference, clientHash: null },
    });
    if (!updated.count) {
      const existing = await tx.artistApplication.findUnique({ where: { id }, select: { exportReference: true } });
      if (!existing) throw new InquiryError(404, "not_found");
      if (existing.exportReference !== exportReference) throw new InquiryError(409, "export_changed");
    }
    await tx.artistApplicationPhoto.deleteMany({ where: { applicationId: id } });
    return { acknowledged: true };
  });
}

export async function recordApplicationExport() {
  return db.opsStamp.upsert({
    where: { key: APPLICATION_EXPORT_STAMP }, update: { at: new Date() },
    create: { key: APPLICATION_EXPORT_STAMP, at: new Date() },
  });
}

/** Site copies are kept 30 days after export; the Talent desk holds the 12-month record. */
export const EXPORTED_RETENTION_MS = 30 * 86_400_000;
/**
 * Deletes site copies exported more than 30 days ago, and applications the desk
 * never collected within 30 days. `removed` keeps its original meaning (exported
 * copies) for the export script.
 */
export async function purgeExportedApplications(now = Date.now()) {
  const [removed, unexported] = await db.$transaction([
    db.artistApplication.deleteMany({ where: { exportedAt: { lt: new Date(now - EXPORTED_RETENTION_MS) } } }),
    db.artistApplication.deleteMany({ where: { exportedAt: null, createdAt: { lt: new Date(now - UNEXPORTED_RETENTION_MS) } } }),
  ]);
  return { removed: removed.count, unexportedRemoved: unexported.count };
}

let lastPurge = 0;
/**
 * Runs the purge at most once an hour per process, without blocking the caller.
 * Called from the public upload route and the nightly Render cron so deletion
 * does not depend on the Mac-side export running.
 */
export function purgeApplicationsSoon(now = Date.now()): void {
  if (now - lastPurge < 3_600_000) return;
  lastPurge = now;
  purgeExportedApplications(now).catch(() => {
    lastPurge = 0;
    console.error(JSON.stringify({ kind: "agency_application_purge_failed", at: new Date(now).toISOString() }));
  });
}
