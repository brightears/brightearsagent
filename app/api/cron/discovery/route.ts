import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDiscoveryScan } from "@/lib/discovery/scan";
import { autoDraftPitches } from "@/lib/venues/auto-draft";
import { draftHotFollowUps } from "@/lib/venues/follow-up";
import { rescoreVenues } from "@/lib/venues/rescore";
import { notifyBusiness } from "@/lib/notify";
import { checkSharedSecret, providedSecret } from "@/lib/auth-secret";
import { stampCronCompletion } from "@/lib/ops-stamp";
import { reportError } from "@/lib/report-error";
import { normalizeLocale } from "@/lib/i18n/config";
import { translator } from "@/lib/i18n/messages";

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
    pitchesDrafted?: number;
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
      const venuesCreated = scan.ran ? scan.metros.reduce((n, m) => n + m.created, 0) : 0;

      // The agent ACTS (P8.1): after the scan, draft pitches for the best
      // contactable venues up to the same daily caps the manual button obeys.
      // Then the morning digest (P8.2) — ONLY when something actually
      // happened (no digests on empty days; that's product law).
      let pitchesDrafted = 0;
      const business = await db.business.findUnique({ where: { id: b.id } });
      if (business) {
        // Feed hygiene BEFORE drafting (P8.8/8.9): re-score the live feed from
        // stored signals (pure functions, DB-only) so stale HOT cards arc to
        // WARM, timing decays honestly, and the skip-taught kind downweights
        // apply — auto-draft below then picks from FRESH scores. This pass
        // also normalizes anything ingest scored before the training signal.
        await rescoreVenues(b.id);
        const drafted = await autoDraftPitches(business);
        // The one polite HOT bump (P8.4) rides the same daily tick — its
        // drafts join the approve queue and the digest below.
        const bumps = await draftHotFollowUps(business);
        pitchesDrafted = drafted.created + bumps.drafted;
        if (pitchesDrafted > 0 || venuesCreated > 0) {
          const locale = normalizeLocale(business.locale);
          const t = translator(locale);
          const pendingPitches = await db.venuePitch.count({
            where: { businessId: b.id, status: "PENDING" },
          });
          const parts = [
            pendingPitches > 0
              ? t("notification.pitchesReady", { count: pendingPitches })
              : null,
            venuesCreated > 0
              ? t("notification.venuesFound", { count: venuesCreated })
              : null,
          ].filter(Boolean);
          void notifyBusiness(business, {
            title: t("notification.overnight"),
            body: parts.join(" · "),
            url: "/dashboard",
            emailBody: locale === "th"
              ? `ระหว่างที่คุณพัก ผู้ช่วยค้นหาสถานที่ในเมืองของคุณ\n\n${parts.join("\n")}\n\nแต่ละข้อความเขียนด้วยสำนวนของคุณและรอการอนุมัติ`
              : `While you were away, the Hunt ran your cities.\n\n${parts.join("\n")}\n\nEach pitch is drafted in your voice and waiting for one tap.`,
          }).catch(() => null);
        }
      }

      results.push({
        slug: b.slug,
        ran: scan.ran,
        ...(scan.reason ? { reason: scan.reason } : {}),
        ...(scan.ran
          ? {
              venuesCreated,
              venuesUpdated: scan.metros.reduce((n, m) => n + m.updated, 0),
              contactsFound: scan.contacts?.found.length ?? 0,
              serperQueries: scan.serperQueries,
              pitchesDrafted,
            }
          : { pitchesDrafted }),
      });
    } catch (err) {
      void reportError(err, { kind: "discovery-scan", businessId: b.id });
      results.push({ slug: b.slug, ran: false, error: String(err) });
    }
  }

  const errors = results.filter((result) => !!result.error).length;
  const noTenantCompleted =
    businesses.length > 0 && (results.length === 0 || errors === results.length);
  const payload = { tenants: businesses.length, cutOff, errors, results };

  // Isolation is valuable only while at least one tenant completed or made an
  // expected no-op decision. If every attempted tenant crashed (or the budget
  // elapsed before the first tenant), this is a provider/systemic failure: a
  // 2xx + fresh stamp would hide a dead Hunt from both Render and monitoring.
  if (noTenantCompleted) {
    return NextResponse.json(
      { ...payload, error: "No tenant discovery workload completed" },
      { status: 503 },
    );
  }

  await stampCronCompletion("cron:discovery");
  return NextResponse.json(payload);
}
