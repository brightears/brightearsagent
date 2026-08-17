import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { db } from "@/lib/db";

/**
 * All LLM calls go through here (CLAUDE.md rule 10): OpenRouter gateway,
 * per-purpose model map, usage logged to LlmUsage. No call site names a model.
 */
export type LlmPurpose = "parse" | "triage" | "draft" | "followup" | "venuePitch";

/**
 * Hard wall-clock budgets for the complete provider call, including any AI SDK
 * retry. Parse and triage run on the inbound webhook (in parallel) and must
 * return quickly enough for Postmark to retry a transient failure. Customer-
 * facing prose has larger prompts/outputs and runs outside the synchronous
 * webhook response, so it gets a deliberately more generous ceiling.
 */
const LLM_TIMEOUT_MS: Record<LlmPurpose, number> = {
  triage: 20_000,
  parse: 30_000,
  draft: 90_000,
  followup: 90_000,
  venuePitch: 90_000,
};

export function timeoutMsFor(purpose: LlmPurpose): number {
  return LLM_TIMEOUT_MS[purpose];
}

function callDeadline(purpose: LlmPurpose, requestedMs?: number): {
  abortSignal: AbortSignal;
  timeout: { totalMs: number };
} {
  const purposeMs = timeoutMsFor(purpose);
  const totalMs = Math.max(1, Math.min(purposeMs, requestedMs ?? purposeMs));
  return {
    // Explicitly pass the signal all the way to the provider transport. The AI
    // SDK timeout also bounds its own retries; using both prevents either layer
    // from extending a hung call beyond this purpose's total budget.
    abortSignal: AbortSignal.timeout(totalMs),
    timeout: { totalMs },
  };
}

// Read lazily so scripts (dotenv after import hoisting; eval model overrides)
// and Next.js runtime env all behave identically.
export function modelFor(purpose: LlmPurpose): string {
  const defaults: Record<LlmPurpose, string> = {
    parse: "deepseek/deepseek-v4-flash",
    triage: "deepseek/deepseek-v4-flash",
    draft: "deepseek/deepseek-v4-pro",
    followup: "deepseek/deepseek-v4-pro",
    // Venue pitches are client-facing prose — same quality tier as draft
    // (ADR-002 pattern: cheap flash for parsing, pro for anything a human reads).
    venuePitch: "deepseek/deepseek-v4-pro",
  };
  const envKey = `MODEL_${purpose.toUpperCase()}`;
  return process.env[envKey] ?? defaults[purpose];
}

// Lazy: scripts load dotenv after import hoisting; Next.js injects env at runtime.
let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
function openrouter(model: string) {
  if (!_openrouter) {
    _openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY ?? "" });
  }
  return _openrouter(model, {
    // Customer and lead content may be needed to create a reply, but it must
    // never be retained by a model host or used for generalized model
    // training. Enforce both routing controls on every request instead of
    // relying on an account-dashboard setting that can drift.
    provider: { data_collection: "deny", zdr: true },
  });
}

async function logUsage(
  businessId: string | null,
  purpose: LlmPurpose,
  model: string,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
) {
  if (!businessId) return;
  try {
    await db.llmUsage.create({
      data: {
        businessId,
        purpose,
        model,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      },
    });
  } catch {
    // Usage logging must never break the pipeline.
  }
}

export async function llmObject<T>(opts: {
  purpose: LlmPurpose;
  businessId: string | null;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Optional stricter per-call wall clock; never extends the purpose ceiling. */
  timeoutMs?: number;
  /** Explicit transport retry budget for operations with an outer deadline. */
  maxRetries?: number;
}): Promise<T> {
  const model = modelFor(opts.purpose);
  const result = await generateObject({
    model: openrouter(model),
    system: opts.system,
    prompt: opts.prompt,
    schema: opts.schema,
    ...callDeadline(opts.purpose, opts.timeoutMs),
    ...(opts.maxRetries === undefined ? {} : { maxRetries: opts.maxRetries }),
    // Extraction and classification are lookups, not writing: the answer is
    // already in the text and there is nothing to be creative about. Left at
    // the provider default (~1.0) the same message parsed three different ways
    // on three consecutive runs — once returning nothing but isInquiry — and
    // because every field is .nullish() an empty result is a VALID result, so
    // nothing threw, nothing retried, and the lead was created with no date and
    // no event type. A lead with no date silently disables the availability
    // check, which is the one sentence the product exists to send.
    temperature: 0,
  });
  await logUsage(opts.businessId, opts.purpose, model, result.usage);
  return result.object;
}

export async function llmText(opts: {
  purpose: LlmPurpose;
  businessId: string | null;
  system: string;
  prompt: string;
}): Promise<string> {
  const model = modelFor(opts.purpose);
  const result = await generateText({
    model: openrouter(model),
    system: opts.system,
    prompt: opts.prompt,
    ...callDeadline(opts.purpose),
  });
  await logUsage(opts.businessId, opts.purpose, model, result.usage);
  return result.text;
}
