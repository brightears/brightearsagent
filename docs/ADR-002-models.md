# ADR-002: Per-purpose model selection

**Date:** June 10, 2026 · **Status:** accepted · Re-run this eval quarterly or when OpenRouter pricing shifts.

## Method
`npm run eval:drafts` (16 deterministic scenarios: price whitelist, availability honesty, white-label, word budgets) run per candidate, plus a blind A/B writing-quality judge (`scripts/judge-drafts.ts`, Claude Sonnet 4.6 as referee, position-randomized, 8 first-reply scenarios). Rule: cheapest model that passes the suite wins; the judge breaks quality ties for the draft purpose (drafts are the product).

## Draft/follow-up candidates (OpenRouter pricing, June 2026, per M tokens in/out)

| Model | $/M in | $/M out | Eval | Median latency | Verdict |
|---|---|---|---|---|---|
| deepseek/deepseek-v4-flash | $0.098 | $0.197 | **16/16** | **5.1s** | see judge |
| deepseek/deepseek-v4-pro | $0.435 | $0.87 | 16/16 (×2 runs) | 8.1–9.5s | see judge |
| z-ai/glm-5 | $0.60 | $1.92 | 8/16 | 8.8s | eliminated (availability + price failures) |
| moonshotai/kimi-k2.6 | $0.68 | $3.41 | 13/16 | 52.6s | eliminated (latency alone disqualifies) |
| anthropic/claude-haiku | $1.00 | $5.00 | not run | — | not needed (cheaper models pass) |

## Judge result (Flash vs Pro, blind A/B — Gemini 3.1 Pro referee, position-randomized, 8 scenarios)
**Pro 5 · Flash 3 · ties 0.** Pro's wins were quality-substantive: better paragraph formatting for mobile, stronger single CTAs, more natural consultant voice; Flash exhibited a character-encoding artifact in one draft and more template-feel. Flash's wins were on conciseness. (Note: Anthropic models via OpenRouter require BYOK on this account — judge swapped to Gemini, which also gives a third-family neutral referee.)

## Decision
- `parse` / `triage`: **deepseek-v4-flash** — already near the cost floor ($0.098/M), proven in E2E; switching to marginally cheaper Qwen-flash variants saves fractions of a cent per lead and isn't worth the variance risk. Re-evaluate if volume makes it material.
- `draft` / `followup`: **deepseek-v4-pro** — passes 16/16 (×2), wins the blind writing-quality judge 5–3, ~8s median latency, ~$0.002 per draft. Drafts are the product; the 4x cost difference vs Flash is economically irrelevant at our token volumes.
- Judge feedback folded back into the voice prompt: no package pitching on conflicted dates; short paragraphs; exactly one CTA.

## Notes
- Kimi's 52.6s median violates the 30s webhook→draft budget outright.
- GLM-5's failures were substantive (affirmed a conflicted date phrasing, invented price contexts) — not eval-spec noise.
- Eval harness is the contract: any future model/prompt change must pass 16/16 before deploy.
