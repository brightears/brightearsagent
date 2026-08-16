import { db } from "@/lib/db";
import { notifyBusiness } from "@/lib/notify";
import {
  globalSuppressionUpsertArgs,
  normalizeOutreachEmail,
  tenantSuppressionUpsertArgs,
  type GlobalSuppressionReason,
} from "@/lib/outreach/suppression";

export interface PostmarkBouncePayload {
  RecordType?: string;
  ID?: number | string;
  Type?: string;
  TypeCode?: number;
  Name?: string;
  MessageID?: string;
  Description?: string;
  Details?: string;
  Email?: string;
  From?: string;
  BouncedAt?: string;
  Inactive?: boolean;
  CanActivate?: boolean;
  Subject?: string;
}

export type DeliveryEventClass =
  | "auto_reply"
  | "complaint"
  | "permanent"
  | "sender_fault"
  | "transient";

export type ApplyBounceResult =
  | { outcome: "duplicate"; eventClass: DeliveryEventClass }
  | { outcome: "not_found"; eventClass: DeliveryEventClass }
  | { outcome: "recorded"; eventClass: DeliveryEventClass; leadId: string };

const SENDER_FAULT_TYPES = new Set([
  "Blocked",
  "DMARCPolicy",
  "InboundError",
  "SMTPApiError",
  "SpamNotification",
  "TemplateRenderingFailed",
  "VirusNotification",
]);

const PERMANENT_TYPES = new Set([
  "AddressChange",
  "BadEmailAddress",
  "HardBounce",
  "ManuallyDeactivated",
  "Unconfirmed",
]);

const DEFINITIVE_INVALID_RECIPIENT_TYPES = new Set([
  "AddressChange",
  "BadEmailAddress",
]);

/**
 * Postmark's Type is more useful than a single hard/soft boolean:
 * autoresponders are replies, complaints are consent stops, sender faults are
 * our problem rather than the client's address, and only permanent recipient
 * failures should ask the owner to correct that address.
 */
export function classifyPostmarkDeliveryEvent(
  event: PostmarkBouncePayload,
): DeliveryEventClass {
  const type =
    event.RecordType === "SpamComplaint"
      ? "SpamComplaint"
      : event.Type ?? event.RecordType ?? "Unknown";

  if (type === "AutoResponder" || event.TypeCode === 64) return "auto_reply";
  if (
    type === "SpamComplaint" ||
    type === "Unsubscribe" ||
    event.TypeCode === 100001 ||
    event.TypeCode === 16
  ) {
    return "complaint";
  }
  if (SENDER_FAULT_TYPES.has(type)) return "sender_fault";
  if (
    PERMANENT_TYPES.has(type) ||
    event.TypeCode === 1 ||
    event.TypeCode === 100000 ||
    event.TypeCode === 100002 ||
    event.TypeCode === 100003 ||
    event.Inactive === true
  ) {
    return "permanent";
  }
  return "transient";
}

function eventName(event: PostmarkBouncePayload): string {
  if (event.RecordType === "SpamComplaint") return "SpamComplaint";
  return event.Type ?? event.RecordType ?? "Unknown";
}

/**
 * Only definitive recipient failures become product-wide. In particular, a
 * SoftBounce remains tenant-local even when Postmark has temporarily marked
 * the address inactive; sender faults and ordinary transient events never
 * create suppression rows.
 */
export function globalSuppressionReasonForPostmarkEvent(
  event: PostmarkBouncePayload,
): GlobalSuppressionReason | null {
  const eventClass = classifyPostmarkDeliveryEvent(event);
  const type = eventName(event);
  if (eventClass === "complaint") {
    return type === "Unsubscribe" ? "unsubscribe" : "spam-complaint";
  }
  if (eventClass !== "permanent" || type === "SoftBounce") return null;
  if (type === "HardBounce" || event.TypeCode === 1) return "hard-bounce";
  if (
    DEFINITIVE_INVALID_RECIPIENT_TYPES.has(type) ||
    event.TypeCode === 100000
  ) {
    return "invalid-recipient";
  }
  return null;
}

function detailFor(event: PostmarkBouncePayload): string {
  return [event.Name, event.Description, event.Details]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" — ")
    .slice(0, 1500);
}

