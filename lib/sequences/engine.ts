import { db } from "@/lib/db";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { sendDraftReply } from "@/lib/agent/send-reply";
import { canAutoSend } from "@/lib/inbound/auto-send";
import { meterState, isAgentPaused } from "@/lib/billing/metering";
import { notifyBusiness } from "@/lib/notify";
import { reportError } from "@/lib/report-error";

export interface TickResult {
  expiredDrafts: number;
  backfilledRuns: number;
  redraftedLeads: number;
  agingPings: number;
  stepsFired: number;
  exhausted: number;
  skipped: number;
}

const DAY = 24 * 3600 * 1000;

/**
 * One engine tick (cron calls this). Idempotent and safe to run any time:
 * 1. Expire stale PENDING drafts (event passed / expiresAt hit).
 * 2. Backfill runs for REPLIED leads that have none (e.g. pre-engine data).
 * 3. Fire due steps: draft the follow-up (goes through owner approval), advance
 *    the clock. Never stacks: skips while a PENDING follow-up draft exists.
 * 4. Exhausted sequences (all steps sent, still silent) → lead DEAD, run stopped.
 * Hard-stops (BOOKED/DEAD/ENGAGED/SPAM/opt-out) close runs defensively here too,
 * even though actions/webhook already do it at the source.
 */
