import { z } from "zod";
import { NoObjectGeneratedError } from "ai";
import { llmObject } from "@/lib/llm";
import { buildVoicePrompt, priceRange } from "@/lib/agent/voice";
import {
  groundFirstReplyAvailability,
  isFirstReply,
  selectRelevantPackages,
  unsupportedFeatureQuestion,
  validateDraft,
} from "@/lib/agent/draft-safety";
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

const DRAFT_OPERATION_BUDGET_MS = 120_000;
const DRAFT_CALL_BUDGET_MS = 60_000;

function describeAvailability(req: DraftRequest, requireDisclosure: boolean): string {
  const a = req.availability;
  if (!requireDisclosure) {
    switch (a.state) {
      case "free":
        return "AVAILABILITY GROUNDING: the requested date remains OPEN. Do not repeat this unless it directly answers the client's latest message; never contradict it.";
      case "partial":
        return "AVAILABILITY GROUNDING: the requested date remains OPEN. Do not repeat this unless it directly answers the client's latest message, and never mention roster internals.";
      case "conflict":
        return "AVAILABILITY GROUNDING: the requested date remains ALREADY BOOKED. Never imply it is open; do not repeat the refusal unless the latest message makes it relevant.";
      case "timed":
        return `AVAILABILITY GROUNDING: there is a regular commitment during ${a.busyWindows.join(", ")}. Never claim the whole date is open or unavailable; mention the timing only if it answers the latest message.`;
      case "unknown":
        return "AVAILABILITY GROUNDING: no event date is known. Never claim the calendar is open or booked; ask for the date only when it is the useful next step.";
    }
  }
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

function featureGrounding(req: DraftRequest): string | null {
  const feature = unsupportedFeatureQuestion(req);
  return feature
    ? `FEATURE GROUNDING: the profile and matching package do NOT confirm "${feature}". Do not say yes, included, or promise it. Name that exact feature (use the words "${feature}") and say you need to check/confirm it, then move the conversation forward.`
    : null;
}

function safeFeatureLabel(value: string): string | null {
  let label = value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}\s'’&+/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  while (/^(?:your|our|the|any|an?|own)\s+/i.test(label)) {
    label = label.replace(/^(?:your|our|the|any|an?|own)\s+/i, "");
  }
  return label || null;
}

function deterministicFeatureFallback(req: DraftRequest): DraftResult | null {
  const rawFeature = unsupportedFeatureQuestion(req);
  const feature = rawFeature ? safeFeatureLabel(rawFeature) : null;
  if (!feature) return null;
  const clientFirst = req.lead.clientName?.trim().split(/\s+/)[0];
  const ownerFirst = req.business.ownerName.trim().split(/\s+/)[0] || req.business.ownerName;
  const candidate: DraftResult = {
    subject: "Your event details",
    body: [
      clientFirst ? `Hi ${clientFirst},` : "Hi there,",
      `Thanks for checking. I don’t have ${feature} confirmed in my current setup notes, so I don’t want to guess; let me confirm it and come straight back to you.`,
      `${ownerFirst}\n${req.business.name}`,
    ].join("\n\n"),
    availabilityStatement: "not_addressed",
    wantsProfile: false,
    wantsQuote: false,
  };
  const grounded = groundFirstReplyAvailability(req, candidate);
  const checked = validateDraft(req, grounded);
  return checked.issues.length === 0 ? checked.result : null;
}

