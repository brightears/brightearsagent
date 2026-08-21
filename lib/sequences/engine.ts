import { db } from "@/lib/db";
import { generateDraftForLead } from "@/lib/agent/generate-for-lead";
import { runScheduledSends, scheduleAutonomousSend } from "@/lib/agent/schedule-send";
import { canAutoSend } from "@/lib/inbound/auto-send";
import { meterState, isAgentPaused } from "@/lib/billing/metering";
import { notifyBusiness } from "@/lib/notify";
import { normalizeLocale } from "@/lib/i18n/config";
import { translator } from "@/lib/i18n/messages";
import { reportError } from "@/lib/report-error";
import { nextRunAtAfterStep } from "@/lib/sequences/timing";
import { surfaceStuckVenuePitchClaims } from "@/lib/ops/sending-recovery";
import { outreachSuppressionScope } from "@/lib/outreach/suppression";

export interface TickResult {
  expiredDrafts: number;
  backfilledRuns: number;
  redraftedLeads: number;
  /** Draft-generation work attempted/failed, used to detect provider-wide failure. */
  draftAttempts: number;
  draftFailures: number;
  agingPings: number;
  stepsFired: number;
  exhausted: number;
  skipped: number;
  /** P10.4 buffer: scheduled autonomous sends fired / degraded this tick. */
  scheduledSent: number;
  scheduledBlocked: number;
  /** Read-only alert count; these uncertain sends are never retried here. */
  stuckVenuePitches: number;
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
  const result: TickResult = {
    expiredDrafts: 0,
    backfilledRuns: 0,
    redraftedLeads: 0,
    draftAttempts: 0,
    draftFailures: 0,
    agingPings: 0,
    stepsFired: 0,
    exhausted: 0,
    skipped: 0,
    scheduledSent: 0,
    scheduledBlocked: 0,
    stuckVenuePitches: 0,
  };