export async function runSequenceTick(now = new Date()): Promise<TickResult> {
  const result: TickResult = { expiredDrafts: 0, backfilledRuns: 0, redraftedLeads: 0, agingPings: 0, stepsFired: 0, exhausted: 0, skipped: 0 };

  // 1. Expire stale drafts.
  const expired = await db.draft.updateMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    data: { status: "EXPIRED", decidedAt: now },
  });
  result.expiredDrafts = expired.count;

  // 1a. Draft-aging re-ping (P4.3): ONE "still waiting" nudge per draft, ever,
  // once it's sat unapproved ~4h — one ping at creation was fragile for people
  // who work nights, and more than two would be spam. The stamp is written
  // FIRST so an overlapping tick can't double-ping. Paused tenants are
  // stamped-but-silent (their standing state lives on the dashboard).
  const AGING_MS = 4 * 3600 * 1000;
  const aging = await db.draft.findMany({
    where: { status: "PENDING", agingPingAt: null, createdAt: { lt: new Date(now.getTime() - AGING_MS) } },
    include: { lead: { include: { business: { select: { id: true, ownerEmail: true, plan: true } } } } },
    take: 50,
  });
  for (const draft of aging) {
    await db.draft.update({ where: { id: draft.id }, data: { agingPingAt: now } });
    if (isAgentPaused(draft.lead.business.plan)) continue;
    const hours = Math.round((now.getTime() - draft.createdAt.getTime()) / 3600_000);
    void notifyBusiness(draft.lead.business, {
      title: `Still waiting: ${draft.lead.clientName ?? "a lead"}`,
      body: `A reply has been ready for ${hours}h — one tap sends it.`,
      url: `/dashboard/leads/${draft.leadId}`,
      emailBody: `A drafted reply for ${draft.lead.clientName ?? "a lead"} has been waiting ${hours} hours for your approval.\n\nSpeed wins these — one tap and it goes out in your voice.`,
    }).catch(() => null);
    result.agingPings++;
  }

  // 1b. Redraft sweep: leads that should have a reply draft waiting but don't —
  // capped-then-upgraded leads, leads whose webhook-time draft threw, or leads
  // whose initial draft expired while the owner was away. Without this they'd
  // sit forever undrafted (the exact >5-min-response failure we sell against).
  // Only for non-terminal leads currently under their plan's lead cap.
  const undrafted = await db.lead.findMany({
    where: {
      status: { in: ["NEW", "DRAFTED"] },
      optedOut: false,
      drafts: { none: { status: "PENDING" } },
      updatedAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) }, // settle 5 min (let webhook-time drafting finish)
      // Skip past-event leads: their draft would expire immediately (expiresAt =
      // eventDate), causing a redraft-then-expire loop that burns LLM cost.
      OR: [{ eventDate: null }, { eventDate: { gte: now } }],
    },
    include: { business: { select: { id: true, plan: true, trialEndsAt: true } } },
    take: 50,
  });
  for (const lead of undrafted) {
    const meter = await meterState(lead.business.id, lead.business.plan, now, lead.business.trialEndsAt);
    if (meter.overCap) continue; // still capped — leave NEW, owner already nudged
    try {
      await generateDraftForLead(lead.id);
      result.redraftedLeads++;
    } catch (err) {
      void reportError(err, { kind: "sequence-redraft", leadId: lead.id });
    }
  }

  // 2. Backfill runs for REPLIED leads without one.
  const orphans = await db.lead.findMany({
    where: { status: "REPLIED", optedOut: false, sequenceRun: null, firstReplyAt: { not: null } },
    include: { business: { include: { sequences: { where: { active: true }, take: 1 } } } },
  });
  for (const lead of orphans) {
    const template = lead.business.sequences[0];
    if (!template || template.stepsDays.length === 0) continue;
    await db.sequenceRun.create({
      data: {
        leadId: lead.id,
        templateId: template.id,
        currentStep: 0,
        nextRunAt: new Date(lead.firstReplyAt!.getTime() + template.stepsDays[0] * DAY),
      },
    });
    result.backfilledRuns++;
  }

  // 3 + 4. Fire due runs — MOST OVERDUE FIRST under a per-tick cap (P7.8):
  // the query was unbounded; a backlog spike (cron outage, bulk import) would
  // try to fire everything in one request. 200/tick at the */30 cadence is
  // ~9,600 steps/day of throughput; anything cut off is at the front of the
  // next tick's queue by construction.
  const due = await db.sequenceRun.findMany({
    where: { stoppedAt: null, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: 200,
    include: {
      template: true,
      lead: {
        include: {
          drafts: { where: { status: "PENDING" } },
          // Autopilot (P8.5): plan + trusted sources decide whether this
          // step SENDS or waits for approval.
          business: { select: { id: true, plan: true, autoSendSources: true, ownerEmail: true } },
        },
      },
    },
  });

  for (const run of due) {
    const { lead, template } = run;

    // Defensive hard-stops.
    if (lead.optedOut || ["BOOKED", "DEAD", "ENGAGED", "SPAM"].includes(lead.status)) {
      await db.sequenceRun.update({
        where: { id: run.id },
        data: { stoppedAt: now, stopReason: lead.optedOut ? "opted_out" : `lead_${lead.status.toLowerCase()}` },
      });
      result.skipped++;
      continue;
    }

    // Never stack drafts: any non-terminal draft (PENDING) means the owner
    // hasn't decided yet — wait, don't draft another step on top.
    if (lead.drafts.length > 0) {
      result.skipped++;
      continue;
    }

    const nextStep = run.currentStep + 1;
    if (nextStep > template.stepsDays.length) {
      // Sequence exhausted, still silent → the lead has gone quiet.
      await db.$transaction([
        db.lead.update({ where: { id: lead.id }, data: { status: "DEAD", deadAt: now } }),
        db.sequenceRun.update({ where: { id: run.id }, data: { stoppedAt: now, stopReason: "exhausted" } }),
      ]);
      result.exhausted++;
      continue;
    }

    // A transient draft failure must not abort the whole tick (starving every
    // other tenant's runs) — isolate it; the run's nextRunAt is left in the past
    // so the next tick retries this lead.
    //
    // AUTOPILOT (P8.5): on Pro/Studio, follow-ups to sources the owner
    // explicitly trusts SEND on their own — the same compliance-hardened
    // sendDraftReply the approve button uses (footer at send, opt-out and
    // terminal hard-stops enforced at the boundary; GigSalad never eligible
    // via canAutoSend, rule 4). "Runs until booked-or-dead" finally means
    // RUNS, not "drafts and waits". A blocked/failed send degrades to the
    // normal PENDING draft + action ping — nothing is ever lost.
    const autopilot = canAutoSend(lead.business.plan, lead.business.autoSendSources, lead.source);
    try {
      const draftId = await generateDraftForLead(lead.id, nextStep, { suppressPush: autopilot });
      if (autopilot && draftId) {
        const sent = await sendDraftReply({
          draftId,
          businessId: lead.business.id,
          autoAttach: true,
        });
        void notifyBusiness(
          lead.business,
          sent.ok
            ? {
                title: `Follow-up sent: ${lead.clientName ?? "a lead"}`,
                body: `Step ${nextStep} went out in your voice — tap to view the thread.`,
                url: `/dashboard/leads/${lead.id}`,
                pushOnly: true, // informational receipt; the weekly report totals these
              }
            : {
                title: `Follow-up ready: ${lead.clientName ?? "a lead"}`,
                body: "Auto-send was blocked for this one — tap to review and send.",
                url: `/dashboard/leads/${lead.id}`,
              },
        ).catch(() => null);
      }
    } catch (err) {
      void reportError(err, { kind: "sequence-step", leadId: lead.id, step: nextStep });
      result.skipped++;
      continue;
    }

    // Anchor the NEXT step to the actual fire time + the configured gap between
    // steps — never to firstReplyAt — so approval delays or cron outages can't
    // bunch follow-ups back-to-back. Minimum 1-day gap.
    const followingStepIdx = nextStep; // index into stepsDays for the step AFTER this one
    const gapDays =
      followingStepIdx < template.stepsDays.length
        ? Math.max(1, template.stepsDays[followingStepIdx] - template.stepsDays[nextStep - 1])
        : 2; // exhaust-check visit after the last step
    const nextRunAt = new Date(now.getTime() + gapDays * DAY);

    await db.sequenceRun.update({
      where: { id: run.id },
      data: { currentStep: nextStep, nextRunAt },
    });
    result.stepsFired++;
  }

  return result;
}
