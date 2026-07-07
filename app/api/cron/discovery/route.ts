import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDiscoveryScan } from "@/lib/discovery/scan";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { stampCron } from "@/lib/ops-stamp";
import { reportError } from "@/lib/report-error";

export const maxDuration = 300;

/**
 * Daily venue-discovery scan (Phase 10.2b). Gated by CRON_SECRET. Iterates
 * every tenant with a HOME BASE (service cities) OR an ACTIVE travel window
 * (Travel Mode — a tenant may hunt a travel city with no home base); the 20h
 * budget guard inside runDiscoveryScan is the v1 throttle (cap/cadence differs
 * by tier later). Sequential with per-tenant isolation: one tenant's failure
 * never blocks the rest.
 */
export async function GET(req: NextRequest) {
  if (!checkSharedSecret(process.env.CRON_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await stampCron("cron:discovery");

  const businesses = await db.business.findMany({
    where: {
      OR: [
        { serviceCities: { isEmpty: false } },
        { travelWindows: { some: { status: "ACTIVE" } } },
      ],
    },
    select: { id: true, slug: true },
  });

  const results: Array<{
    slug: string;
    ran: boolean;
    reason?: string;
    venuesCreated?: number;
    venuesUpdated?: number;
    contactsFound?: number;
    serperQueries?: number;
    error?: string;
  }> = [];

  for (const b of businesses) {
    try {
      const scan = await runDiscoveryScan(b.id);
      results.push({
        slug: b.slug,
        ran: scan.ran,
        ...(scan.reason ? { reason: scan.reason } : {}),
        ...(scan.ran
          ? {
              venuesCreated: scan.metros.reduce((n, m) => n + m.created, 0),
              venuesUpdated: scan.metros.reduce((n, m) => n + m.updated, 0),
              contactsFound: scan.contacts?.found.length ?? 0,
              serperQueries: scan.serperQueries,
            }
          : {}),
      });
    } catch (err) {
      void reportError(err, { kind: "discovery-scan", businessId: b.id });
      results.push({ slug: b.slug, ran: false, error: String(err) });
    }
  }

  return NextResponse.json({ tenants: businesses.length, results });
}
