import type { InboundEmail } from "@/lib/inbound/types";
import { classifyEventType } from "@/lib/inbound/parsers/event-type";
import { extractEventDate } from "@/lib/inbound/parsers/event-date";
import { dequoteNewReply } from "@/lib/inbound/opt-out-intent";

export interface ReplyMatchMessage {
  subject?: string | null;
  providerMessageId?: string | null;
}

export interface ReplyMatchLead {
  rawSubject?: string | null;
  eventType?: string | null;
  eventDate?: Date | null;
  messages?: ReplyMatchMessage[];
}

export interface ReplyMatchAssessment {
  attach: boolean;
  score: number;
  reason:
    | "thread_reference"
    | "subject_and_event"
    | "subject"
    | "event_date"
    | "new_event_intent"
    | "event_conflict"
    | "no_continuity";
}

/** Postmark preserves header names but not their casing. */
function header(email: InboundEmail, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return Object.entries(email.headers ?? {}).find(([key]) => key.toLowerCase() === wanted)?.[1];
}

function messageTokens(value: string | undefined): string[] {
  if (!value) return [];
  const bracketed = [...value.matchAll(/<([^<>]+)>/g)].map((match) => match[1]);
  const loose = value
    .replace(/<[^<>]+>/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);
  return [...bracketed, ...loose].map((token) => token.trim().toLowerCase());
}

function tokenMatchesProviderId(token: string, providerId: string): boolean {
  const reference = token.replace(/^<|>$/g, "").toLowerCase();
  const stored = providerId.replace(/^<|>$/g, "").toLowerCase();
  if (!reference || !stored) return false;
  if (reference === stored) return true;
  // A provider can expose its stored ID as the local part of the RFC
  // Message-ID (for example <uuid@provider.example>). Never use substring
  // matching: the @ boundary keeps one lead's ID from matching another.
  return !stored.includes("@") && reference.startsWith(`${stored}@`);
}

function hasThreadReference(email: InboundEmail, lead: ReplyMatchLead): boolean {
  const references = [
    ...messageTokens(header(email, "in-reply-to")),
    ...messageTokens(header(email, "references")),
  ];
  if (references.length === 0) return false;
  const providerIds = (lead.messages ?? [])
    .map((message) => message.providerMessageId)
    .filter((value): value is string => !!value);
  return providerIds.some((id) => references.some((token) => tokenMatchesProviderId(token, id)));
}

/** Normalize the visible thread subject without erasing meaningful words. */
export function normalizeThreadSubject(subject: string | null | undefined): string {
  let value = (subject ?? "").trim();
  // Common reply/forward prefixes, including localized forms emitted by some
  // European mail clients. Repeat because long threads often say "Re: Re:".
  const prefix = /^(?:(?:re|fw|fwd|aw|sv|antwort)\s*(?:\[\d+\])?\s*:\s*)/i;
  while (prefix.test(value)) value = value.replace(prefix, "").trim();
  return value.replace(/\s+/g, " ").toLowerCase();
}

function subjectContinuesThread(email: InboundEmail, lead: ReplyMatchLead): boolean {
  const incoming = normalizeThreadSubject(email.subject);
  if (!incoming) return false;
  const prior = [lead.rawSubject, ...(lead.messages ?? []).map((message) => message.subject)]
    .map(normalizeThreadSubject)
    .filter(Boolean);
  return prior.includes(incoming);
}

function isoDate(value: Date | null | undefined): string | undefined {
  if (!value || Number.isNaN(value.getTime())) return undefined;
  return value.toISOString().slice(0, 10);
}

function normalizedEventType(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return classifyEventType(value) ?? value.trim().toLowerCase();
}

/**
 * Decide whether same-sender mail is a continuation of one lead.
 *
 * Address and recency are only candidate filters. Attachment needs positive
 * continuity evidence: an RFC reply reference, the same normalized subject,
 * or the same explicit event date. A different explicit date or event type is
 * a hard conflict unless the mail client supplied a direct thread reference.
 */
export function assessReplyMatch(
  email: InboundEmail,
  lead: ReplyMatchLead,
  today: Date = new Date(),
): ReplyMatchAssessment {
  const freshBody = dequoteNewReply(email.textBody);
  // A client may start a second booking by replying to the previous email.
  // In that case the RFC thread is real but the BUSINESS event is not the
  // same. Only explicit language is strong enough to make that distinction;
  // vague changes stay on the current thread.
  const explicitlyNewEvent =
    /\b(?:separate|another|second)\s+(?:[\w'’-]+\s+){0,2}(?:booking|event|inquiry|request|gig|wedding|party|occasion)\b/i.test(
      freshBody,
    ) || /\b(?:new|separate)\s+booking\s+(?:request|inquiry)\b/i.test(freshBody);
  if (explicitlyNewEvent) {
    return { attach: false, score: 0, reason: "new_event_intent" };
  }

  if (hasThreadReference(email, lead)) {
    return { attach: true, score: 100, reason: "thread_reference" };
  }

  // Quoted history usually repeats the old date/type. Only the sender's new
  // words may prove that this is a different event.
  // The sender's fresh words outrank a stale "Re:" subject. A person can
  // start a separate inquiry by replying to an old mail; if the new body names
  // a different date/event, it must not be swallowed merely because the mail
  // client retained the old subject. The explicit RFC reference above is the
  // only evidence strong enough to override that conflict.
  const incomingDate =
    extractEventDate(freshBody, today) ?? extractEventDate(email.subject, today);
  const existingDate = isoDate(lead.eventDate);
  const incomingType = classifyEventType(freshBody) ?? classifyEventType(email.subject);
  const existingType = normalizedEventType(lead.eventType);
  const dateConflict = !!incomingDate && !!existingDate && incomingDate !== existingDate;
  const typeConflict = !!incomingType && !!existingType && incomingType !== existingType;
  if (dateConflict || typeConflict) {
    return { attach: false, score: 0, reason: "event_conflict" };
  }

  const sameSubject = subjectContinuesThread(email, lead);
  const sameDate = !!incomingDate && !!existingDate && incomingDate === existingDate;
  const sameType = !!incomingType && !!existingType && incomingType === existingType;
  if (sameSubject && (sameDate || sameType)) {
    return { attach: true, score: 80, reason: "subject_and_event" };
  }
  if (sameSubject) return { attach: true, score: 60, reason: "subject" };
  if (sameDate) return { attach: true, score: 50, reason: "event_date" };
  return { attach: false, score: 0, reason: "no_continuity" };
}
