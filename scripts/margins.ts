// Ops utility: print month-to-date per-tenant LLM cost vs plan price.
// Usage: npx tsx scripts/margins.ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

async function main() {
  const { computeMargins } = await import("../lib/billing/margin");
  const rows = await computeMargins();
  for (const r of rows) {
    console.log(
      `${r.flagged ? "⚠️ " : "   "}${r.businessName} [${r.plan}] — LLM $${r.llmCostUsd} vs plan $${r.planUsd} → ${r.grossMarginPct}% margin`,
    );
  }
  process.exit(0);
}
main();
