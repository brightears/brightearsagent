/**
 * Extraction model bake-off. Runs every ground-truth case through
 * parseFallback under each candidate model and scores field-by-field.
 *
 *   npm run eval:parse
 *   npx tsx scripts/eval-parse.ts deepseek/deepseek-v4-flash,deepseek/deepseek-v4-pro
 *   RUNS=3 npm run eval:parse     # repeat each case to expose flakiness
 *
 * CLAUDE.md rule 10: the cheapest model that passes wins, per purpose. This is
 * the suite that decides it for `parse`. Consistency is scored as well as
 * accuracy — an extractor that is right two runs in three is not usable, since
 * a missed eventDate silently disables the availability check for that lead.
 *
 * No database and no tenant: parseFallback is called with businessId=null, so
 * nothing is written and usage is not logged.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { PARSE_CASES, type ParseCase } from "../evals/parse-cases";

const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash", // current default
  "deepseek/deepseek-v4-pro",
];
const MODELS = (process.argv[2] ?? process.env.MODELS ?? DEFAULT_MODELS.join(",")).split(",").map((m) => m.trim()).filter(Boolean);
const RUNS = Number(process.env.RUNS ?? 1);

type Field = "isInquiry" | "eventType" | "eventDate" | "clientName" | "guestCount" | "venue";
const FIELDS: Field[] = ["isInquiry", "eventType", "eventDate", "clientName", "guestCount", "venue"];

interface Tally { hit: number; total: number; hallucinated: number }
const blank = (): Tally => ({ hit: 0, total: 0, hallucinated: 0 });

function scoreField(field: Field, expected: unknown, parsed: Record<string, unknown> | null): "skip" | "hit" | "miss" | "hallucinated" {
  if (expected === undefined) return "skip";

  if (field === "isInquiry") {
    // parseFallback returns null when the model says it is not an inquiry.
    return (parsed !== null) === (expected as boolean) ? "hit" : "miss";
  }
  if (parsed === null) return "miss"; // dropped the whole lead

  const got = parsed[field];
  if (expected === null) return got == null ? "hit" : "hallucinated";
  if (got == null) return "miss";

  if (expected instanceof RegExp) return expected.test(String(got)) ? "hit" : "miss";
  if (typeof expected === "number") return Number(got) === expected ? "hit" : "miss";
  return String(got) === String(expected) ? "hit" : "miss";
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set — nothing to test against.");
    process.exit(1);
  }
  const { parseFallback } = await import("../lib/inbound/parsers/fallback");

  const perModel = new Map<string, Map<Field, Tally>>();
  const caseNotes: string[] = [];

  for (const model of MODELS) {
    process.env.MODEL_PARSE = model; // modelFor() reads this lazily, per call
    const tallies = new Map<Field, Tally>(FIELDS.map((f) => [f, blank()]));
    perModel.set(model, tallies);

    console.log(`\n▸ ${model}`);
    for (const c of PARSE_CASES) {
      const outcomes: string[] = [];
      for (let run = 0; run < RUNS; run++) {
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = (await parseFallback(
            { from: c.from, fromName: c.fromName, to: "leads@eval.in.brightears.io", subject: c.subject, textBody: c.body, headers: {} } as never,
            null,
          )) as unknown as Record<string, unknown> | null;
        } catch (err) {
          caseNotes.push(`${model} / ${c.id}: threw — ${err instanceof Error ? err.message : String(err)}`);
        }

        for (const f of FIELDS) {
          const verdict = scoreField(f, (c.expect as Record<string, unknown>)[f], parsed);
          if (verdict === "skip") continue;
          const t = tallies.get(f)!;
          t.total++;
          if (verdict === "hit") t.hit++;
          if (verdict === "hallucinated") { t.hallucinated++; caseNotes.push(`${model} / ${c.id}: invented ${f} = ${JSON.stringify(parsed?.[f])}`); }
          if (verdict === "miss") caseNotes.push(`${model} / ${c.id}: ${f} — wanted ${String((c.expect as Record<string, unknown>)[f])}, got ${JSON.stringify(parsed?.[f] ?? null)}`);
        }
        outcomes.push(parsed === null ? "not-inquiry" : "parsed");
      }
      console.log(`   ${c.id.padEnd(30)} ${outcomes.join(" ")}`);
    }
  }

  // Scoreboard
  console.log(`\n${"═".repeat(78)}`);
  const head = ["field", ...MODELS.map((m) => m.split("/").pop()!.slice(0, 18))];
  console.log(head[0].padEnd(14) + head.slice(1).map((h) => h.padEnd(22)).join(""));
  console.log("─".repeat(78));
  for (const f of FIELDS) {
    const cells = MODELS.map((m) => {
      const t = perModel.get(m)!.get(f)!;
      if (!t.total) return "—".padEnd(22);
      const pct = Math.round((t.hit / t.total) * 100);
      return `${pct}% (${t.hit}/${t.total})${t.hallucinated ? ` +${t.hallucinated} inv` : ""}`.padEnd(22);
    });
    console.log(f.padEnd(14) + cells.join(""));
  }
  console.log("─".repeat(78));
  const overall = MODELS.map((m) => {
    const ts = [...perModel.get(m)!.values()];
    const hit = ts.reduce((a, t) => a + t.hit, 0);
    const total = ts.reduce((a, t) => a + t.total, 0);
    return { m, pct: total ? Math.round((hit / total) * 100) : 0, hit, total };
  });
  console.log("OVERALL".padEnd(14) + overall.map((o) => `${o.pct}% (${o.hit}/${o.total})`.padEnd(22)).join(""));

  const best = [...overall].sort((a, b) => b.pct - a.pct)[0];
  console.log(`\nbest: ${best.m} at ${best.pct}%`);
  if (caseNotes.length) {
    console.log(`\nmisses (${caseNotes.length}):`);
    for (const n of caseNotes.slice(0, 40)) console.log(`  ${n}`);
    if (caseNotes.length > 40) console.log(`  … ${caseNotes.length - 40} more`);
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
