import { cataloguePhoto } from "@/lib/agency/catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public photo of a published catalogue profile. Not cached, so an unpublished photo disappears at once. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const photo = await cataloguePhoto({ slug }).catch(() => null);
  if (!photo) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Blob([new Uint8Array(photo.photoBytes)], { type: photo.photoType }), {
    headers: { "Content-Type": photo.photoType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
