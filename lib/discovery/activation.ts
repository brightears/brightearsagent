import { after } from "next/server";
import { runDiscoveryScan } from "@/lib/discovery/scan";
import { reportError } from "@/lib/report-error";

/**
 * Kick a discovery scan the moment a tenant becomes huntable — first home
 * city saved, or the Stripe webhook flips them onto a paid plan. Day one IS
 * the trial under subscribe-to-activate; "check back after tomorrow's 05:00
 * UTC cron" is where churn is born.
 *
 * Runs via next/server `after` so the response (wizard step, webhook 2xx)
 * never waits on Serper. `force` bypasses the 20h budget stamp — reserve it
 * for genuine activation moments (both call sites are once-per-tenant-ish and
 * cost real money to repeat). The scan's own guards still apply: unsubscribed
 * tenants and tenants with no cities are refused inside runDiscoveryScan, so
 * this can never spend on free users.
 *
 * Outside a request scope (unit tests, scripts) `after` throws — we skip
 * quietly there; tests and scripts invoke runDiscoveryScan directly when they
 * mean it, and the daily cron remains the backstop in production.
 */
export function scheduleActivationScan(businessId: string, opts: { force?: boolean } = {}) {
  try {
    after(() =>
      runDiscoveryScan(businessId, { force: opts.force }).catch((err) =>
        reportError(err, { kind: "activation-scan", businessId }),
      ),
    );
  } catch {
    // No request scope — nothing to schedule against; the cron covers it.
  }
}
