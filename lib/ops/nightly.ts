import Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, stripeEnabled, planForLookupKey } from "@/lib/billing/stripe";
import { reportError } from "@/lib/report-error";
import { CRON_FRESHNESS_MS } from "@/lib/ops-stamp";

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
  healed: string[];
  issues: string[];
};

export async function reconcileStripe(): Promise<ReconcileResult> {
  const result: ReconcileResult = { checked: 0, healed: [], issues: [] };
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
        result.issues.push(`${b.slug}: reconcile error ${String(err).slice(0, 120)}`);
      }
    }
  }

  // Pass 2: live Stripe subs whose tenant row doesn't claim them (missed
  // webhook). metadata.businessId is set at checkout, so re-attach is exact.
  try {
    const subs = await stripe().subscriptions.list({ status: "active", limit: 100 });
    if (subs.has_more) {
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
};

/** Counts for the founder's proof-of-life digest — the last 24 hours. */
export async function computeHeartbeat(now = new Date()): Promise<HeartbeatNumbers> {
  const since = new Date(now.getTime() - 24 * 3600 * 1000);
  const [leadsIn, spamFiltered, draftsCreated, repliesSent, pitchesSent, tenantsScanned, stamps] =
    await Promise.all([
      db.lead.count({ where: { createdAt: { gte: since }, status: { not: "SPAM" } } }),
      db.lead.count({ where: { createdAt: { gte: since }, status: "SPAM" } }),
      db.draft.count({ where: { createdAt: { gte: since } } }),
      db.message.count({ where: { createdAt: { gte: since }, direction: "OUTBOUND" } }),
      db.venuePitch.count({ where: { sentAt: { gte: since } } }),
      db.business.count({ where: { lastDiscoveryScanAt: { gte: since } } }),
      db.opsStamp.findMany(),
    ]);
  const staleCrons = Object.entries(CRON_FRESHNESS_MS)
    .filter(([key, freshMs]) => {
      const stamp = stamps.find((s) => s.key === key);
      return stamp ? now.getTime() - stamp.at.getTime() > freshMs : false;
    })
    .map(([key]) => key);
  return { leadsIn, spamFiltered, draftsCreated, repliesSent, pitchesSent, tenantsScanned, staleCrons };
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
    "",
    "— Bright Ears Ops",
  ].join("\n");
}
