import { getAgencyRoster } from "@/lib/agency/roster";
import { buildPromotionKitArchive } from "@/lib/agency/promotion-kit-archive";
import { isPublicArtistId } from "@/lib/agency/promotion-kit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isPublicArtistId(id)) return Response.json({ error: "Artist not found." }, { status: 404, headers });
  const roster = await getAgencyRoster();
  if (!roster.length) return Response.json({ error: "Artist materials are temporarily unavailable. Please try again." }, { status: 503, headers });
  const artist = roster.find(item => item.id === id);
  if (!artist) return Response.json({ error: "Artist not found." }, { status: 404, headers });
  try {
    const archive = await buildPromotionKitArchive(artist);
    return new Response(new Uint8Array(archive.bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archive.filename}"`,
        "Content-Length": String(archive.bytes.byteLength),
      },
    });
  } catch {
    return Response.json({ error: "The download is temporarily unavailable. Please try again or use the individual files on the kit page." }, { status: 503, headers });
  }
}
