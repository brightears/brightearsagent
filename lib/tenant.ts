import { db } from "@/lib/db";

/**
 * Tenant resolution. Dev mode (no Clerk keys): the seeded demo business.
 * Phase 3 Clerk item replaces the body with session→Member→Business lookup;
 * every page/action calls this, so the swap is one function.
 */
export async function getCurrentBusiness() {
  const business = await db.business.findFirst({
    where: { slug: process.env.DEV_TENANT_SLUG ?? "demo-dj-co" },
  });
  if (!business) throw new Error("No tenant — run `npm run db:seed`");
  return business;
}
