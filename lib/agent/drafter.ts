import { z } from "zod";
import { llmObject } from "@/lib/llm";
import { buildVoicePrompt } from "@/lib/agent/voice";
import type { DraftRequest, DraftResult } from "@/lib/agent/types";

const DraftSchema = z.object({
  subject: z
    .string()
    .min(1)
    .describe(
      "email subject, NEVER empty; reply naturally to their subject when given (no 'Re: Re:'); when they had none, write a warm specific one like 'Your September wedding'",
    ),
  body: z.string().describe("the email body, plain text, no signature placeholders"),
  availabilityStatement: z
    .enum(["affirmed", "conflicted", "not_addressed"])
    .describe(
      "what the body says about the requested date: affirmed = body says/implies the date is open; conflicted = body tells the client the date is already booked/taken/unavailable (ANY honest refusal of the date = conflicted); not_addressed = the body does not discuss date availability at all",
    ),
  wantsProfile: z
    .boolean()
    .describe(
      "true if the CLIENT is asking for more about the act — a profile, press kit, EPK, examples, 'send me details/info/your portfolio'. Judge the client's message, not the reply.",
    ),
  wantsQuote: z
    .boolean()
    .describe(
      "true if the CLIENT is asking about price/cost/rates/a quote, or is clearly ready to talk numbers for a specific event. Judge the client's message, not the reply.",
    ),
});

function describeAvailability(req: DraftRequest): string {
  const a = req.availability;
  switch (a.state) {
    case "free":
      return "AVAILABILITY: the requested date is OPEN. Affirm it warmly.";
    case "partial":
      return `AVAILABILITY: the requested date is OPEN (covered by: ${a.freePerformers.join(", ")}). Affirm availability naturally — do NOT mention roster internals or other bookings.`;
    case "conflict":
      return "AVAILABILITY: the requested date is ALREADY BOOKED. Be honest and kind about it; do NOT affirm the date; offer to recommend an alternative or ask if their date is flexible. Never name the other client.";
    case "timed":
      return `AVAILABILITY: you have a regular commitment that day during ${a.busyWindows.join(", ")}, but you may well be free before or after it. Do NOT say you're fully booked, and do NOT flatly affirm the date either. Mention honestly that you have a set slot that evening and ask what time their event runs, so you can see whether it works around your commitment. Never name the other venue or client.`;
    case "unknown":
      return "AVAILABILITY: no event date known yet. Do not claim availability; warmly ask for their date.";
  }
}

function describeLead(req: DraftRequest): string {
  const l = req.lead;
  return [
    `LEAD (via ${l.source}):`,
    l.subject && `Their subject line: ${l.subject}`,
    l.clientName && `Name: ${l.clientName}`,
    l.eventType && `Event: ${l.eventType}`,
    l.eventDate && `Date: ${l.eventDate}`,
    l.venue && `Venue: ${l.venue}`,
    l.guestCount && `Guests: ~${l.guestCount}`,
    l.budgetHint && `Budget hint: ${l.budgetHint}`,
    `Their message: """${l.message.slice(0, 2000)}"""`,
  ]
    .filter(Boolean)
    .join("\n");
}

function describeThread(req: DraftRequest): string {
  if (req.thread.length === 0) return "";
  const lines = req.thread
    .slice(-6)
    .map((m) => `${m.direction === "INBOUND" ? "CLIENT" : "US"}: ${m.body.slice(0, 600)}`)
    .join("\n---\n");
  return `CONVERSATION SO FAR:\n${lines}`;
}

const REFUSAL_LANGUAGE =
  /(already (fully |all )?(booked|taken|committed)|booked (up|that|solid)|not available|unavailable|won'?t be able|can'?t (make|do) (it|that date)|date is taken|fully committed)/i;

const AFFIRM_LANGUAGE =
  /(is (wide )?open|we('| a)re (free|available|open)|date is (free|available)|happy to say we('| a)re free|have (that date|your date) (open|free)|is available)/i;

// Cross-checks for the auto-attach intent flags — the model's self-report is the
// same unreliable class as availabilityStatement, so (mirroring that) we only
// honor wantsQuote/wantsProfile when the CLIENT's message actually contains the
// matching language. Conservative on purpose: a binding quote should never
// auto-attach off a hallucinated intent.
const PRICE_LANGUAGE =
  /(price|pricing|cost|costs|rate\b|rates|quote|quotation|\bfee\b|\bfees\b|budget|how much|charge|per hour|per night|\$|฿|€|£)/i;
