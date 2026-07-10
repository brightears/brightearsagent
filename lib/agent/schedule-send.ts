import { db } from "@/lib/db";
import { sendDraftReply, SEND_ERR } from "@/lib/agent/send-reply";
import { canAutoSend } from "@/lib/inbound/auto-send";
import { notifyBusiness } from "@/lib/notify";
import { reportError } from "@/lib/report-error";

/**
 * The "sending soon" buffer (P10.4). Autonomous sends — auto-send first
 * replies and autopilot follow-ups — never fire instantly: they schedule
 * SEND_BUFFER_MS out and the owner gets a visible holding state with a Hold
 * button. Approving early still sends instantly (the buffer delays autonomy,
 * never the artist); Hold drops the draft back to the normal approve flow;
 * Reject kills it. The sequence tick fires whatever elapsed — so the real
 * wait is "buffer + up to one cron interval", always AT LEAST 15 minutes of
 * cancel window.
 */
export const SEND_BUFFER_MS = 15 * 60 * 1000;

/**
 * Stamp the buffer on a PENDING, not-yet-scheduled draft. Returns the
 * scheduled time, or null when the draft already moved (approved early,
 * rejected, expired) — callers treat null as "nothing scheduled".
 */
export async function scheduleAutonomousSend(
  draftId: string,
  now = new Date(),
): Promise<Date | null> {
  const at = new Date(now.getTime() + SEND_BUFFER_MS);
  const updated = await db.draft.updateMany({
    where: { id: draftId, status: "PENDING", scheduledSendAt: null },
    data: { scheduledSendAt: at },
  });
  return updated.count > 0 ? at : null;
}

export type ScheduledSendResult = { sent: number; blocked: number };

/**
 * Fire every scheduled send whose buffer elapsed (the sequence tick calls
 * this first). sendDraftReply's atomic claim (10.10) makes the race with a
 * simultaneous manual approve safe — exactly one send ever happens. A
 * blocked send clears its schedule and degrades to the normal approve flow;
 * a draft the owner already decided (approved early / rejected / held) is
 * skipped silently.
 */
export async function runScheduledSends(now = new Date()): Promise<ScheduledSendResult> {
  const result: ScheduledSendResult = { sent: 0, blocked: 0 };
  const due = await db.draft.findMany({
    where: { status: "PENDING", scheduledSendAt: { lte: now } },
    orderBy: { scheduledSendAt: "asc" },
    take: 100,
    include: { lead: { include: { business: true } } },
  });

  for (const draft of due) {
    const business = draft.lead.business;
    const label = draft.lead.clientName ?? "a lead";

    // Re-validate autonomy at FIRE time (P15 review): the owner may have
    // untrusted the source or downgraded plan during the 15-min buffer. If
    // auto-send no longer applies, the draft stays PENDING for approval —
    // clear its schedule (so it won't retry) and let the normal ping stand.
    // GigSalad/opt-out cases are still caught downstream in sendDraftReply.
    if (!canAutoSend(business.plan, business.autoSendSources, draft.lead.source)) {
      await db.draft
        .updateMany({ where: { id: draft.id, status: "PENDING" }, data: { scheduledSendAt: null } })
        .catch(() => null);
      continue;
    }

    try {
      const res = await sendDraftReply({
        draftId: draft.id,
        businessId: business.id,
        autoAttach: true,
        requireScheduled: true, // a Hold that cleared the buffer wins the race
      });
      if (res.ok) {
        result.sent++;
        // Informational receipt — push only (emailing every autonomous send
        // would defeat the point; the weekly report totals these).
        void notifyBusiness(business, {
          title: draft.isFollowUp ? `Follow-up sent: ${label}` : `Auto-replied: ${label}`,
          body: "Sent in your voice — tap to view the thread.",
          url: `/dashboard/leads/${draft.leadId}`,
          pushOnly: true,
        }).catch(() => null);
      } else if (res.error === SEND_ERR.notPending) {
        // Owner beat the buffer (approved early / rejected / HELD) — the claim
        // missed. Nothing to do and nothing to say; already handled.
        continue;
      } else if (res.error === SEND_ERR.compliance) {
        // The lead opted out / went DEAD or BOOKED during the buffer.
        // sendDraftReply already EXPIRED the draft — there is nothing to
        // "review and send", so DON'T nudge the owner toward a closed lead.
        continue;
      } else {
        // Degradable block (no reachable email) — the draft is still PENDING;
        // clear the schedule so it can't loop, degrade to the approve flow.
        result.blocked++;
        await db.draft.updateMany({
          where: { id: draft.id, status: "PENDING" },
          data: { scheduledSendAt: null },
        });
        void notifyBusiness(business, {
          title: `Reply ready: ${label}`,
          body: "Auto-send was blocked for this one — tap to review and send.",
          url: `/dashboard/leads/${draft.leadId}`,
        }).catch(() => null);
      }
    } catch (err) {
      // Transport threw — send-reply released its claim back to PENDING;
      // clear the schedule (no silent retry loops) and ping for a manual send.
      result.blocked++;
      void reportError(err, { kind: "scheduled-send", businessId: business.id, draftId: draft.id });
      await db.draft
        .updateMany({
          where: { id: draft.id, status: "PENDING" },
          data: { scheduledSendAt: null },
        })
        .catch(() => null);
      void notifyBusiness(business, {
        title: `Reply needs you: ${label}`,
        body: "The automatic send didn't go out — tap to review.",
        url: `/dashboard/leads/${draft.leadId}`,
      }).catch(() => null);
    }
  }
  return result;
}