function eventDate(event: PostmarkBouncePayload): Date {
  const parsed = event.BouncedAt ? new Date(event.BouncedAt) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Apply one Postmark Bounce or SpamComplaint event by the original MessageID.
 * The provider ID is the authority: recipient/subject fields are descriptive
 * only and can never select a tenant row.
 */
export async function applyPostmarkDeliveryEvent(
  event: PostmarkBouncePayload,
): Promise<ApplyBounceResult> {
  const eventClass = classifyPostmarkDeliveryEvent(event);
  const type = eventName(event);
  const messageId = event.MessageID?.trim();
  if (!messageId) return { outcome: "not_found", eventClass };

  const message = await db.message.findUnique({
    where: { providerMessageId: messageId },
    include: {
      draft: true,
      lead: {
        include: {
          business: { select: { id: true, ownerEmail: true } },
        },
      },
    },
  });
  if (!message) return { outcome: "not_found", eventClass };

  const detail = detailFor(event);

  if (eventClass === "auto_reply") {
    if (message.bounceType === type) return { outcome: "duplicate", eventClass };

    // Postmark models an autoresponder as a bounce-like event tied to the
    // original outbound MessageID. Materialize a separate inbound message so
    // the thread remains honest and the drafter can exclude it explicitly.
    const syntheticProviderId = `postmark-autoresponder:${event.ID ?? messageId}`;
    try {
      await db.$transaction([
        db.message.update({
          where: { id: message.id },
          data: { bounceType: type, bounceDetail: detail || null },
        }),
        db.message.create({
          data: {
            leadId: message.leadId,
            direction: "INBOUND",
            subject: event.Subject
              ? `Automatic reply: ${event.Subject}`
              : "Automatic reply",
            body: detail || "An automatic response was received.",
            fromEmail: event.Email,
            toEmail: event.From,
            providerMessageId: syntheticProviderId,
            autoReply: true,
          },
        }),
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return { outcome: "duplicate", eventClass };
      }
      throw err;
    }
    return { outcome: "recorded", eventClass, leadId: message.leadId };
  }

  if (message.bouncedAt && message.bounceType === type) {
    return { outcome: "duplicate", eventClass };
  }

  const bouncedAt = eventDate(event);
  const messageUpdate = db.message.update({
    where: { id: message.id },
    data: {
      bouncedAt,
      bounceType: type,
      bounceDetail: detail || null,
    },
  });

  if (eventClass === "permanent" || eventClass === "complaint") {
    const recipientEmail = normalizeOutreachEmail(
      message.toEmail ?? message.lead.clientEmail ?? event.Email ?? "",
    );
    const globalReason = globalSuppressionReasonForPostmarkEvent(event);
    const tenantReason: GlobalSuppressionReason =
      eventClass === "complaint"
        ? globalReason ?? "spam-complaint"
        : globalReason ?? "invalid-recipient";
    const reason =
      eventClass === "complaint"
        ? `Spam complaint: ${detail || type}`
        : detail || type;
    await db.$transaction([
      messageUpdate,
      db.lead.update({
        where: { id: message.leadId },
        data: {
          undeliverableAt: bouncedAt,
          undeliverableReason: reason,
          ...(eventClass === "complaint" ? { optedOut: true } : {}),
        },
      }),
      db.sequenceRun.updateMany({
        where: { leadId: message.leadId, stoppedAt: null },
        data: {
          stoppedAt: bouncedAt,
          stopReason: eventClass === "complaint" ? "spam_complaint" : "undeliverable",
        },
      }),
      db.draft.updateMany({
        where: { leadId: message.leadId, status: "PENDING" },
        data: { status: "EXPIRED", decidedAt: bouncedAt, scheduledSendAt: null },
      }),
      ...(recipientEmail
        ? [
            db.outreachSuppression.upsert(
              tenantSuppressionUpsertArgs({
                businessId: message.lead.business.id,
                email: recipientEmail,
                reason: tenantReason,
              }),
            ),
            ...(globalReason
              ? [
                  db.globalOutreachSuppression.upsert(
                    globalSuppressionUpsertArgs({
                      email: recipientEmail,
                      reason: globalReason,
                      business: message.lead.business,
                    }),
                  ),
                ]
              : []),
          ]
        : []),
    ]);

    const pushOnly =
      sameAddress(event.Email, message.lead.business.ownerEmail) ||
      sameAddress(event.Email, process.env.OPS_ALERT_EMAIL);
    await notifyBusiness(message.lead.business, {
      title:
        eventClass === "complaint"
          ? "A recipient marked a message as spam"
          : `Reply did not reach ${message.lead.clientName ?? "this lead"}`,
      body:
        eventClass === "complaint"
          ? "All follow-up is stopped permanently for this address."
          : "Follow-up is paused. Correct the email address on the lead to prepare the reply again.",
      url: `/dashboard/leads/${message.leadId}`,
      pushOnly,
    });
    return { outcome: "recorded", eventClass, leadId: message.leadId };
  }

  await messageUpdate;

  if (eventClass === "sender_fault") {
    // Emailing an alert about a sender-level email failure can create an alert
    // loop. Push is independent of Postmark and points to the affected thread.
    await notifyBusiness(message.lead.business, {
      title: "Email delivery needs attention",
      body: `${type}: the recipient address was not marked bad. Check the sending configuration before retrying.`,
      url: `/dashboard/leads/${message.leadId}`,
      pushOnly: true,
    });
  }

  return { outcome: "recorded", eventClass, leadId: message.leadId };
}
