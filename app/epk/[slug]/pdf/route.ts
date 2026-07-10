import { db } from "@/lib/db";
import { renderPressKitForBusiness } from "@/lib/pdf/build";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Public press-kit PDF — the printable twin of /epk/[slug]. Same white-label
// invariant: the artist's document, zero Bright Ears branding. Gated on
// epkEnabled like the EPK page.
//
// 14.2: this render costs real CPU (react-pdf) and fetches the artist's
// photos — a public URL someone can hammer. Per-IP+slug rate limit, a small
// in-process render cache (10 min TTL, LRU-ish cap), and a public
// Cache-Control so CDNs/browsers absorb repeat views.

export const dynamic = "force-dynamic";

const PDF_CACHE_TTL_MS = 10 * 60 * 1000;
const PDF_CACHE_MAX = 50;
const pdfCache = new Map<string, { pdf: Buffer; at: number }>();

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const ip = clientIp(req);
  const rl = rateLimit(`epk-pdf:${slug}:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  const business = await db.business.findUnique({ where: { slug } });
  if (!business || !business.epkEnabled) {
    return new Response("Not found", { status: 404 });
  }

  const cached = pdfCache.get(slug);
  let pdf: Buffer;
  if (cached && Date.now() - cached.at < PDF_CACHE_TTL_MS) {
    pdf = cached.pdf;
  } else {
    try {
      pdf = await renderPressKitForBusiness(business);
    } catch {
      // Match the send path's graceful degradation — never a raw 500.
      return new Response("Press kit unavailable", { status: 503 });
    }
    pdfCache.set(slug, { pdf, at: Date.now() });
    if (pdfCache.size > PDF_CACHE_MAX) {
      const oldest = [...pdfCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) pdfCache.delete(oldest[0]);
    }
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}-press-kit.pdf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
