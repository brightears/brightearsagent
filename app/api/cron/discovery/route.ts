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
 *
 * The 100-tenant fix (P7.8): tenants are served LEAST-RECENTLY-SCANNED FIRST
 * (nulls first — new tenants jump the queue) under a wall-clock budget.
 * `maxDuration` is a Vercel-only export that Render ignores, so the budget is
 * enforced in code; anyone cut off today is at the FRONT of tomorrow's queue
 * by construction — no tenant can be tail-starved twice.
 */
const TICK_BUDGET_MS = 240_000; // headroom under the 300s platform ceiling

export async function GET(req: NextRequest) {
  if (!checkSharedSecret(process.env.CRON_SECRET, providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await stampCron("cron:discovery");
  const startedAt = Date.now();

  const businesses = await db.business.findMany({
    where: {
      OR: [
        { serviceCities: { isEmpty: false } },
        { travelWindows: { some: { status: "ACTIVE" } } },
      ],
    },
    orderBy: { lastDiscoveryScanAt: { sort: "asc", nulls: "first" } },
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

  let cutOff = 0;
  for (const b of businesses) {
    if (Date.now() - startedAt > TICK_BUDGET_MS) {
      // Out of budget — the rest are first in line tomorrow (LRU ordering).
      cutOff = businesses.length - results.length;
      console.log(
        JSON.stringify({ level: "info", kind: "discovery-budget", cutOff, ts: new Date().toISOString() }),
      );
      break;
    }
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

  return NextResponse.json({ tenants: businesses.length, cutOff, results });
}
