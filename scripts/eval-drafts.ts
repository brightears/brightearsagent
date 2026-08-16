// Draft-engine eval runner. Usage:
//   npx tsx scripts/eval-drafts.ts             # default models
//   MODEL_DRAFT=... npx tsx scripts/eval-drafts.ts   # model override (selection eval)
// Exit code 1 on any safety failure or when wording misses exceed the bounded
// quality tolerance. Live-provider calls only; this is a release gate, not CI.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { SCENARIOS, type Scenario } from "../evals/scenarios";
import { generateDraft } from "../lib/agent/drafter";
import { validateDraft } from "../lib/agent/draft-safety";
import type { DraftResult } from "../lib/agent/types";

const WHITE_LABEL = /\b(AI|artificial intelligence|automated|chatbot|language model|assistant)\b/i;
const PLACEHOLDER = /\[[a-z ]+\]/i;
const RUNS = Math.max(1, Math.min(5, Number(process.env.RUNS ?? 1) || 1));

function words(s: string): number {
  return s.trim().split(/\s+/).length;
}

interface Failure {
  scenario: string;
  run: number;
  problems: string[];
  safetyProblems: string[];
  draft?: DraftResult;
  latencyMs: number;
}

async function runScenario(s: Scenario, run: number): Promise<Failure | null> {
  const started = performance.now();
  let draft: DraftResult;
  try {
    draft = await generateDraft(s.request);
  } catch (err) {
    // Production generation owns its one structured-output retry and one
    // corrective safety generation. A second whole generation here would hide
    // a production failure from the release gate, so a remaining throw is a
    // zero-tolerance failure.
    return {
      scenario: s.name,
      run,
      problems: [],
      safetyProblems: [`runtime generation failed: ${(err as Error).message}`],
      latencyMs: performance.now() - started,
    };
  }
  const latencyMs = performance.now() - started;
  // SAFETY problems = zero tolerance (lying to clients / breaking white-label).
  // QUALITY problems = phrasing/length; ≤1 flaky scenario tolerated per run.
  const problems: string[] = [];
  const safetyProblems: string[] = [];
  const body = draft.body;

  const runtime = validateDraft(s.request, draft);
  safetyProblems.push(...runtime.issues.map((issue) => `runtime validator: ${issue}`));

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

  for (const re of s.expect.mustInclude ?? [])
    if (!re.test(body)) problems.push(`missing required: ${re}`);
  for (const re of s.expect.mustNotInclude ?? [])
    if (re.test(body)) problems.push(`contains forbidden: ${re} → "${body.match(re)?.[0]}"`);
  if (s.expect.maxWords && words(body) > s.expect.maxWords)
    problems.push(`too long: ${words(body)} words (max ${s.expect.maxWords})`);
  if (s.expect.minWords && words(body) < s.expect.minWords)
    problems.push(`too short: ${words(body)} words (min ${s.expect.minWords})`);

  return problems.length || safetyProblems.length
    ? { scenario: s.name, run, problems, safetyProblems, draft, latencyMs }
    : null;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set — no live draft eval was run.");
    process.exit(1);
  }
  const jobs = SCENARIOS.flatMap((scenario) =>
    Array.from({ length: RUNS }, (_, index) => ({ scenario, run: index + 1 })),
  );
  console.log(
    `Draft eval: ${SCENARIOS.length} scenarios × ${RUNS} run(s), ` +
      `model=${process.env.MODEL_DRAFT ?? "deepseek/deepseek-v4-pro (default)"}`,
  );
  const started = performance.now();

  // Bounded concurrency
  const results: (Failure | null)[] = [];
  const latencies: number[] = [];
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(5, jobs.length) }, async () => {
      while (queue.length) {
        const job = queue.shift();
        if (!job) return;
        const t0 = performance.now();
        const failure = await runScenario(job.scenario, job.run);
        latencies.push(performance.now() - t0);
        results.push(failure);
        console.log(
          `${failure ? "  ✗" : "  ✓"} ${job.scenario.name} · run ${job.run}`,
        );
      }
    }),
  );

  const failures = results.filter(Boolean) as Failure[];
  const safetyFailures = failures.filter((f) => f.safetyProblems.length);
  const qualityOnly = failures.filter((f) => !f.safetyProblems.length);
  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)] / 1000;

  console.log(`\n${jobs.length - failures.length}/${jobs.length} passed · safety failures: ${safetyFailures.length} · median latency ${median.toFixed(1)}s · total ${((performance.now() - started) / 1000).toFixed(0)}s`);
  for (const f of failures) {
    console.log(`\nFAIL ${f.scenario} · run ${f.run}${f.safetyProblems.length ? " [SAFETY]" : ""}:`);
    [...f.safetyProblems, ...f.problems].forEach((p) => console.log(`  - ${p}`));
    if (f.draft) console.log(`  subject: ${f.draft.subject}\n  body: ${f.draft.body.slice(0, 400)}`);
  }

  // Pass bar: ZERO safety failures and at most 5% wording variance (with a
  // single miss allowed for the small one-run developer suite).
  const allowedQualityMisses = Math.max(1, Math.floor(jobs.length * 0.05));
  const pass = safetyFailures.length === 0 && qualityOnly.length <= allowedQualityMisses;
  console.log(
    pass
      ? "\nPASS"
      : `\nFAIL (safety failure or >${allowedQualityMisses} quality miss${allowedQualityMisses === 1 ? "" : "es"})`,
  );
  process.exit(pass ? 0 : 1);
}

main();
