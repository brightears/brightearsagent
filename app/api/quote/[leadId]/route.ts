import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { renderQuotationForLead } from "@/lib/pdf/build";

// Owner-only quotation PDF for a lead — has client info + a price, so it is
// auth-gated and tenant-scoped (you can only quote your OWN leads). The quote is
// grounded in the artist's pricing; 422 when there's nothing to quote from.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;

  let business;
  try {
    business = await getCurrentBusiness();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const lead = await db.lead.findFirst({ where: { id: leadId, businessId: business.id } });
  if (!lead) return new Response("Not found", { status: 404 });

  const packages = await db.package.findMany({ where: { businessId: business.id, active: true } });
  const pdf = await renderQuotationForLead(lead, { ...business, packages });
  if (!pdf) {
    return new Response(
      "No pricing to quote from yet — set a one-off floor or add a package in your profile.",
      { status: 422 },
    );
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${leadId.slice(-6)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
