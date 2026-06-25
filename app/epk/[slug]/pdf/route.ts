import { db } from "@/lib/db";
import { renderPressKitForBusiness } from "@/lib/pdf/build";

// Public press-kit PDF — the printable twin of /epk/[slug]. Same white-label
// invariant: the artist's document, zero Bright Ears branding. Gated on
// epkEnabled like the EPK page.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const business = await db.business.findUnique({ where: { slug } });
  if (!business || !business.epkEnabled) {
    return new Response("Not found", { status: 404 });
  }

  const pdf = await renderPressKitForBusiness(business);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}-press-kit.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
