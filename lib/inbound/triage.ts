import { z } from "zod";
import { llmObject } from "@/lib/llm";
import type { InboundEmail } from "@/lib/inbound/types";

export interface TriageResult {
  spamScore: number; // 0-1
  reason?: string;
}

/**
 * Heuristic pass — cheap, deterministic, test-friendly. Catches the documented
 * scam patterns vendors actually receive (advance-fee/overpayment is the #1).
 */
export function triageHeuristics(email: InboundEmail): TriageResult {
  const text = `${email.subject}\n${email.textBody}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  const patterns: Array<[RegExp, number, string]> = [
    [/(cashier'?s? check|certified check|money order).{0,200}(difference|refund|send back|wire)/s, 0.9, "Overpayment/wire-back pattern"],
    [/(deaf|hearing impaired).{0,200}(check|payment in advance)/s, 0.5, "Classic scam framing"],
    [/(western union|moneygram|wire transfer).{0,100}(urgent|immediately|asap)/s, 0.6, "Urgent wire transfer request"],
    [/my (private )?(driver|shipper|agent) will (pick|collect)/s, 0.6, "Third-party pickup pattern"],
    [/\b(bitcoin|usdt|crypto)\b.{0,100}(deposit|payment)/s, 0.4, "Crypto payment push"],
    [/(unsubscribe|view in browser|email preferences)/, 0.5, "Bulk mail markers"],
    [/(seo|web design|marketing) (services|proposal|agency)/, 0.5, "Vendor solicitation"],
  ];

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

/**
 * Full triage: heuristics short-circuit clear cases; the cheap triage model
 * judges the ambiguous middle. SpamAssassin headers (Postmark) add a hint.
 */
export async function triage(
  email: InboundEmail,
  businessId: string | null,
): Promise<TriageResult> {
  const heuristic = triageHeuristics(email);
  if (heuristic.spamScore >= 0.8) return heuristic;

  const spamAssassin = parseFloat(email.headers?.["X-Spam-Score"] ?? "");
  if (!Number.isNaN(spamAssassin) && spamAssassin >= 8) {
    return { spamScore: 0.9, reason: `Provider spam score ${spamAssassin}` };
  }

  if (!process.env.OPENROUTER_API_KEY) return heuristic;

  const llm = await llmObject({
    purpose: "triage",
    businessId,
    system:
      "You classify emails received by a small entertainment business (DJ/band). " +
      "spam = scams (overpayment, wire-back, fake bookings), bulk marketing, vendor solicitations, irrelevant automated notices (receipts, newsletters). " +
      "genuine = real people inquiring about booking entertainment, even if terse or badly written. " +
      "Website contact-form notifications (labeled Name:/Email:/Message: fields, often from a noreply/form-system sender) are GENUINE leads — " +
      "judge the message content, never the delivery mechanism. " +
      "Terse, blunt, or badly-written price questions ('how much for 2 hours?') are GENUINE leads from real buyers, not spam. " +
      "Cost asymmetry: a real lead marked spam loses the business ~$2,000; spam marked genuine costs 5 seconds. When unsure, classify 'unclear' with a low score.",
    prompt: `From: ${email.fromName ?? ""} <${email.from}>\nSubject: ${email.subject}\n\n${email.textBody.slice(0, 4000)}`,
    schema: TriageSchema,
  });

  // The LLM may only escalate when it names a spammable category; heuristics keep their say.
  const llmEffective = SPAMMABLE.has(llm.category) ? llm.spamScore : Math.min(llm.spamScore, 0.3);
  return llmEffective >= heuristic.spamScore
    ? { spamScore: llmEffective, reason: `${llm.category}: ${llm.reason}` }
    : heuristic;
}

export const SPAM_THRESHOLD = 0.7;