function contentTerms(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function bestMatchingPackage(req: DraftRequest) {
  const relevant = selectRelevantPackages(req);
  if (relevant.length < 2) return relevant[0];
  const query = new Set(
    contentTerms([req.lead.subject, req.lead.eventType, req.lead.message].filter(Boolean).join(" ")),
  );
  return relevant
    .map((pkg, index) => ({
      pkg,
      index,
      score: contentTerms(`${pkg.name} ${pkg.description}`).filter((term) => query.has(term)).length,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.pkg;
}

/**
 * Provider-format and repeated unknown-calendar recovery. Every sentence is
 * composed from known fields only, then run through the normal deterministic
 * validator. No regex deletion of model prose, and no extra provider call.
 */
function deterministicKnownFieldsFallback(req: DraftRequest): DraftResult | null {
  const featureFallback = deterministicFeatureFallback(req);
  if (featureFallback) return featureFallback;

  const clientFirstRaw = req.lead.clientName?.trim().split(/\s+/)[0];
  const clientFirst = clientFirstRaw ? safeFeatureLabel(clientFirstRaw) : null;
  const ownerFirst = safeFeatureLabel(req.business.ownerName.trim().split(/\s+/)[0]) ?? "Thanks";
  const businessName = safeFeatureLabel(req.business.name) ?? "";
  const event = safeFeatureLabel(req.lead.eventType ?? "event") ?? "event";
  const asksPrice =
    /(price|pricing|cost|rate|quote|budget|how much|charge|\$|£|€|฿|¥|₹|₩|₫|₱|₽)/i.test(
      [req.lead.message, req.lead.budgetHint].filter(Boolean).join(" "),
    );
  const matchingPackage = bestMatchingPackage(req);
  const groundedPrice =
    asksPrice && matchingPackage && req.availability.state !== "conflict"
      ? `The configured ${safeFeatureLabel(matchingPackage.name) ?? "matching package"} rate is ${priceRange(matchingPackage, req.business.currency)}.`
      : null;
  const intro =
    req.sequenceStep > 0
      ? `Just checking in about your ${event}.`
      : isFirstReply(req)
        ? `Thanks for reaching out about your ${event}.`
        : `Thanks for the update about your ${event}.`;
  const nextStep =
    req.availability.state === "conflict"
      ? "If your date is flexible, what alternative date are you considering?"
      : req.availability.state === "unknown"
        ? "What is the exact event date, including the year? Once I have that, I can check the calendar."
        : req.availability.state === "timed"
          ? "What start and finish time are you considering? I need that before I can confirm how the schedule fits."
          : !req.lead.venue
            ? "What venue are you considering?"
            : !req.lead.guestCount
              ? "About how many guests are you expecting?"
              : "What start and finish time are you considering?";
  const candidate: DraftResult = {
    subject: "Your event inquiry",
    body: [
      clientFirst ? `Hi ${clientFirst},` : "Hi there,",
      [intro, groundedPrice, nextStep].filter(Boolean).join(" "),
      [ownerFirst, businessName].filter(Boolean).join("\n"),
    ].join("\n\n"),
    availabilityStatement: "not_addressed",
    wantsProfile: false,
    wantsQuote: false,
  };
  const checked = validateDraft(req, groundFirstReplyAvailability(req, candidate));
  return checked.issues.length === 0 ? checked.result : null;
}

function isRetryableGenerationError(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error)) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError") return true;
  if (error.name === "AbortError") return /tim(?:e|ed)\s*out|timeout/i.test(error.message);
  const code = (error as Error & { code?: string }).code;
  return (
    ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED"].includes(code ?? "") ||
    /\b(?:socket hang up|network error|fetch failed|temporarily unavailable)\b/i.test(error.message)
  );
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
    l.budgetHint && `CLIENT-STATED BUDGET (context only; never our rate): ${l.budgetHint}`,
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

/** Pure draft generation — no DB access; evals call this directly. */
export async function generateDraft(req: DraftRequest): Promise<DraftResult> {
  const operationDeadline = Date.now() + DRAFT_OPERATION_BUDGET_MS;
  const isFollowUp = req.sequenceStep > 0;
  // Mid-conversation (10.8): we've already replied and the client wrote back.
  // The third task mode — without it, this path took the FIRST-reply task and
  // re-introduced the act mid-thread like a stranger walking in twice.
  const isMidConversation =
    !isFollowUp && req.thread.some((m) => m.direction === "OUTBOUND");
  const requireAvailabilityDisclosure = isFirstReply(req);

  const task = isFollowUp
    ? `TASK: write follow-up #${req.sequenceStep} — they haven't replied to our last message. Under 90 words. Re-spark the conversation by referencing something specific about THEIR event; add one small piece of value (a tip, an offer to hold the date if still free, an easy question). Zero pressure, zero guilt. Do not repeat earlier wording.`
    : isMidConversation
      ? `TASK: continue this conversation — answer the client's LATEST message. You already introduced yourself earlier in the thread: do NOT re-introduce yourself or the act, do NOT restate packages or prices already given, do not repeat earlier wording. Answer exactly what they just asked, keep whatever is in motion moving (date, price talk, logistics), and end with the one next step that brings the booking closer. Match the thread's tone. Usually under 120 words.`
      : `TASK: write the FIRST reply to this inquiry. Answer what they actually asked. If a matching package exists, mention it with its exact price range. End with one clear, easy next step.`;

  // Date grounding (staging catch 2026-07-10): without today's date the model
  // resolved "next year" to a year in the past and confidently promised to
  // "check availability for September 12, 2025" — in July 2026.
  const today = `TODAY: ${new Date().toISOString().slice(0, 10)} — never state a past date for an upcoming event.`;

  const relevantPackages = selectRelevantPackages(req);
  const groundedReq = { ...req, packages: relevantPackages };
  const prompt = [
    today,
    describeLead(groundedReq),
    describeAvailability(groundedReq, requireAvailabilityDisclosure),
    featureGrounding(groundedReq),
    "MONEY GROUNDING: amounts in the client's message or budget field are CLIENT money, never our quote. Our prices may come only from the event-matched PACKAGES & PRICING rate card. Never turn a client budget into our offered price or discount.",
    describeThread(groundedReq),
    task,
  ]
    .filter(Boolean)
    .join("\n\n");
  const purpose = isFollowUp ? "followup" : "draft";
  const system = buildVoicePrompt(req.business, relevantPackages);
  const generateOnce = (attemptPrompt: string) => {
    const remainingMs = operationDeadline - Date.now();
    if (remainingMs <= 0) {
      throw new DOMException("Draft generation exceeded its total deadline", "TimeoutError");
    }
    return llmObject<DraftResult>({
      purpose,
      businessId: req.business.id,
      system,
      prompt: attemptPrompt,
      schema: DraftSchema,
      timeoutMs: Math.min(DRAFT_CALL_BUDGET_MS, remainingMs),
      // The outer operation owns one shared fresh-attempt budget. Keep each
      // logical call to two provider transports so total retry multiplication
      // remains bounded (three logical calls × two transports maximum).
      maxRetries: 1,
    });
  };
  // One fresh attempt covers both malformed structured output and the shared
  // wrapper's hard timeout. The budget is GLOBAL across initial + corrective
  // generation, so semantic correction plus a transient retry tops out at
  // three provider calls. Persistent timeout/auth/provider errors propagate.
  let transientRetryUsed = false;
  const generate = async (attemptPrompt: string): Promise<DraftResult> => {
    try {
      return await generateOnce(attemptPrompt);
    } catch (error) {
      if (transientRetryUsed || !isRetryableGenerationError(error)) throw error;
      transientRetryUsed = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          kind: "draft_transient_retry",
          businessId: req.business.id,
          purpose,
          name: error instanceof Error ? error.name : undefined,
          ts: new Date().toISOString(),
        }),
      );
      return generateOnce(attemptPrompt);
    }
  };
  const check = (candidate: DraftResult) =>
    validateDraft(groundedReq, groundFirstReplyAvailability(groundedReq, candidate));
  const generateOrFormatFallback = async (
    attemptPrompt: string,
    stage: "initial" | "correction",
  ): Promise<DraftResult> => {
    try {
      return await generate(attemptPrompt);
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      const fallback = deterministicKnownFieldsFallback(groundedReq);
      if (!fallback) throw error;
      // Receipt only: enough for provider-quality monitoring, with no generated
      // body, client name, message, feature phrase, venue, or other PII.
      console.warn(
        JSON.stringify({
          level: "warn",
          kind: "draft_provider_format_fallback",
          businessId: req.business.id,
          purpose,
          stage,
          availabilityState: groundedReq.availability.state,
          usedFeatureFallback: unsupportedFeatureQuestion(groundedReq) !== null,
          quotedConfiguredPrice: fallback.body.includes("The configured "),
          ts: new Date().toISOString(),
        }),
      );
      return fallback;
    }
  };

  let checked = check(await generateOrFormatFallback(prompt, "initial"));
  if (checked.issues.length === 0) return checked.result;

  const calendarCorrection = checked.issues.includes("claims availability that is not known")
    ? groundedReq.availability.state === "timed"
      ? "CALENDAR CORRECTION: only a partial-day commitment is known. Do not say the date is free/open/booked or that we can/can't do it; ask for the event timing so it can be checked."
      : "CALENDAR CORRECTION: no exact date is available to the calendar check. Do not say free/open/booked or that we can/can't do it; ask for the exact date before promising availability."
    : null;
  const correction = [
    prompt,
    "CORRECTION REQUIRED: the previous reply failed these deterministic safety checks:",
    ...checked.issues.map((issue) => `- ${issue}`),
    calendarCorrection,
    "Write the corrected finished email now. Return only the email fields; do not mention these checks or explain the correction.",
  ]
    .filter(Boolean)
    .join("\n");
  checked = check(await generateOrFormatFallback(correction, "correction"));
  if (checked.issues.length > 0) {
    if (checked.issues.some((issue) => issue.includes("unsupported feature") || issue.includes("promises a feature"))) {
      const fallback = deterministicFeatureFallback(groundedReq);
      if (fallback) return fallback;
    }
    if (checked.issues.every((issue) => issue === "claims availability that is not known")) {
      const fallback = deterministicKnownFieldsFallback(groundedReq);
      if (fallback) return fallback;
    }
    throw new Error(`draft failed safety validation after regeneration: ${checked.issues.join("; ")}`);
  }
  return checked.result;
}
