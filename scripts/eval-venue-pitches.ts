/**
 * Live venue-pitch release eval.
 *
 *   npm run eval:venue-pitches
 *   RUNS=3 npm run eval:venue-pitches   # release confidence / variance pass
 *
 * Production generation already performs one corrective regeneration and
 * fails closed. This runner never retries around that boundary: a thrown
 * generation is a real safety failure. No database rows are written because
 * every scenario uses business.id = null.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { VENUE_PITCH_SCENARIOS } from "../evals/venue-pitch-scenarios";
import { generateVenuePitch, validateVenuePitch } from "../lib/agent/venue-pitch";

const RUNS = Math.max(1, Math.min(5, Number(process.env.RUNS ?? 1) || 1));

type Failure = {
  scenario: string;
  run: number;
  safety: string[];
  quality: string[];
  subject?: string;
  body?: string;
  latencyMs: number;
};

async function runOne(
  scenario: (typeof VENUE_PITCH_SCENARIOS)[number],
  run: number,
): Promise<Failure | null> {
  const started = performance.now();
  try {
    const result = await generateVenuePitch(scenario.request);
    const checked = validateVenuePitch(scenario.request, result);
    const quality: string[] = [];
    for (const pattern of scenario.expect.mustInclude ?? []) {
      if (!pattern.test(result.body)) quality.push(`missing grounded scenario detail: ${pattern}`);
    }
    for (const pattern of scenario.expect.mustNotInclude ?? []) {
      const hit = result.body.match(pattern)?.[0];
      if (hit) quality.push(`contains scenario-forbidden copy: ${hit}`);
    }
    return checked.issues.length || quality.length
      ? {
          scenario: scenario.name,
          run,
          safety: checked.issues,
          quality,
          subject: result.subject,
          body: result.body,
          latencyMs: performance.now() - started,
        }
      : null;
  } catch (error) {
    return {
      scenario: scenario.name,
      run,
      safety: [`runtime generation failed: ${error instanceof Error ? error.message : String(error)}`],
      quality: [],
      latencyMs: performance.now() - started,
    };
  }
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set — no live venue-pitch eval was run.");
    process.exit(1);
  }

  const jobs = VENUE_PITCH_SCENARIOS.flatMap((scenario) =>
    Array.from({ length: RUNS }, (_, index) => ({ scenario, run: index + 1 })),
  );
  const failures: Failure[] = [];
  const latencies: number[] = [];
  const queue = [...jobs];
  console.log(
    `Venue-pitch eval: ${VENUE_PITCH_SCENARIOS.length} scenarios × ${RUNS} run(s) ` +
      `(${jobs.length} generations)`,
  );

  await Promise.all(
    Array.from({ length: Math.min(3, jobs.length) }, async () => {
      while (queue.length) {
        const job = queue.shift();
        if (!job) return;
        const failure = await runOne(job.scenario, job.run);
        if (failure) failures.push(failure);
        if (failure) latencies.push(failure.latencyMs);
        console.log(`  ${failure ? "✗" : "✓"} ${job.scenario.name} · run ${job.run}`);
      }
    }),
  );

  const safetyFailures = failures.filter((failure) => failure.safety.length > 0);
  const qualityFailures = failures.filter((failure) => failure.safety.length === 0);
  const allowedQualityMisses = Math.max(1, Math.floor(jobs.length * 0.05));
  for (const failure of failures) {
    console.log(`\nFAIL ${failure.scenario} · run ${failure.run}${failure.safety.length ? " [SAFETY]" : ""}`);
    for (const issue of [...failure.safety, ...failure.quality]) console.log(`  - ${issue}`);
    if (failure.subject) console.log(`  subject: ${failure.subject}`);
    if (failure.body) console.log(`  body: ${failure.body.slice(0, 500)}`);
  }

  const pass = safetyFailures.length === 0 && qualityFailures.length <= allowedQualityMisses;
  console.log(
    `\n${jobs.length - failures.length}/${jobs.length} clean · ` +
      `${safetyFailures.length} safety · ${qualityFailures.length} quality ` +
      `(allowed quality misses: ${allowedQualityMisses})`,
  );
  console.log(pass ? "PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
