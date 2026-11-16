import { cataloguePhoto } from "@/lib/agency/catalogue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Photo for a private preview link. Never cached or indexed. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
  const photo = await cataloguePhoto({ token }).catch(() => null);
  if (!photo) return new Response("Not found", { status: 404, headers });
  return new Response(new Blob([new Uint8Array(photo.photoBytes)], { type: photo.photoType }), {
    headers: { ...headers, "Content-Type": photo.photoType, "X-Content-Type-Options": "nosniff" },
  });
}
