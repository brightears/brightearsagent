import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { InquiryError } from "@/lib/agency/inquiry-contract";
import { applicationExportAuthorized } from "@/lib/agency/applications";
import { catalogueProfileSchema, listCatalogueProfiles, readCataloguePhoto, upsertCatalogueProfile } from "@/lib/agency/catalogue";
import { getAgencyRoster } from "@/lib/agency/roster";
import { appUrlLenient } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
const fail = (error: unknown) => {
  if (error instanceof InquiryError) return NextResponse.json({ error: error.code }, { status: error.status, headers });
  console.error(JSON.stringify({ kind: "agency_catalogue_failed", at: new Date().toISOString() }));
  return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers });
};

/** Desk only: every catalogue profile and the latest logged actions. */
export async function GET(request: Request) {
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try { return NextResponse.json(await listCatalogueProfiles(), { headers }); } catch (error) { return fail(error); }
}

/**
 * Desk only: create or update a draft from a consented application.
 * multipart/form-data: `payload` (JSON, catalogueProfileSchema) and `photo` (the artist's own upload).
 */
export async function POST(request: Request) {
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) throw new InquiryError(415, "multipart_required");
    let form: FormData;
    try { form = await request.formData(); } catch { throw new InquiryError(400, "invalid_request"); }
    const payload = form.get("payload");
    let json: unknown;
    try { json = JSON.parse(typeof payload === "string" ? payload : ""); } catch { throw new InquiryError(400, "invalid_request"); }
    const parsed = catalogueProfileSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_profile", issues: parsed.error.issues.map(issue => ({ field: issue.path.join("."), code: issue.message })) }, { status: 400, headers });
    }
    const file = form.get("photo");
    const photo = await readCataloguePhoto(file instanceof File ? file : null);
    const rosterIds = (await getAgencyRoster()).map(artist => artist.id);
    const result = await upsertCatalogueProfile(parsed.data, photo, rosterIds);
    if (result.status === "published") { revalidatePath("/artists"); revalidatePath(`/artists/${result.slug}`); }
    return NextResponse.json({
      ...result,
      previewUrl: result.previewToken ? `${appUrlLenient()}/artists/preview/${result.previewToken}` : null,
    }, { status: result.previewToken ? 201 : 200, headers });
  } catch (error) { return fail(error); }
}
