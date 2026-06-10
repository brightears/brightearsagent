import { db } from "@/lib/db";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";

export interface TickResult {
  expiredDrafts: number;
  backfilledRuns: number;
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
  const result: TickResult = { expiredDrafts: 0, backfilledRuns: 0, stepsFired: 0, exhausted: 0, skipped: 0 };

  // 1. Expire stale drafts.
  const expired = await db.draft.updateMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    data: { status: "EXPIRED", decidedAt: now },
  });
  result.expiredDrafts = expired.count;

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

  // 3 + 4. Fire due runs.
  const due = await db.sequenceRun.findMany({
    where: { stoppedAt: null, nextRunAt: { lte: now } },
    include: { template: true, lead: { include: { drafts: { where: { status: "PENDING" } } } } },
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

    // Never stack drafts: a pending one means the owner hasn't decided yet.
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

    // Draft follow-up #nextStep (lands as PENDING + push to the owner's phone).
    await generateDraftForLead(lead.id, nextStep);

    const t0 = lead.firstReplyAt ?? now;
    const followingStepIdx = nextStep; // index into stepsDays for the step AFTER this one
    const nextRunAt =
      followingStepIdx < template.stepsDays.length
        ? new Date(t0.getTime() + template.stepsDays[followingStepIdx] * DAY)
        : new Date(now.getTime() + 2 * DAY); // exhaust-check visit after the last step

    await db.sequenceRun.update({
      where: { id: run.id },
      data: { currentStep: nextStep, nextRunAt },
    });
    result.stepsFired++;
  }

  return result;
}
