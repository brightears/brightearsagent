import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  createOpenRouter: vi.fn(() => vi.fn(() => ({ provider: "test" }))),
  logUsage: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: mocks.generateObject,
  generateText: mocks.generateText,
}));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: mocks.createOpenRouter,
}));
vi.mock("@/lib/db", () => ({
  db: { llmUsage: { create: mocks.logUsage } },
}));

import {
  llmObject,
  llmText,
  timeoutMsFor,
  type LlmPurpose,
} from "@/lib/llm";

const PURPOSE_TIMEOUTS: [LlmPurpose, number][] = [
  ["triage", 20_000],
  ["parse", 30_000],
  ["draft", 90_000],
  ["followup", 90_000],
  ["venuePitch", 90_000],
];

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.generateObject.mockReset().mockResolvedValue({
    object: { ok: true },
    usage: { inputTokens: 2, outputTokens: 1 },
  });
  mocks.generateText.mockReset().mockResolvedValue({
    text: "hello",
    usage: { inputTokens: 2, outputTokens: 1 },
  });
  mocks.logUsage.mockReset().mockResolvedValue({});
});

describe.each(PURPOSE_TIMEOUTS)("LLM %s deadline", (purpose, totalMs) => {
  it("gives every object call the purpose's abort signal and total timeout", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);

    await expect(
      llmObject({
        purpose,
        businessId: null,
        system: "system",
        prompt: "prompt",
        schema: z.object({ ok: z.boolean() }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(timeoutMsFor(purpose)).toBe(totalMs);
    expect(timeout).toHaveBeenCalledOnce();
    expect(timeout).toHaveBeenCalledWith(totalMs);
    expect(mocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: signal,
        timeout: { totalMs },
      }),
    );
  });

  it("gives every text call the purpose's abort signal and total timeout", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);

    await expect(
      llmText({
        purpose,
        businessId: null,
        system: "system",
        prompt: "prompt",
      }),
    ).resolves.toBe("hello");

    expect(timeout).toHaveBeenCalledOnce();
    expect(timeout).toHaveBeenCalledWith(totalMs);
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: signal,
        timeout: { totalMs },
      }),
    );
  });
});

it("propagates provider timeout errors unchanged and does not log fake usage", async () => {
  const timeoutError = new DOMException("The operation timed out", "TimeoutError");
  mocks.generateObject.mockRejectedValueOnce(timeoutError);
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);

  await expect(
    llmObject({
      purpose: "parse",
      businessId: "biz-1",
      system: "system",
      prompt: "prompt",
      schema: z.object({ ok: z.boolean() }),
    }),
  ).rejects.toBe(timeoutError);
  expect(mocks.logUsage).not.toHaveBeenCalled();
});

it("allows a caller to tighten—but never extend—the purpose deadline and transport retries", async () => {
  const signal = new AbortController().signal;
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);

  await llmObject({
    purpose: "draft",
    businessId: null,
    system: "system",
    prompt: "prompt",
    schema: z.object({ ok: z.boolean() }),
    timeoutMs: 45_000,
    maxRetries: 1,
  });
  expect(timeout).toHaveBeenLastCalledWith(45_000);
  expect(mocks.generateObject).toHaveBeenLastCalledWith(
    expect.objectContaining({
      abortSignal: signal,
      timeout: { totalMs: 45_000 },
      maxRetries: 1,
    }),
  );

  await llmObject({
    purpose: "draft",
    businessId: null,
    system: "system",
    prompt: "prompt",
    schema: z.object({ ok: z.boolean() }),
    timeoutMs: 999_000,
  });
  expect(timeout).toHaveBeenLastCalledWith(90_000);
});
