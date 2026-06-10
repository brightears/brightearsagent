// Blind A/B judge: two draft models write replies for the same scenarios; a
// stronger judge model picks which would more likely win the booking.
// Usage: npx tsx scripts/judge-drafts.ts <modelA> <modelB>
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

async function main() {
  const [, , modelA, modelB] = process.argv;
  if (!modelA || !modelB) {
    console.error("usage: tsx scripts/judge-drafts.ts <modelA> <modelB>");
    process.exit(1);
  }

  const { SCENARIOS } = await import("../evals/scenarios");
  const { generateDraft } = await import("../lib/agent/drafter");
  const { llmObject } = await import("../lib/llm");
  const { z } = await import("zod");

  // First-reply scenarios only — the money moment.
  const picks = SCENARIOS.filter((s) => s.request.sequenceStep === 0).slice(0, 8);

  const JUDGE_MODEL = "anthropic/claude-sonnet-4.6";

  let a = 0, b = 0, tie = 0;
  for (const s of picks) {
    process.env.MODEL_DRAFT = modelA;
    const draftA = await generateDraft(s.request);
    process.env.MODEL_DRAFT = modelB;
    const draftB = await generateDraft(s.request);

    // Randomize position to avoid order bias (deterministic per scenario name).
    const flip = s.name.length % 2 === 0;
    const [first, second] = flip ? [draftB, draftA] : [draftA, draftB];

    process.env.MODEL_DRAFT = JUDGE_MODEL; // judge ≠ candidates
    const verdict = await llmObject({
      purpose: "draft",
      businessId: null,
      system:
        "You are a wedding-industry sales coach judging two email replies to the same client inquiry. " +
        "Pick the reply more likely to get a response and win the booking: warmth, specificity to THIS client, " +
        "natural human voice (not template-ish), clear next step, appropriate length. Judge the writing, not the facts.",
      prompt: `CLIENT INQUIRY:\n${s.request.lead.message}\n\nREPLY 1:\n${first.body}\n\nREPLY 2:\n${second.body}\n\nWhich wins: 1 or 2?`,
      schema: z.object({ winner: z.enum(["1", "2", "tie"]), reason: z.string() }),
    });

    const w =
      verdict.winner === "tie" ? "tie" : (verdict.winner === "1") === !flip ? "A" : "B";
    if (w === "A") a++; else if (w === "B") b++; else tie++;
    console.log(`${s.name}: ${w} — ${verdict.reason}`);
  }

  console.log(`\n${modelA} (A): ${a} · ${modelB} (B): ${b} · ties: ${tie}`);
}

main();
