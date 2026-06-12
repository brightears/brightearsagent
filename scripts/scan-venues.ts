// Manual LIVE discovery scan (Phase 10.2b): runs the full pipeline (Serper →
// LLM extraction → ingest → contact pass) for one tenant and prints what the
// scan found, with cost accounting (Serper queries + LLM tokens).
//
//   DEV_TENANT_SLUG=demo-dj-co npx tsx --env-file=.env.local scripts/scan-venues.ts --force
//
// --force bypasses the 20h scan-budget guard (the cron never does). Without
// --force a recent scan makes this print the refusal and exit — that's the
// guard working, not a bug.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const SLUG = process.env.DEV_TENANT_SLUG ?? "demo-dj-co";
const FORCE = process.argv.includes("--force");

// Flash-tier pricing for the cost line (CLAUDE.md rule 10 defaults).
const PARSE_IN_PER_M = 0.098;
const PARSE_OUT_PER_M = 0.197;

async function main() {
  const { db } = await import("../lib/db");
  const { runDiscoveryScan } = await import("../lib/discovery/scan");

  const business = await db.business.findUnique({ where: { slug: SLUG } });
  if (!business) {
    console.error(`Tenant "${SLUG}" not found — set DEV_TENANT_SLUG.`);
    process.exit(1);
  }
  if (!process.env.SERPER_API_KEY) {
    console.error("SERPER_API_KEY missing — a live scan needs it (.env.local).");
    process.exit(1);
  }

  console.log(
    `Live scan for "${SLUG}" — cities [${business.serviceCities.join(", ")}], country ${business.country}` +
      (FORCE ? " (--force: budget guard bypassed)" : ""),
  );

  const started = new Date();
  const result = await runDiscoveryScan(business.id, { force: FORCE });

  if (!result.ran) {
    console.log(`Scan refused: ${result.reason}`);
    process.exit(0);
  }

  for (const m of result.metros) {
    console.log(
      `${m.city}: ${m.rawSignals} accepted signals → ${m.created} venues created, ${m.updated} updated, ${m.skipped} skipped`,
    );
  }
  if (result.contacts) {
    const c = result.contacts;
    console.log(
      `Contact pass: ${c.eligible} eligible, ${c.attempted} attempted, ${c.found.length} emails found, ${c.suppressed.length} suppressed`,
    );
    for (const f of c.found) console.log(`  @ ${f.name}: ${f.email} (${f.source})`);
  }

  const venues = await db.venue.findMany({
    where: { businessId: business.id },
    orderBy: { fitScore: "desc" },
    include: { signals: { select: { type: true } } },
  });
  console.log(`\n${venues.length} venue rows for "${SLUG}":`);
  for (const v of venues) {
    console.log(
      `  [${String(v.fitScore).padStart(3)}] ${v.name} — ${v.kind}, ${v.city} ${v.country} ` +
        `(${v.signals.map((s) => s.type).join(", ") || "no signals"}, ${v.status})`,
    );
    for (const r of v.fitReasons) console.log(`        + ${r}`);
    if (v.caution) console.log(`        ! ${v.caution}`);
    if (v.bookingEmail) console.log(`        @ ${v.bookingEmail} (${v.contactSource ?? "unknown source"})`);
  }

  // Cost accounting: Serper queries + LLM tokens logged during this run.
  const usage = await db.llmUsage.findMany({
    where: { businessId: business.id, createdAt: { gte: started }, purpose: "parse" },
  });
  const inTok = usage.reduce((n, u) => n + u.inputTokens, 0);
  const outTok = usage.reduce((n, u) => n + u.outputTokens, 0);
  const llmUsd = (inTok / 1e6) * PARSE_IN_PER_M + (outTok / 1e6) * PARSE_OUT_PER_M;
  console.log(
    `\nCost: ${result.serperQueries} Serper queries (~$${((result.serperQueries / 1000) * 1).toFixed(4)} at $1/1k worst case)` +
      `, LLM ${inTok} in / ${outTok} out tokens (~$${llmUsd.toFixed(5)})`,
  );
}

main().then(() => process.exit(0));
