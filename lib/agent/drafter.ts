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
    if (AFFIRM_LANGUAGE.test(result.body)) statement = "affirmed"; // visible safety failure
    else if (REFUSAL_LANGUAGE.test(result.body)) statement = "conflicted";
  } else if (state === "free" || state === "partial") {
    if (AFFIRM_LANGUAGE.test(result.body)) statement = "affirmed";
    else if (REFUSAL_LANGUAGE.test(result.body)) statement = "conflicted"; // model contradicted input — surface it
  } else {
    // unknown date: nothing to affirm
    if (!AFFIRM_LANGUAGE.test(result.body)) statement = "not_addressed";
  }

  return statement === result.availabilityStatement ? result : { ...result, availabilityStatement: statement };
}

/** Pure draft generation — no DB access; evals call this directly. */
export async function generateDraft(req: DraftRequest): Promise<DraftResult> {
  const isFollowUp = req.sequenceStep > 0;

  const task = isFollowUp
    ? `TASK: write follow-up #${req.sequenceStep} — they haven't replied to our last message. Under 90 words. Re-spark the conversation by referencing something specific about THEIR event; add one small piece of value (a tip, an offer to hold the date if still free, an easy question). Zero pressure, zero guilt. Do not repeat earlier wording.`
    : `TASK: write the FIRST reply to this inquiry. Answer what they actually asked. If a matching package exists, mention it with its exact price range. End with one clear, easy next step.`;

  const result = await llmObject<DraftResult>({
    purpose: isFollowUp ? "followup" : "draft",
    businessId: req.business.id,
    system: buildVoicePrompt(req.business, req.packages),
    prompt: [describeLead(req), describeAvailability(req), describeThread(req), task]
      .filter(Boolean)
      .join("\n\n"),
    schema: DraftSchema,
  });
  return normalizeStatement(req, result);
}
