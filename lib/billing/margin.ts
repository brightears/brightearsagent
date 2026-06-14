import { db } from "@/lib/db";
import { monthStart } from "@/lib/billing/metering";
import type { PlanTier } from "@/app/generated/prisma/enums";

/** OpenRouter pricing snapshot ($ per M tokens) — update alongside ADR-002. */
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "deepseek/deepseek-v4-flash": { in: 0.098, out: 0.197 },
  "deepseek/deepseek-v4-pro": { in: 0.435, out: 0.87 },
  "google/gemini-3.1-pro-preview": { in: 2.0, out: 12.0 },
};
const FALLBACK_PRICING = { in: 1.0, out: 5.0 }; // unknown models: assume expensive

export const PLAN_PRICES_USD: Record<PlanTier, number> = {
  TRIAL: 25, // margin computed against Starter price during trial
  STARTER: 25,
  PRO: 79,
  STUDIO: 149,
};

export interface MarginRow {
  businessId: string;
  businessName: string;
  plan: PlanTier;
  llmCostUsd: number;
  planUsd: number;
  grossMarginPct: number;
  flagged: boolean;
}

export const MARGIN_FLOOR_PCT = 70;

/**
 * Month-to-date LLM cost vs plan price per tenant; flags margin < 70%.
 *
 * SCOPE (audit D3-NF): this is the LLM-margin lens only — `llmCostUsd` is the
 * sum of `LlmUsage` token cost. It does NOT include the paid Serper discovery
 * API (a per-query external cost tracked only as a count today), so a tenant
 * running heavy proactive scans can erode real gross margin without tripping
 * this 70% alert. To make the alert reflect true margin, persist a priced
 * discovery cost ledger and add it here (Serper's per-query price is public) —
 * tracked in docs/AUDIT-FINDINGS.md.
 */
export async function computeMargins(now = new Date()): Promise<MarginRow[]> {
  const businesses = await db.business.findMany({ select: { id: true, name: true, plan: true } });
  const rows: MarginRow[] = [];
  for (const b of businesses) {
    const usage = await db.llmUsage.groupBy({
      by: ["model"],
      where: { businessId: b.id, createdAt: { gte: monthStart(now) } },
      _sum: { inputTokens: true, outputTokens: true },
    });
    const llmCostUsd = usage.reduce((sum, u) => {
      const p = MODEL_PRICING[u.model] ?? FALLBACK_PRICING;
      return (
        sum +
        ((u._sum.inputTokens ?? 0) / 1_000_000) * p.in +
        ((u._sum.outputTokens ?? 0) / 1_000_000) * p.out
      );
    }, 0);
    const planUsd = PLAN_PRICES_USD[b.plan];
    const grossMarginPct = planUsd > 0 ? ((planUsd - llmCostUsd) / planUsd) * 100 : 0;
    rows.push({
      businessId: b.id,
      businessName: b.name,
      plan: b.plan,
      llmCostUsd: Number(llmCostUsd.toFixed(4)),
      planUsd,
      grossMarginPct: Number(grossMarginPct.toFixed(1)),
      flagged: grossMarginPct < MARGIN_FLOOR_PCT,
    });
  }
  return rows;
}
