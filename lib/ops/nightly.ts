import Stripe from "stripe";
import { buildUnroutedReport, clearUnrouted, type UnroutedReport } from "@/lib/inbound/unrouted";
import { db } from "@/lib/db";
import { stripe, stripeEnabled, planForLookupKey } from "@/lib/billing/stripe";
import { reportError } from "@/lib/report-error";
import { staleCronKeys } from "@/lib/ops-stamp";
import {
  computeHuntQuality,
  renderHuntQualityText,
  type HuntQualitySummary,
} from "@/lib/reports/hunt-quality";

/**
 * Nightly ops pass — rides the existing daily margin-guardrail cron (no new
 * Render jobs needed).
 *
 * P7.11 Stripe reconciliation: webhooks are the single thread holding plan
 * truth, and two desync classes have already been found and fixed (June S1-S6,
 * July orphan/resurrection guards). This sweep diffs Stripe's CURRENT state
 * against Business rows and self-heals: cheap insurance nobody has to watch.
 *
 * P7.12 heartbeat digest: a solo founder won't watch dashboards. One nightly
 * email proves the machine ran and makes anomalies (zero drafts yesterday, a
 * stale cron) jump out. This is the FOUNDER's ops line — the no-empty-digest
 * rule governs customer notifications, not this.
 */

const LIVE = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

export type ReconcileResult = {
  checked: number;
  failed: number;
  /** False only when reconciliation was globally incomplete, not one tenant. */
  complete: boolean;
  healed: string[];
  issues: string[];
};

export async function reconcileStripe(): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    checked: 0,
    failed: 0,
    complete: true,
    healed: [],
    issues: [],
  };
  if (!stripeEnabled) return result;

  // Pass 1: every Business that thinks it's subscribed — verify with Stripe.
  const subscribed = await db.business.findMany({
    where: { stripeSubscriptionId: { not: null } },
    select: { id: true, slug: true, plan: true, stripeSubscriptionId: true },
  });
  for (const b of subscribed) {
    result.checked++;
    try {
      const sub = await stripe().subscriptions.retrieve(b.stripeSubscriptionId!);
      if (!LIVE.has(sub.status)) {
        await db.business.update({
          where: { id: b.id },
          data: { plan: "TRIAL", stripeSubscriptionId: null, trialEndsAt: null },
        });
        result.healed.push(`${b.slug}: sub ${sub.id} is ${sub.status} → paused`);
      } else {
        const plan = planForLookupKey(sub.items.data[0]?.price?.lookup_key);
        if (plan && plan !== b.plan) {
          await db.business.update({ where: { id: b.id }, data: { plan } });
          result.healed.push(`${b.slug}: plan ${b.plan} → ${plan} (Stripe is truth)`);
        }
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "resource_missing") {
        await db.business.update({
          where: { id: b.id },
          data: { plan: "TRIAL", stripeSubscriptionId: null, trialEndsAt: null },
        });
        result.healed.push(`${b.slug}: sub missing in Stripe → paused`);
      } else {
        result.failed++;
        result.issues.push(`${b.slug}: reconcile error ${String(err).slice(0, 120)}`);
      }
    }
  }

  if (result.checked > 0 && result.failed === result.checked) {
    result.complete = false;
  }

  // Pass 2: live Stripe subs whose tenant row doesn't claim them (missed
  // webhook). metadata.businessId is set at checkout, so re-attach is exact.
  try {
    const subs = await stripe().subscriptions.list({ status: "active", limit: 100 });
    if (subs.has_more) {
      result.complete = false;
      result.issues.push("more than 100 active subscriptions — extend reconciliation paging");
    }
    for (const sub of subs.data) {
      const businessId = sub.metadata?.businessId;
      if (!businessId) continue;
      const b = await db.business.findUnique({
        where: { id: businessId },
        select: { id: true, slug: true, plan: true, stripeSubscriptionId: true },
      });
      if (!b) continue;
      if (b.stripeSubscriptionId !== sub.id) {
        const plan = planForLookupKey(sub.items.data[0]?.price?.lookup_key);
        if (!plan) continue;
        await db.business.update({
          where: { id: b.id },
          data: {
            plan,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
            trialEndsAt: null,
          },
        });
        result.healed.push(`${b.slug}: re-attached live sub ${sub.id} (missed webhook)`);
      }
    }
  } catch (err) {
    result.complete = false;
    void reportError(err, { kind: "stripe-reconcile" });
    result.issues.push(`pass-2 error: ${String(err).slice(0, 120)}`);
  }

  return result;
}

export type HeartbeatNumbers = {
  leadsIn: number;
  spamFiltered: number;
  draftsCreated: number;
  repliesSent: number;
  pitchesSent: number;
  tenantsScanned: number;
  staleCrons: string[];
  silentTenants: SilentTenant[];
  /** Rolling beta verdict: usefulness, contactability and pitch acceptance. */
  huntQuality: HuntQualitySummary;
  /** Mail that arrived for a lead address no tenant owns (see lib/inbound/unrouted.ts). */
  unrouted: UnroutedReport;
};

export type SilentTenant = { slug: string; plan: string; daysSubscribed: number };

/** A paying tenant is "silent" when the agent has produced nothing for them. */
const SILENCE_WINDOW_DAYS = 7;

/**
 * Paying tenants the agent has done NOTHING for.
 *
 * The heartbeat above is a global total, which is exactly why this was needed:
 * with a handful of tenants, one account producing nothing disappears into the
 * sum, and with a single tenant the digest reports zeros every day and reads
 * like a quiet week rather than a fault. That is not hypothetical — the
 * founder's own account sat subscribed with the agent paused, 108 hunted venues
 * locked and the digest cheerfully reporting 0/0/0 daily, for weeks, and nobody
 * noticed until we went looking for something else.
 *
 * A customer in this state is paying and receiving nothing. They will not
 * complain; they will assume this is how it works, and churn. So it is worth an
 * ATTENTION on the digest every single time.
 *
 * Deliberately counts agent OUTPUT (drafts + pitches), not inbound: a quiet
 * week with no inquiries is not a fault, but a paid tenant whose assistant has
 * written nothing in a week always deserves a look.
 */
