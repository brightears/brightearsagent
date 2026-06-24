import { getCurrentBusiness } from "@/lib/tenant";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  uploadsEnabled,
  presignUpload,
  publicUrlFor,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/uploads/r2";

// Mints a short-lived presigned PUT so the browser can upload a profile photo
// DIRECT to R2. Tenant-scoped (Clerk), rate-limited, type/size validated. The
// file bytes never reach this server. Returns 503 until R2 is configured so the
// client knows to fall back to link-paste.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!uploadsEnabled) {
    return Response.json({ error: "uploads-disabled" }, { status: 503 });
  }

  let business;
  try {
    business = await getCurrentBusiness();
  } catch {
    return Response.json({ error: "no-tenant" }, { status: 401 });
  }

  // A real user picks a few photos; this only trips a runaway/abusive client.
  if (!rateLimit(`presign:${business.id}`, 60, 60_000).ok) {
    return Response.json({ error: "rate-limited" }, { status: 429 });
  }

  let body: { contentType?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-json" }, { status: 400 });
  }

  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) {
    return Response.json({ error: "unsupported-type" }, { status: 415 });
  }
  const size = typeof body.size === "number" ? body.size : 0;
  if (size <= 0 || size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "too-large" }, { status: 413 });
  }

  // Tenant-scoped, collision-proof key. The signed URL binds Content-Type, so
  // the client must PUT with exactly this contentType.
  const key = `business/${business.id}/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await presignUpload(key, contentType);
  return Response.json({ uploadUrl, publicUrl: publicUrlFor(key) });
}
