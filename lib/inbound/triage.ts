import { z } from "zod";
import { llmObject } from "@/lib/llm";
import type { InboundEmail } from "@/lib/inbound/types";
import { reportError } from "@/lib/report-error";

export interface TriageResult {
  spamScore: number; // 0-1
  reason?: string;
}

export const SPAM_THRESHOLD = 0.7;

// A model must never be the only reason a potential booking disappears into
// the spam view. These are high-intent phrases written by a buyer (including
// common contact-form shapes). Strong deterministic scam evidence still wins
// before this guard is considered.
const BUYER_INTENT_PATTERNS: RegExp[] = [
  /\b(?:are|will|would|could) you (?:be )?(?:available|free|play|perform|dj)\b/i,
  /\b(?:can|could|would) (?:we|i) (?:book|hire)\b/i,
  /\b(?:looking for|need|seeking) (?:an? )?(?:wedding |event |party )?(?:dj|band|singer|performer|musician|entertainment)\b/i,
  /\b(?:how much|what (?:would|does|will) (?:it|that) cost|send (?:me|us) (?:your )?(?:rates|prices|packages)|(?:rate|price|package|quote) for)\b/i,
  /^\s*(?:name|e-?mail|phone|event type|event date|message)\s*[:\-]/im,
];

export function hasBuyerIntent(email: InboundEmail): boolean {
  const text = `${email.subject}\n${email.textBody}`;
  return BUYER_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

// Scam patterns (advance-fee etc.) — real-money fraud, ALWAYS applied.
const SCAM_PATTERNS: Array<[RegExp, number, string]> = [
  [/(cashier'?s? check|certified check|money order).{0,200}(difference|refund|send back|wire)/s, 0.9, "Overpayment/wire-back pattern"],
  [/(deaf|hearing impaired).{0,200}(check|payment in advance)/s, 0.5, "Classic scam framing"],
  [/(western union|moneygram|wire transfer).{0,100}(urgent|immediately|asap)/s, 0.6, "Urgent wire transfer request"],
  [/my (private )?(driver|shipper|agent) will (pick|collect)/s, 0.6, "Third-party pickup pattern"],
  [/\b(bitcoin|usdt|crypto)\b.{0,100}(deposit|payment)/s, 0.4, "Crypto payment push"],
];

// Bulk-mail / solicitation markers — meaningful ONLY for unknown-source plain
// email. Platform lead notifications (The Knot/WW/Bark) legitimately contain
// "unsubscribe" links, so these must NOT run on source-parser leads or they'd
// spam-file real inquiries.
const BULK_MARKERS: Array<[RegExp, number, string]> = [
  [/(unsubscribe|view in browser|email preferences)/, 0.5, "Bulk mail markers"],
  [/(seo|web design|marketing) (services|proposal|agency)/, 0.5, "Vendor solicitation"],
];

// A generic word such as "marketing" or "agency" is not enough to hide an
// inquiry. This narrower rule requires BOTH an explicit SEO/web-design product
// and first-person seller language (or a sales-demo CTA). That makes it an
// independently useful signal when the cheap classifier is unavailable or
// under-confident, without turning an event at a marketing agency into spam.
const EXPLICIT_VENDOR_PRODUCT_PATTERNS: RegExp[] = [
  /\b(?:seo|search engine optimi[sz]ation)\s+(?:services?|packages?|proposals?|audits?|campaigns?)\b/i,
  /\b(?:web(?:site)? design|website development)\s+(?:services?|packages?|proposals?)\b/i,
];

const EXPLICIT_VENDOR_SELLER_PATTERNS: RegExp[] = [
  /\b(?:we|our (?:agency|company|team))\s+(?:help|offer|provide|sell|speciali[sz]e|build|design|manage)\b/i,
  /\b(?:book|schedule)\b.{0,40}\b(?:demo|sales call|consultation)\b/i,
  /\b(?:would you have|do you have)\s+\d{1,3}\s+minutes?\s+for\s+(?:a\s+)?(?:demo|call)\b/i,
];

const BULK_MAIL_PATTERNS: RegExp[] = [
  /\bunsubscribe\b/i,
  /\bview in browser\b/i,
  /\bemail preferences\b/i,
];

export function hasHighConfidenceVendorSolicitation(email: InboundEmail): boolean {
  if (hasBuyerIntent(email)) return false;
  const text = `${email.subject}\n${email.textBody}`;
  return (
    EXPLICIT_VENDOR_PRODUCT_PATTERNS.some((pattern) => pattern.test(text)) &&
    EXPLICIT_VENDOR_SELLER_PATTERNS.some((pattern) => pattern.test(text))
  );
}

/**
 * Heuristic pass — cheap, deterministic, test-friendly. `scamOnly` skips the
 * bulk-mail markers (used for high-confidence platform-parsed leads).
 */
export function triageHeuristics(email: InboundEmail, scamOnly = false): TriageResult {
  const text = `${email.subject}\n${email.textBody}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  const patterns = scamOnly ? SCAM_PATTERNS : [...SCAM_PATTERNS, ...BULK_MARKERS];
  for (const [re, weight, label] of patterns) {
    if (re.test(text)) {
      score = Math.min(1, score + weight);
      reasons.push(label);
    }
  }

  return { spamScore: score, reason: reasons.join("; ") || undefined };
}

const TriageSchema = z.object({
  category: z
    .enum(["scam", "bulk_marketing", "vendor_pitch", "automated_notice", "genuine_inquiry", "unclear"])
    .describe("what this email IS"),
  spamScore: z.number().min(0).max(1).describe("1 = certainly spam/scam, 0 = certainly genuine"),
  reason: z.string().describe("one short sentence"),
});

// Only these categories may push a lead into the spam folder. "unclear" never does:
// a missed real lead costs the business ~$2,000; a junk email costs 5 seconds.
const SPAMMABLE = new Set(["scam", "bulk_marketing", "vendor_pitch", "automated_notice"]);

const LLM_CORROBORATION_MIN = 0.4;
const LLM_HIGH_CONFIDENCE_MIN = 0.9;

/**
 * Combine independent triage signals conservatively. An LLM classification is
 * useful supporting evidence, but cannot by itself cross SPAM_THRESHOLD. It
 * needs both a high-confidence spammable category and deterministic junk/scam
 * evidence. Explicit buyer intent vetoes that combined middle ground; only a
 * strong heuristic/provider verdict (handled before this function) may hide it.
 */
export function combineTriageSignals(
  email: InboundEmail,
  heuristic: TriageResult,
  llm: z.infer<typeof TriageSchema>,
): TriageResult {
  const categoryCanBeSpam = SPAMMABLE.has(llm.category);
  const categoryHasIndependentEvidence =
    (llm.category === "vendor_pitch" && hasHighConfidenceVendorSolicitation(email)) ||
    (llm.category === "bulk_marketing" &&
      BULK_MAIL_PATTERNS.some((pattern) => pattern.test(`${email.subject}\n${email.textBody}`))) ||
    (llm.category === "scam" &&
      triageHeuristics(email, /* scamOnly */ true).spamScore >= LLM_CORROBORATION_MIN);
  const corroborated =
    categoryCanBeSpam &&
    categoryHasIndependentEvidence &&
    llm.spamScore >= LLM_HIGH_CONFIDENCE_MIN &&
    heuristic.spamScore >= LLM_CORROBORATION_MIN &&
    !hasBuyerIntent(email);

  if (corroborated) {
    return {
      spamScore: Math.max(SPAM_THRESHOLD, heuristic.spamScore),
      reason: `${llm.category}: ${llm.reason}; corroborated by ${heuristic.reason ?? "deterministic filtering evidence"}`,
    };
  }

  // Keep the observed evidence for owner-visible audit, but cap either signal
  // below the filtering threshold when they do not corroborate one another.
  // Strong deterministic scam verdicts have already returned before this path.
  const llmEffective = categoryCanBeSpam ? Math.min(llm.spamScore, SPAM_THRESHOLD - 0.01) : 0.3;
  const heuristicEffective = Math.min(heuristic.spamScore, SPAM_THRESHOLD - 0.01);
  return llmEffective >= heuristicEffective
    ? {
        spamScore: llmEffective,
        reason: `${llm.category}: ${llm.reason}; not auto-filtered without independent evidence`,
      }
    : {
        spamScore: heuristicEffective,
        reason: heuristic.reason
          ? `${heuristic.reason}; not auto-filtered without high-confidence classifier corroboration`
          : undefined,
      };
}

/**
 * Full triage: heuristics short-circuit clear cases; the cheap triage model
 * judges the ambiguous middle. SpamAssassin headers (Postmark) add a hint.
 */
export async function triage(
  email: InboundEmail,
  businessId: string | null,
): Promise<TriageResult> {
  const heuristic = triageHeuristics(email);
  // Only scam-specific deterministic evidence may short-circuit. Two generic
  // bulk markers can otherwise add up to 1.0 on a genuine contact-form email.
  const scamHeuristic = triageHeuristics(email, /* scamOnly */ true);
  if (scamHeuristic.spamScore >= 0.8) return scamHeuristic;

  const spamAssassin = parseFloat(email.headers?.["X-Spam-Score"] ?? "");
  if (!Number.isNaN(spamAssassin) && spamAssassin >= 8) {
    return { spamScore: 0.9, reason: `Provider spam score ${spamAssassin}` };
  }

  // This is deliberately narrower than BULK_MARKERS. It is safe to use as an
  // independent verdict because it requires a named service being sold, an
  // explicit seller/CTA signal, and no entertainment-buyer intent.
  if (hasHighConfidenceVendorSolicitation(email)) {
    return {
      spamScore: SPAM_THRESHOLD,
      reason: "Explicit SEO/web-design service solicitation with seller evidence",
    };
  }

  if (!process.env.OPENROUTER_API_KEY) {
    // Generic bulk/vendor markers are corroborating evidence, not a safe
    // standalone hide decision. Strong scams and provider verdicts already
    // returned above; with the classifier unavailable, fail open to Inbox.
    return {
      spamScore: Math.min(heuristic.spamScore, SPAM_THRESHOLD - 0.01),
      reason: heuristic.reason
        ? `${heuristic.reason}; not auto-filtered while classifier is unavailable`
        : undefined,
    };
  }

  let llm: z.infer<typeof TriageSchema>;
  try {
    llm = await llmObject({
      purpose: "triage",
      businessId,
      system:
        "You classify emails received by a small entertainment business (DJ/band). " +
        "spam = scams (overpayment, wire-back, fake bookings), bulk marketing, vendor solicitations, irrelevant automated notices (receipts, newsletters). " +
        "genuine = real people inquiring about booking entertainment, even if terse or badly written. " +
      "Website contact-form notifications (labeled Name:/Email:/Message: fields, often from a noreply/form-system sender) are GENUINE leads — " +
      "judge the message content, never the delivery mechanism. " +
      "Terse, blunt, or badly-written price questions ('how much for 2 hours?') are GENUINE leads from real buyers, not spam. " +
      "Always write the category reason in concise English, regardless of the message language. " +
      "Cost asymmetry: a real lead marked spam loses the business ~$2,000; spam marked genuine costs 5 seconds. When unsure, classify 'unclear' with a low score.",
      prompt: `From: ${email.fromName ?? ""} <${email.from}>\nSubject: ${email.subject}\n\n${email.textBody.slice(0, 4000)}`,
      schema: TriageSchema,
    });
  } catch (error) {
    // A provider timeout/outage must never turn the synchronous inbound webhook
    // into a dropped real lead. Log no message content, then fail open to the
    // same bounded deterministic evidence used when no classifier is configured.
    void reportError(error, {
      kind: "triage-classifier",
      businessId,
      detail: "Classifier failed; deterministic triage was kept below the auto-filter threshold.",
    });
    return {
      spamScore: Math.min(heuristic.spamScore, SPAM_THRESHOLD - 0.01),
      reason: heuristic.reason
        ? `${heuristic.reason}; not auto-filtered after classifier failure`
        : "Classifier failed; message left in Inbox for owner review",
    };
  }

  return combineTriageSignals(email, heuristic, llm);
}
