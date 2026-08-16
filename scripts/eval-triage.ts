/**
 * Live triage release eval. It calls the production classifier but no DB.
 * Genuine leads have a zero-tolerance false-positive bar.
 *
 *   npm run eval:triage
 *   RUNS=3 npm run eval:triage
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SPAM_THRESHOLD, triage } from "../lib/inbound/triage";
import type { InboundEmail } from "../lib/inbound/types";

const RUNS = Math.max(1, Math.min(5, Number(process.env.RUNS ?? 1) || 1));
const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "fixtures", "inbound", "generic");

const CASES: { file: string; spam: boolean; why: string }[] = [
  { file: "contact-form-wedding.json", spam: false, why: "normal website inquiry" },
  { file: "terse-price-shopper.json", spam: false, why: "blunt buyer still counts" },
  {
    file: "genuine-booking-with-unsubscribe.json",
    spam: false,
    why: "bulk token cannot outweigh booking intent",
  },
  {
    file: "genuine-marketing-agency-event.json",
    spam: false,
    why: "buyer happens to work at a marketing agency",
  },
  { file: "vendor-seo-solicitation.json", spam: true, why: "corroborated vendor pitch" },
  { file: "scam-overpayment.json", spam: true, why: "strong deterministic payment scam" },
];

async function load(file: string): Promise<InboundEmail> {
  return JSON.parse(await readFile(join(FIXTURES, file), "utf8")) as InboundEmail;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set — no live triage eval was run.");
    process.exit(1);
  }

  const failures: string[] = [];
  let genuineTotal = 0;
  let genuineCorrect = 0;
  let spamTotal = 0;
  let spamCorrect = 0;
  console.log(`Triage eval: ${CASES.length} cases × ${RUNS} run(s)`);

  for (const c of CASES) {
    const email = await load(c.file);
    for (let run = 1; run <= RUNS; run++) {
      try {
        const result = await triage(email, null);
        const gotSpam = result.spamScore >= SPAM_THRESHOLD;
        if (c.spam) {
          spamTotal++;
          if (gotSpam) spamCorrect++;
        } else {
          genuineTotal++;
          if (!gotSpam) genuineCorrect++;
        }
        const ok = gotSpam === c.spam;
        console.log(
          `  ${ok ? "✓" : "✗"} ${c.file} · run ${run} · ` +
            `${result.spamScore.toFixed(2)}${result.reason ? ` · ${result.reason}` : ""}`,
        );
        if (!ok) {
          failures.push(
            `${c.file} run ${run}: expected ${c.spam ? "spam" : "genuine"}, got ` +
              `${gotSpam ? "spam" : "genuine"} (${result.spamScore.toFixed(2)}) — ${c.why}`,
          );
        }
      } catch (error) {
        failures.push(
          `${c.file} run ${run}: classifier threw — ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  const genuineRate = genuineTotal ? genuineCorrect / genuineTotal : 0;
  const spamRate = spamTotal ? spamCorrect / spamTotal : 0;
  // Missing a vendor email is tolerable; hiding a genuine lead is not. The
  // scam/vendor corpus is deliberately tiny, so require every expected catch.
  const pass = failures.length === 0 && genuineRate === 1 && spamRate === 1;
  console.log(
    `\nGenuine protected: ${genuineCorrect}/${genuineTotal} · ` +
      `spam caught: ${spamCorrect}/${spamTotal}`,
  );
  if (failures.length) for (const failure of failures) console.log(`  - ${failure}`);
  console.log(pass ? "PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