export async function findSilentTenants(now = new Date()): Promise<SilentTenant[]> {
  const since = new Date(now.getTime() - SILENCE_WINDOW_DAYS * 24 * 3600 * 1000);
  const paying = await db.business.findMany({
    where: { plan: { not: "TRIAL" } },
    select: { id: true, slug: true, plan: true, createdAt: true },
  });

  const silent: SilentTenant[] = [];
  for (const b of paying) {
    const [drafts, pitches] = await Promise.all([
      db.draft.count({ where: { createdAt: { gte: since }, lead: { businessId: b.id } } }),
      db.venuePitch.count({ where: { createdAt: { gte: since }, businessId: b.id } }),
    ]);
    if (drafts === 0 && pitches === 0) {
      silent.push({
        slug: b.slug,
        plan: b.plan,
        daysSubscribed: Math.floor((now.getTime() - b.createdAt.getTime()) / 86_400_000),
      });
    }
  }
  return silent;
}

/** Counts for the founder's proof-of-life digest — the last 24 hours. */
export async function computeHeartbeat(now = new Date()): Promise<HeartbeatNumbers> {
  const since = new Date(now.getTime() - 24 * 3600 * 1000);
  const [
    leadsIn,
    spamFiltered,
    draftsCreated,
    repliesSent,
    pitchesSent,
    tenantsScanned,
    stamps,
    silentTenants,
    huntQuality,
  ] =
    await Promise.all([
      db.lead.count({ where: { createdAt: { gte: since }, status: { not: "SPAM" } } }),
      db.lead.count({ where: { createdAt: { gte: since }, status: "SPAM" } }),
      db.draft.count({ where: { createdAt: { gte: since } } }),
      db.message.count({
        where: { createdAt: { gte: since }, direction: "OUTBOUND", bouncedAt: null },
      }),
      db.venuePitch.count({ where: { sentAt: { gte: since } } }),
      db.business.count({ where: { lastDiscoveryScanAt: { gte: since } } }),
      db.opsStamp.findMany(),
      findSilentTenants(now),
      computeHuntQuality({ now }),
    ]);
  const staleCrons = staleCronKeys(stamps, now);
  // Resolve the unrouted tally against real slugs, then DRAIN it: the digest is
  // the report, so leaving entries behind would repeat the same addresses every
  // night until the process restarted.
  const unrouted = await buildUnroutedReport(async () =>
    (await db.business.findMany({ select: { slug: true } })).map((b) => b.slug),
  );
  clearUnrouted();
  return {
    leadsIn,
    spamFiltered,
    draftsCreated,
    repliesSent,
    pitchesSent,
    tenantsScanned,
    staleCrons,
    silentTenants,
    huntQuality,
    unrouted,
  };
}

export function renderHeartbeat(
  h: HeartbeatNumbers,
  margins: { flagged: number; tenants: number },
  reconcile: ReconcileResult,
): string {
  return [
    "The machine ran. Last 24h:",
    "",
    `• Inquiries in: ${h.leadsIn} (+${h.spamFiltered} spam filtered)`,
    `• Drafts created: ${h.draftsCreated} · Replies sent: ${h.repliesSent}`,
    `• Venue pitches sent: ${h.pitchesSent} · Tenants scanned: ${h.tenantsScanned}`,
    `• Margins: ${margins.flagged}/${margins.tenants} tenants flagged below 70%`,
    `• Stripe reconciliation: ${reconcile.checked} checked, ${reconcile.healed.length} healed${
      reconcile.healed.length ? ` — ${reconcile.healed.join("; ")}` : ""
    }${reconcile.issues.length ? ` · ISSUES: ${reconcile.issues.join("; ")}` : ""}`,
    h.staleCrons.length
      ? `• STALE CRONS: ${h.staleCrons.join(", ")} — check the Render cron dashboard`
      : "• Crons: all fresh",
    // A paying tenant the agent has done nothing for is the one number here
    // that costs money if ignored: they are billed, they receive nothing, and
    // they churn without ever telling you.
    h.silentTenants.length
      ? `• SILENT PAYING TENANTS (${SILENCE_WINDOW_DAYS}d, no drafts or pitches): ${h.silentTenants
          .map((t) => `${t.slug} [${t.plan}, day ${t.daysSubscribed}]`)
          .join(", ")} — check their profile gate, plan state and mailbox`
      : "• Every paying tenant produced work this week",
    // Mail for an address no tenant owns. Silent by design for stray internet
    // mail, but a NEAR-MISS of a real slug is almost always a customer who
    // typo'd their forwarding address — meaning their inquiries are going
    // nowhere right now. That case is called out separately and loudly.
    h.unrouted.nearMisses.length
      ? `• LIKELY FORWARDING TYPOS: ${h.unrouted.nearMisses
          .map((n) => `${n.to} (${n.count}x) — did they mean "${n.didYouMean}"?`)
          .join(", ")} — verify that tenant's lead address`
      : h.unrouted.total
        ? `• Unroutable mail: ${h.unrouted.total} message(s) to ${h.unrouted.entries.length} unknown address(es) — none resembling a real tenant, so most likely probes`
        : "• No unroutable mail",
    "",
    renderHuntQualityText(h.huntQuality),
    "",
    "— Bright Ears Ops",
  ].join("\n");
}
