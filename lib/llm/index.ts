import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { db } from "@/lib/db";

/**
 * All LLM calls go through here (CLAUDE.md rule 10): OpenRouter gateway,
 * per-purpose model map, usage logged to LlmUsage. No call site names a model.
 */
export type LlmPurpose = "parse" | "triage" | "draft" | "followup";

const MODELS: Record<LlmPurpose, string> = {
  parse: process.env.MODEL_PARSE ?? "deepseek/deepseek-v4-flash",
  triage: process.env.MODEL_TRIAGE ?? "deepseek/deepseek-v4-flash",
  draft: process.env.MODEL_DRAFT ?? "deepseek/deepseek-v4-pro",
  followup: process.env.MODEL_FOLLOWUP ?? "deepseek/deepseek-v4-pro",
};

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

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
  const model = MODELS[opts.purpose];
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
  const model = MODELS[opts.purpose];
  const result = await generateText({
    model: openrouter(model),
    system: opts.system,
    prompt: opts.prompt,
  });
  await logUsage(opts.businessId, opts.purpose, model, result.usage);
  return result.text;
}
