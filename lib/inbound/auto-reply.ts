import type { InboundEmail } from "@/lib/inbound/types";

// Is this message a machine's auto-reply rather than a human answering?
//
// WHY THIS EXISTS. Nothing in the inbound path used to ask. So an
// out-of-office — "I'm away until the 5th" — was handled as a genuine prospect
// reply, and by hard rule 5 a prospect reply STOPS the follow-up sequence
// immediately and permanently. Nothing reopens a stopped run, and the sequence
// engine independently re-stops any run whose lead is ENGAGED, so the lead sat
// alive-looking and unreachable forever. On the Hunt side it was worse: an OOO
// flipped the venue PITCHED → REPLIED, and the one polite +6-day bump requires
// PITCHED, so the follow-up was cancelled by a machine that never read the
// pitch. Both failures are silent, and OOO is endemic in venue and corporate
// email — exactly who the Hunt agent writes to.
//
// THE ASYMMETRY THAT SHAPES EVERYTHING BELOW. Missing an auto-reply costs us a
// stalled sequence. Misclassifying a REAL client reply as an auto-reply is
// worse: we would keep emailing someone who already answered, which is the
// behaviour most likely to lose the booking and look robotic. So detection is
// deliberately conservative — authoritative headers decide, phrasing never does
// on its own.

/** Case-insensitive header read: relays preserve their own capitalisation. */
function header(email: InboundEmail, name: string): string | undefined {
  const headers = email.headers;
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

/**
 * TIER A — authoritative. Any single one of these is conclusive, because only
 * auto-responder software sets them.
 */
function authoritativeSignal(email: InboundEmail): string | null {
  // RFC 3834: an automatic responder MUST mark its output. Values in the wild
  // include auto-replied, auto-generated, auto-notified, sometimes with
  // parameters ("auto-replied; owner-email=..."). Anything but "no" counts.
  const autoSubmitted = header(email, "auto-submitted");
  if (autoSubmitted) {
    const value = autoSubmitted.split(";")[0]!.trim().toLowerCase();
    if (value && value !== "no") return `Auto-Submitted: ${value}`;
  }

  // cPanel/Exim/Courier/Zimbra autoresponders.
  for (const h of ["x-autoreply", "x-autorespond", "x-autoreply-from", "x-auto-reply-from"]) {
    const v = header(email, h);
    if (v && v.trim().toLowerCase() !== "no") return `${h}: ${v.slice(0, 40)}`;
  }

  // Only the exact auto_reply token. NOT "bulk"/"list"/"junk" — see below.
  const precedence = header(email, "precedence")?.trim().toLowerCase();
  if (precedence === "auto_reply") return "Precedence: auto_reply";

  // Microsoft rule/OOF-generated mail.
  if (header(email, "x-ms-exchange-inbox-rules-loop")) return "X-MS-Exchange-Inbox-Rules-Loop";
  const msSource = header(email, "x-ms-exchange-generated-message-source")?.toLowerCase();
  if (msSource && (msSource.includes("mailbox rules agent") || msSource.includes("oof"))) {
    return `X-MS-Exchange-Generated-Message-Source: ${msSource.slice(0, 40)}`;
  }

  // Null envelope sender — conclusive when present. Its ABSENCE means nothing,
  // because forwarders rewrite Return-Path.
  const returnPath = header(email, "return-path")?.trim();
  if (returnPath === "<>") return "Return-Path: <>";

  return null;
}

/**
 * Headers that are NOT triggers, each a documented false-positive trap:
 *
 * - Precedence: bulk | list | junk — set by mailing-list software, newsletters
 *   and many corporate relays. The Knot / WeddingWire / Bark lead notifications
 *   are exactly this shape, and triage already had to carve them out of its bulk
 *   heuristics for the same reason. Treating these as auto-replies would drop
 *   real leads.
 * - X-Auto-Response-Suppress — means "do not auto-reply TO me", set by
 *   transactional senders. It is evidence the message is NOT an auto-reply.
 * - List-*, X-Mailer — say nothing about automation of THIS message.
 */
const VACATION_SUBJECT =
  /^\s*(?:re:\s*)?(?:automatic reply|auto[-\s]?reply|autoreply|out of (?:the )?office|away from (?:the )?office|auto[-\s]?response|automatische antwort|abwesenheitsnotiz|réponse automatique|respuesta automática)\b/i;

/**
 * TIER B — heuristic, never sufficient alone. A vacation-shaped SUBJECT plus ONE
 * weak corroborating header. This catches older Exchange/Notes responders that
 * stamp "Automatic reply" and Precedence: bulk but no Auto-Submitted, while
 * never firing on a human reply — whose subject is "Re: <our subject>" and which
 * carries none of these headers.
 */
function heuristicSignal(email: InboundEmail): string | null {
  if (!VACATION_SUBJECT.test(email.subject ?? "")) return null;

  const precedence = header(email, "precedence")?.trim().toLowerCase();
  if (precedence && ["bulk", "list", "junk"].includes(precedence)) {
    return `subject + Precedence: ${precedence}`;
  }
  if (header(email, "x-auto-response-suppress")) return "subject + X-Auto-Response-Suppress";
  if (header(email, "return-path")?.trim() === "<>") return "subject + null Return-Path";
  if (/\b(?:no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster)\b/i.test(email.from ?? "")) {
    return "subject + no-reply sender";
  }
  return null;
}

/**
 * The signal that identifies this as an auto-reply, or null for a human message.
 *
 * NOTE what is deliberately absent: body or subject phrasing alone never
 * triggers. The counterexample that sets this rule is a real booking reply —
 * "Sorry for the slow reply, I was out of the office last week — yes, the 14th
 * works, what would you charge?" — which must engage the lead like any other
 * answer. Its subject is "Re: …" and it carries no responder header, so neither
 * tier fires.
 */
export function detectAutoReply(email: InboundEmail): string | null {
  return authoritativeSignal(email) ?? heuristicSignal(email);
}
