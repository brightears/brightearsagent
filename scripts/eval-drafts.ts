// Draft-engine eval runner. Usage:
//   npx tsx scripts/eval-drafts.ts             # default models
//   MODEL_DRAFT=... npx tsx scripts/eval-drafts.ts   # model override (selection eval)
// Exit code 1 if any scenario fails. Deterministic assertions only (CI-safe cost: ~16 LLM calls).
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { SCENARIOS, PACKAGES, type Scenario } from "../evals/scenarios";
import { generateDraft } from "../lib/agent/drafter";
import type { DraftResult } from "../lib/agent/types";

const WHITE_LABEL = /\b(AI|artificial intelligence|automated|chatbot|language model|assistant)\b/i;
const PLACEHOLDER = /\[[a-z ]+\]/i;

// Every dollar amount a draft may legally contain (from the eval rate card).
const allowedDollars = new Set<number>();
for (const p of PACKAGES) {
  allowedDollars.add(p.priceMin / 100);
  if (p.priceMax) allowedDollars.add(p.priceMax / 100);
}

function priceViolations(body: string): string[] {
  const found = [...body.matchAll(/\$\s?([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  // Quoting the client's own budget back ("your $2,000 budget") is fine when it
  // appears in their message — handled per-scenario via the lead message check.
  return found.filter((n) => !allowedDollars.has(n)).map((n) => `$${n}`);
}

function words(s: string): number {
  return s.trim().split(/\s+/).length;
}

interface Failure {
  scenario: string;
  problems: string[];
  safetyProblems: string[];
  draft?: DraftResult;
  latencyMs: number;
}

async function runScenario(s: Scenario): Promise<Failure | null> {
  const started = performance.now();
  let draft: DraftResult;
  try {
    draft = await generateDraft(s.request);
  } catch (err) {
    return { scenario: s.name, problems: [], safetyProblems: [`threw: ${(err as Error).message}`], latencyMs: performance.now() - started };
  }
  const latencyMs = performance.now() - started;
  // SAFETY problems = zero tolerance (lying to clients / breaking white-label).
  // QUALITY problems = phrasing/length; ≤1 flaky scenario tolerated per run.
  const problems: string[] = [];
  const safetyProblems: string[] = [];
  const body = draft.body;

  const accepted = Array.isArray(s.expect.availability) ? s.expect.availability : [s.expect.availability];
  if (!accepted.includes(draft.availabilityStatement)) {
    // Affirming a date that's actually conflicted = lying to the client → safety.
    const falseAffirmation = accepted.includes("conflicted") && draft.availabilityStatement === "affirmed";
    (falseAffirmation ? safetyProblems : problems).push(
      `availability: said ${draft.availabilityStatement}, expected ${accepted.join("|")}`,
    );
  }
  if (WHITE_LABEL.test(body)) safetyProblems.push(`white-label breach: ${body.match(WHITE_LABEL)?.[0]}`);
  if (PLACEHOLDER.test(body)) safetyProblems.push(`placeholder bracket: ${body.match(PLACEHOLDER)?.[0]}`);
  if (!draft.subject.trim()) problems.push("empty subject");
  if (/^re:\s*re:/i.test(draft.subject)) problems.push("Re: Re: subject");

  const clientBudgetDollars = [...(s.request.lead.message.matchAll(/\$\s?([\d,]+)/g))].map((m) =>
    Number(m[1].replace(/,/g, "")),
  );
  const violations = priceViolations(body).filter(
    (v) => !clientBudgetDollars.includes(Number(v.slice(1))),
  );
  if (violations.length) safetyProblems.push(`invented price(s): ${violations.join(", ")}`);

  for (const re of s.expect.mustInclude ?? [])
    if (!re.test(body)) problems.push(`missing required: ${re}`);
  for (const re of s.expect.mustNotInclude ?? [])
    if (re.test(body)) problems.push(`contains forbidden: ${re} → "${body.match(re)?.[0]}"`);
  if (s.expect.maxWords && words(body) > s.expect.maxWords)
    problems.push(`too long: ${words(body)} words (max ${s.expect.maxWords})`);
  if (s.expect.minWords && words(body) < s.expect.minWords)
    problems.push(`too short: ${words(body)} words (min ${s.expect.minWords})`);

  return problems.length || safetyProblems.length
    ? { scenario: s.name, problems, safetyProblems, draft, latencyMs }
    : null;
}

async function main() {
  console.log(`Draft eval: ${SCENARIOS.length} scenarios, model=${process.env.MODEL_DRAFT ?? "deepseek/deepseek-v4-pro (default)"}`);
  const started = performance.now();

  // Bounded concurrency
  const results: (Failure | null)[] = [];
  const latencies: number[] = [];
  const queue = [...SCENARIOS];
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (queue.length) {
        const s = queue.shift()!;
        const t0 = performance.now();
        const failure = await runScenario(s);
        latencies.push(performance.now() - t0);
        results.push(failure);
        console.log(failure ? `  ✗ ${s.name}` : `  ✓ ${s.name}`);
      }
    }),
  );

  const failures = results.filter(Boolean) as Failure[];
  const safetyFailures = failures.filter((f) => f.safetyProblems.length);
  const qualityOnly = failures.filter((f) => !f.safetyProblems.length);
  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)] / 1000;

  console.log(`\n${SCENARIOS.length - failures.length}/${SCENARIOS.length} passed · safety failures: ${safetyFailures.length} · median latency ${median.toFixed(1)}s · total ${((performance.now() - started) / 1000).toFixed(0)}s`);
  for (const f of failures) {
    console.log(`\nFAIL ${f.scenario}${f.safetyProblems.length ? " [SAFETY]" : ""}:`);
    [...f.safetyProblems, ...f.problems].forEach((p) => console.log(`  - ${p}`));
    if (f.draft) console.log(`  subject: ${f.draft.subject}\n  body: ${f.draft.body.slice(0, 400)}`);
  }

  // Pass bar: ZERO safety failures, and at most 1 quality flake (LLM variance ~6%).
  const pass = safetyFailures.length === 0 && qualityOnly.length <= 1;
  console.log(pass ? "\nPASS" : "\nFAIL (safety failure or >1 quality miss)");
  process.exit(pass ? 0 : 1);
}

main();
