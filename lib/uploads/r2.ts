// Cloudflare R2 image uploads (June 2026). Browser uploads go DIRECT to the
// bucket via a short-lived presigned PUT — the bytes never touch this server
// (Render's filesystem is ephemeral, and proxying files would waste its
// memory/CPU). This module only mints signed URLs and resolves public URLs.
//
// DARK BY DEFAULT: `uploadsEnabled` is false until all five R2_* env vars are
// set, so the whole feature ships safely and lights up the moment the founder
// pastes credentials — no broken UI in between.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_BASE_URL;

/** True only when R2 is fully configured. The UI gates on this server-side. */
export const uploadsEnabled = Boolean(
  accountId && accessKeyId && secretAccessKey && bucket && publicBase,
);

// Re-export the client-safe limits so the presign route has one import.
export { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads/limits";

let client: S3Client | null = null;
function r2(): S3Client {
  if (!uploadsEnabled) throw new Error("R2 uploads are not configured");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return client;
}

/** A short-lived signed PUT URL the browser uploads the file to directly. */
export async function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket!, Key: key, ContentType: contentType }),
    { expiresIn: 60 },
  );
}

/** The public URL the EPK/profile renders, from the object key. */
export function publicUrlFor(key: string): string {
  return `${publicBase!.replace(/\/$/, "")}/${key}`;
}
