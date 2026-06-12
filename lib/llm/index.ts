import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { db } from "@/lib/db";

/**
 * All LLM calls go through here (CLAUDE.md rule 10): OpenRouter gateway,
 * per-purpose model map, usage logged to LlmUsage. No call site names a model.
 */
export type LlmPurpose = "parse" | "triage" | "draft" | "followup" | "venuePitch";

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
  return _openrouter(model);
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
}): Promise<T> {
  const model = modelFor(opts.purpose);
  const result = await generateObject({
    model: openrouter(model),
    system: opts.system,
    prompt: opts.prompt,
    schema: opts.schema,
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
  });
  await logUsage(opts.businessId, opts.purpose, model, result.usage);
  return result.text;
}