  // 0. Fire "sending soon" buffers that elapsed (P10.4) — FIRST, so a
  // scheduled send never waits an extra tick behind step processing.
  const scheduled = await runScheduledSends(now);
  result.scheduledSent = scheduled.sent;
  result.scheduledBlocked = scheduled.blocked;

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
    include: { lead: { include: { business: { select: { id: true, ownerEmail: true, plan: true, locale: true } } } } },
    take: 50,
  });
  for (const draft of aging) {
    await db.draft.update({ where: { id: draft.id }, data: { agingPingAt: now } });
    if (isAgentPaused(draft.lead.business.plan)) continue;
    const t = translator(normalizeLocale(draft.lead.business.locale));
    const leadName = draft.lead.clientName ?? t("notification.newLead");
    const hours = Math.round((now.getTime() - draft.createdAt.getTime()) / 3600_000);
    void notifyBusiness(draft.lead.business, {
      title: t("notification.stillWaiting", { name: leadName }),
      body: t("notification.stillWaitingBody", { hours }),
      url: `/dashboard/leads/${draft.leadId}`,
      emailBody: normalizeLocale(draft.lead.business.locale) === "th"
        ? `ร่างคำตอบสำหรับ ${leadName} รอการอนุมัติมา ${hours} ชั่วโมง\n\nตอบเร็วช่วยเพิ่มโอกาสได้งาน กดครั้งเดียวเพื่อส่งด้วยสำนวนของคุณ`
        : `A drafted reply for ${leadName} has been waiting ${hours} hours for your approval.\n\nSpeed wins these — one tap and it goes out in your voice.`,
    }).catch(() => null);
    result.agingPings++;
  }

  // 1b. Redraft sweep: leads that should have a reply draft waiting but don't —
  // capped-then-upgraded leads, leads whose webhook-time draft threw, or leads
  // whose initial draft expired while the owner was away. Without this they'd
  // sit forever undrafted (the exact >5-min-response failure we sell against).
  // Only for non-terminal leads currently under their plan's lead cap.
  // SENDING counts as "has a draft": a draft stuck mid-send (crash after the
  // email left, before the terminal write) must never be redrafted — that's
  // the double-email window. Stuck SENDING is surfaced below (1c) instead.
  const undrafted = await db.lead.findMany({
    where: {
      status: { in: ["NEW", "DRAFTED"] },
      optedOut: false,
      drafts: { none: { status: { in: ["PENDING", "SENDING"] } } },
      updatedAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) }, // settle 5 min (let webhook-time drafting finish)
      // Skip past-event leads: their draft would expire immediately (expiresAt =
      // eventDate), causing a redraft-then-expire loop that burns LLM cost.
      OR: [{ eventDate: null }, { eventDate: { gte: now } }],
    },
    include: { business: { select: { id: true, plan: true, trialEndsAt: true, timezone: true } } },
    take: 50,
  });
  for (const lead of undrafted) {
    if (
      lead.clientEmail &&
      (await outreachSuppressionScope(lead.businessId, lead.clientEmail))
    ) {
      result.skipped++;
      continue;
    }
    const meter = await meterState(
      lead.business.id,
      lead.business.plan,
      now,
      lead.business.trialEndsAt,
      lead.business.timezone,
    );
    if (meter.overCap) continue; // still capped — leave NEW, owner already nudged
    result.draftAttempts++;
    try {
      await generateDraftForLead(lead.id);
      result.redraftedLeads++;
    } catch (err) {
      result.draftFailures++;
      void reportError(err, { kind: "sequence-redraft", leadId: lead.id });
    }
  }

  // 1c. Stuck-SENDING visibility: a crash between sendEmail and the terminal
  // DB write strands a draft in SENDING — the email may already be delivered,
  // so it must NEVER be auto-redrafted or re-sent (double-email). Surface it
  // to ops instead. Draft has no updatedAt, so createdAt is the proxy: a real
  // in-flight send lasts seconds, so any SENDING draft the cron observes on a
  // >10-minute-old draft is effectively stuck. One report per tick; the
  // stable message lets reportError's signature dedupe cap the emails.
  const STUCK_SENDING_MS = 10 * 60 * 1000;
  const stuckSending = await db.draft.findMany({
    where: { status: "SENDING", createdAt: { lt: new Date(now.getTime() - STUCK_SENDING_MS) } },
    select: { id: true, leadId: true },
    take: 20,
  });
  if (stuckSending.length > 0) {
    void reportError(new Error("draft stuck in SENDING — email may be delivered but unrecorded; needs manual review"), {
      kind: "stuck-sending-draft",
      count: stuckSending.length,
      draftIds: stuckSending.map((d) => d.id),
      leadIds: stuckSending.map((d) => d.leadId),
    });
  }

  // Venue pitches have the same unavoidable send-success / terminal-write
  // crash window as reactive drafts. Unlike a transport throw (which safely
  // reopens APPROVED), an old SENDING row has uncertain delivery and therefore
  // stays frozen. Surface exact recovery identifiers to ops; never mutate or
  // auto-resend it.
  result.stuckVenuePitches = await surfaceStuckVenuePitchClaims(now);

  // 2. Backfill runs for REPLIED leads without one.
  const orphans = await db.lead.findMany({
    where: { status: "REPLIED", optedOut: false, sequenceRun: null, firstReplyAt: { not: null } },
    include: { business: { include: { sequences: { where: { active: true }, take: 1 } } } },
  });
  for (const lead of orphans) {
    if (
      lead.clientEmail &&
      (await outreachSuppressionScope(lead.businessId, lead.clientEmail))
    ) {
      result.skipped++;
      continue;
    }
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
          // SENDING blocks stacking too: a draft mid-send (or stuck there)
          // must hold the run, not let another step draft on top of it.
          drafts: { where: { status: { in: ["PENDING", "SENDING"] } } },
          // Autopilot (P8.5): plan + trusted sources decide whether this
          // step SENDS or waits for approval.
          business: { select: { id: true, plan: true, autoSendSources: true, ownerEmail: true, locale: true } },
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

    // A recipient can stop all Bright Ears contact through another tenant, or
    // acquire a definitive delivery suppression after this run was created.
    // Close the run before generating or scheduling another follow-up.
    if (
      lead.clientEmail &&
      (await outreachSuppressionScope(lead.businessId, lead.clientEmail))
    ) {
      await db.sequenceRun.update({
        where: { id: run.id },
        data: { stoppedAt: now, stopReason: "suppressed" },
      });
      result.skipped++;
      continue;
    }

    // Subscription gate: an unsubscribed (plan=TRIAL) tenant's agent does
    // nothing — the aging ping (1a) and redraft sweep (1b) already pause here,
    // and the due-run loop must too, or follow-up steps would keep drafting
    // (and autopilot would keep sending) for a paused tenant. The run stays
    // open with nextRunAt in the past, so subscribing resumes it next tick.
    if (isAgentPaused(lead.business.plan)) {
      result.skipped++;
      continue;
    }

    // Never stack drafts: any non-terminal draft (PENDING/SENDING) means the
    // owner hasn't decided yet or a send is in flight — wait, don't draft
    // another step on top.
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
    // explicitly trusts SEND on their own — behind the 15-minute "sending
    // soon" buffer (P10.4): the draft schedules, the owner gets a holding
    // ping with a Hold path, and runScheduledSends (top of this tick) fires
    // whatever elapsed through the same compliance-hardened sendDraftReply
    // the approve button uses (footer at send, opt-out and terminal
    // hard-stops enforced at the boundary; GigSalad never eligible via
    // canAutoSend, rule 4). A blocked/failed send degrades to the normal
    // PENDING draft + action ping — nothing is ever lost.
    const autopilot = canAutoSend(lead.business.plan, lead.business.autoSendSources, lead.source);
    result.draftAttempts++;
    try {
      const draftId = await generateDraftForLead(lead.id, nextStep, { suppressPush: autopilot });
      if (autopilot && draftId) {
        const at = await scheduleAutonomousSend(draftId, now);
        if (at) {
          const t = translator(normalizeLocale(lead.business.locale));
          void notifyBusiness(lead.business, {
            title: t("notification.sendingSoon", {
              name: lead.clientName ?? t("notification.newLead"),
            }),
            body: normalizeLocale(lead.business.locale) === "th"
              ? `ข้อความติดตามครั้งที่ ${nextStep} จะส่งใน 15 นาที เปิดเพื่อตรวจ พักไว้ หรือส่งตอนนี้`
              : `Step ${nextStep} goes out in 15 minutes — open it to read, hold, or send now.`,
            url: `/dashboard/leads/${lead.id}`,
            pushOnly: true, // holding-state ping; the send gets its own receipt
          }).catch(() => null);
        }
      }
    } catch (err) {
      result.draftFailures++;
      void reportError(err, { kind: "sequence-step", leadId: lead.id, step: nextStep });
      result.skipped++;
      continue;
    }

    // Anchor the NEXT step to the actual fire time + the configured gap between
    // steps — never to firstReplyAt — so approval delays or cron outages can't
    // bunch follow-ups back-to-back. Minimum 1-day gap.
    const nextRunAt = nextRunAtAfterStep(template.stepsDays, nextStep, now);

    await db.sequenceRun.update({
      where: { id: run.id },
      data: { currentStep: nextStep, nextRunAt },
    });
    result.stepsFired++;
  }

  return result;
}
