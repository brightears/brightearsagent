import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { InquiryError } from "@/lib/agency/inquiry-contract";
import { applicationExportAuthorized } from "@/lib/agency/applications";
import { deleteCatalogueProfile, publishCatalogueProfile, rotateCataloguePreview, unpublishCatalogueProfile } from "@/lib/agency/catalogue";
import { appUrlLenient } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
type Context = { params: Promise<{ slug: string }> };

async function body(request: Request): Promise<Record<string, unknown>> {
  try { const value = await request.json(); return value && typeof value === "object" ? value : {}; } catch { return {}; }
}
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 300) : "";
const refresh = (slug: string) => { revalidatePath("/artists"); revalidatePath(`/artists/${slug}`); };
const fail = (error: unknown) => error instanceof InquiryError
  ? NextResponse.json({ error: error.code }, { status: error.status, headers })
  : NextResponse.json({ error: "temporarily_unavailable" }, { status: 503, headers });

/** Desk only. `{ "action": "publish", "confirmation": "..." }`, `{ "action": "unpublish", "reason": "..." }` or `{ "action": "preview" }`. */
export async function POST(request: Request, { params }: Context) {
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const { slug } = await params;
  const input = await body(request);
  try {
    if (input.action === "publish") { const result = await publishCatalogueProfile(slug, text(input.confirmation)); refresh(slug); return NextResponse.json(result, { headers }); }
    if (input.action === "unpublish") { const result = await unpublishCatalogueProfile(slug, text(input.reason)); refresh(slug); return NextResponse.json(result, { headers }); }
    if (input.action === "preview") {
      const result = await rotateCataloguePreview(slug);
      return NextResponse.json({ ...result, previewUrl: `${appUrlLenient()}/artists/preview/${result.previewToken}` }, { headers });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400, headers });
  } catch (error) { return fail(error); }
}

/** Desk only: deletes the profile and photo. `{ "reason": "..." }` is logged. */
export async function DELETE(request: Request, { params }: Context) {
  if (!applicationExportAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const { slug } = await params;
  try { const result = await deleteCatalogueProfile(slug, text((await body(request)).reason)); refresh(slug); return NextResponse.json(result, { headers }); }
  catch (error) { return fail(error); }
}