const PROFILE_LANGUAGE =
  /(profile|press[\s-]?kit|\bepk\b|portfolio|examples?|demo|samples?|more (info|details|information)|tell me more|what do you (do|offer)|hear (you|your)|see (you|your)|send (me )?(more|your|some))/i;

/**
 * The model's enum self-report is unreliable (~25% mislabels) while its BODIES
 * are consistently correct — so the label that drives UI badges and evals is
 * derived deterministically from the KNOWN input state + body language. The
 * self-report only survives where derivation is inconclusive.
 */
function normalizeStatement(req: DraftRequest, result: DraftResult): DraftResult {
  const { state } = req.availability;
  let statement = result.availabilityStatement;

  if (state === "conflict") {
    // REFUSAL wins when both match (P12.3 eval catch): an honest "July 10 is
    // already booked" often ALSO trips AFFIRM via colleague referrals ("happy
    // to point you to X, who is available") — that is still a refusal. Only a
    // body that affirms WITHOUT ever refusing is the visible safety failure.
    if (REFUSAL_LANGUAGE.test(result.body)) statement = "conflicted";
    else if (AFFIRM_LANGUAGE.test(result.body)) statement = "affirmed"; // visible safety failure
  } else if (state === "free" || state === "partial") {
    if (AFFIRM_LANGUAGE.test(result.body)) statement = "affirmed";
    else if (REFUSAL_LANGUAGE.test(result.body)) statement = "conflicted"; // model contradicted input — surface it
  } else if (state === "timed") {
    // A windowed commitment: the right reply asks about timing (not_addressed).
    // Flag if the model instead flatly affirmed or flatly refused the date.
    if (AFFIRM_LANGUAGE.test(result.body)) statement = "affirmed";
    else if (REFUSAL_LANGUAGE.test(result.body)) statement = "conflicted";
    else statement = "not_addressed";
  } else {
    // unknown date: nothing to affirm
    if (!AFFIRM_LANGUAGE.test(result.body)) statement = "not_addressed";
  }

  // Gate the auto-attach intent flags on real client language (see above).
  const message = req.lead.message ?? "";
  const wantsQuote = result.wantsQuote && PRICE_LANGUAGE.test(message);
  const wantsProfile = result.wantsProfile && PROFILE_LANGUAGE.test(message);

  return { ...result, availabilityStatement: statement, wantsQuote, wantsProfile };
}

/** Pure draft generation — no DB access; evals call this directly. */
export async function generateDraft(req: DraftRequest): Promise<DraftResult> {
  const isFollowUp = req.sequenceStep > 0;
  // Mid-conversation (10.8): we've already replied and the client wrote back.
  // The third task mode — without it, this path took the FIRST-reply task and
  // re-introduced the act mid-thread like a stranger walking in twice.
  const isMidConversation =
    !isFollowUp && req.thread.some((m) => m.direction === "OUTBOUND");

  const task = isFollowUp
    ? `TASK: write follow-up #${req.sequenceStep} — they haven't replied to our last message. Under 90 words. Re-spark the conversation by referencing something specific about THEIR event; add one small piece of value (a tip, an offer to hold the date if still free, an easy question). Zero pressure, zero guilt. Do not repeat earlier wording.`
    : isMidConversation
      ? `TASK: continue this conversation — answer the client's LATEST message. You already introduced yourself earlier in the thread: do NOT re-introduce yourself or the act, do NOT restate packages or prices already given, do not repeat earlier wording. Answer exactly what they just asked, keep whatever is in motion moving (date, price talk, logistics), and end with the one next step that brings the booking closer. Match the thread's tone. Usually under 120 words.`
      : `TASK: write the FIRST reply to this inquiry. Answer what they actually asked. If a matching package exists, mention it with its exact price range. End with one clear, easy next step.`;

  // Date grounding (staging catch 2026-07-10): without today's date the model
  // resolved "next year" to a year in the past and confidently promised to
  // "check availability for September 12, 2025" — in July 2026.
  const today = `TODAY: ${new Date().toISOString().slice(0, 10)} — never state a past date for an upcoming event.`;

  const result = await llmObject<DraftResult>({
    purpose: isFollowUp ? "followup" : "draft",
    businessId: req.business.id,
    system: buildVoicePrompt(req.business, req.packages),
    prompt: [today, describeLead(req), describeAvailability(req), describeThread(req), task]
      .filter(Boolean)
      .join("\n\n"),
    schema: DraftSchema,
  });
  return normalizeStatement(req, result);
}
