# AUDIT-LOOP — exhaustive pre-launch audit & fix (run in a fresh session)

**How to run:** open a new session in this repo (Opus 4.8, ultracode + fast mode) and paste:

> `/loop Read docs/AUDIT-LOOP.md and execute it to completion — audit and fix every item, looping until each one is FIXED-and-verified or escalated to me in docs/AUDIT-FINDINGS.md. Use ultracode workflows to fan out. Report progress each iteration.`

This is **resumable**: the living checklist is `docs/AUDIT-FINDINGS.md` (create it first run). Each iteration: read it, advance the next unresolved items, update statuses, commit, and only stop (end the loop) when every item is `FIXED` (verified) or `FOUNDER` (escalated). The seeded findings below come from a fact-checked June-2026 research pass — treat them as the starting backlog, not the whole job; keep hunting for more.

## Mission
Make Bright Ears honest, correct, and production-grade: truthful copy, correctly-wired integrations, working user flows, clean technical health. Fix what's safe; escalate what's a business/legal/credentials decision.

## Hard rules (do not violate)
1. **NEVER touch, import from, or depend on `../brightears` or `../brightears26`** — the live agency stack must keep running untouched.
2. **Do not execute launch-gated production cutovers** — no flipping Stripe to live keys, no Clerk dev→prod cutover, no Google CASA submission, no DNS changes. Document them as founder steps.
3. **Never send real emails/outreach to real third parties** during the audit. Test sends go only to the founder's own connected address.
4. **Never weaken a true claim into a stronger/false one.** Rewrites move toward *more* honest, never less.
5. **Refund/guarantee & pricing-promise wording:** remove the legal risk immediately (kill vague/unverifiable triggers), implement the safest honest interim wording, and **escalate the final policy choice to the founder** — do not unilaterally set a refund policy.
6. Push to `main` is allowed (auto-deploys to the staging Render on test keys) — but keep each commit scoped and reversible. Keep all 267+ tests green; never delete a test to make the suite pass.
7. `docs/DESIGN.md` (v2.1) is law for any UI change. Plain language for the founder — no unexplained jargon.

## How to work
- Maintain `docs/AUDIT-FINDINGS.md`: a table of `id | track | severity (P0/P1/P2) | finding | status (OPEN/FIXED/FOUNDER) | evidence/commit`. This is the source of truth across loop iterations.
- Use `TaskCreate`/`TaskList` for in-session tracking; use **ultracode Workflows** to fan out each track (find → adversarially verify → fix), so findings are confirmed against real code/copy before acting.
- Escalations go in a `## FOUNDER DECISIONS` section of `docs/AUDIT-FINDINGS.md`: each with the question, the options, your recommendation, and why it's the founder's call (money, legal exposure, brand voice, credentials).
- Commit per fix with a clear message. At the end of each iteration, report: fixed this round / in progress / awaiting founder.

---

## TRACK A — Copy & claims truthfulness (founder's #1 concern)
Customers are in US/UK/AU/CA; the binding regimes (verified June 2026): **US FTC Act §5 + Operation AI Comply** (exaggerated AI/earnings claims actively enforced — DoNotPay $193k, AccessiBe $1M); **UK CAP/ASA + DMCC Act** (unfair-practices in force 6 Apr 2025; CMA can fine up to 10% global turnover; judged on the *consumer's* interpretation; qualifiers must sit next to the claim); **AU ACL §18** (future/outcome claims **presumed misleading unless you held reasonable grounds**); **CA Competition Act** (performance claims need "adequate and proper testing" *before* the claim). Substantiation must be **in hand before publishing**.

Build a **claims register**: every objective/benefit claim → where it appears → is it true & substantiated *today* → honest rewrite. Seeded items:
- **A1 (P0) Money-back guarantee.** "If it doesn't pay for itself in your first season, full refund" (pricing/page.tsx ~lines 14/76/294/362, landing metadata, brief) — "pays for itself" / "season" are undefined, unenforceable triggers. Replace with EITHER an unconditional time-boxed refund ("full refund within 60 days, any reason") OR a precisely-defined, conspicuously-disclosed trigger linked from every mention. **FOUNDER decides which** (does he honor it, and how is it measured) — implement the safest interim and escalate.
- **A2 (P0) Pre-launch stats stated as fact.** "<5 min median first reply", "ANSWERED IN 4:51", "~50% book the first responder", "$1,800" (landing page.tsx STATS + marquee + metadata). There is no real median yet — relabel as capability/target ("designed to reply in under 5 minutes"), attribute or cut the industry stats, and only cite real measured numbers once held.
- **A3 (P0) AI outcome claims.** "wins you the gig", "find you bookings", "book more gigs" — outcome + (for the proactive product) future representations. Reframe to the *mechanism*: "scans, scores and drafts outreach you approve — results depend on demand in your area." Qualify "AI that wins you the gig" → "helps you reply first."
- **A4 (P1) Absolutes.** "EVERY LEAD. EVERY TIME.", "never", "always", "#1", "best", "proven", "instant" — strip or qualify.
- **A5 (P0) Metering language honesty.** "15 leads/month" is fine IF "lead" is defined (one prospect = one lead, spam excluded, pause at cap). But the **proactive findings/pitches are a different, currently-uncounted unit** — the pricing must not let a customer think proactive discovery is included in "15 leads". Either state allowances separately ("X leads + Y pitches/mo") or use one neutral defined unit — and **verify the code actually pauses at the cap** (see Track B) so the promise is real.
- **A6 (P1) Auto-renew disclosure** must appear on the **trial-conversion/checkout screen** (price + "auto-renews monthly until cancelled" + how to cancel), not only the pricing FAQ. (FTC Click-to-Cancel was vacated 8 Jul 2025 and is NOT in force in 2026, but §5, ROSCA and California ARL — effective 1 Jul 2025 — still require clear pre-charge disclosure + express consent + easy cancel.)
- **A7 (P1) Reviews/testimonials & seeded data.** FTC Consumer Reviews Rule (in force 21 Oct 2024) + UK DMCC ban fake/undisclosed-incentivised reviews. Any testimonial must be real with incentives disclosed; standout results need a typical-results note. Label the **live demo widget output** and **seeded venue/sample data** as "sample/example", never as real outcomes.
- **A8 (P1) Landing-page clarity.** Make the hero + sections clearly say what the app DOES now — scans for opportunities, drafts in your voice, keeps you in the loop, manages the follow-up — without implying a local booking is guaranteed. The story page line "not that every lead books — couples are still couples" is the honesty model; extend it.

**Auditor grep wordlist:** guarantee, money-back, refund, pays for itself, risk-free, find you, books you, more gigs, wins you, double your, fill your calendar, fastest, instant, proven, results, every, never, always, #1, best, median, "<5 min", "~50%", uncited $ figures, testimonial, review, case study. **Key files:** app/(marketing)/page.tsx, pricing/page.tsx, compare/page.tsx, story/page.tsx, free-tools, the EPK template, in-app copy, docs/MARKETING-PLAN.md, docs/PRODUCT-BRIEF.md, and the Stripe/Clerk checkout screens.

## TRACK B — Production wiring, security & privacy (P0 launch-blockers first)
Seeded findings (code-grounded, June 2026 — verify each still holds, then fix):
- **B1 (P0)** Stripe webhook (app/api/webhooks/stripe/route.ts) verifies signatures + fails closed, but has **no event-id dedup** → Stripe retries (up to 3 days) can double-apply side effects. Add a `ProcessedStripeEvent` table keyed on `event.id`, checked before any side effect.
- **B2 (P0)** Verify metering **actually enforces** caps (it appears to at lib/inbound/pipeline.ts meterState().overCap and lib/sequences/engine.ts) — confirm at-cap drafting truly pauses (backs Track A5's promise), and reconcile lead caps with the new proactive pitch caps.
- **B3 (P0)** `proxy.ts` (Next 16 convention, NOT middleware.ts) is the Clerk route guard for /dashboard, /onboarding, /api/oauth — **verify the production build loads it**, or tenant routes go public. Add a test/health assertion.
- **B4 (P0)** Secrets passed as `?secret=` query params (inbound/cron auth) **leak into request logs** — move to an `Authorization`/header secret (keep timingSafeEqual, fail-closed in prod via lib/auth-secret.ts).
- **B5 (P0)** Committed `* 2.*` duplicate files exist **including `prisma/migrations/*/migration 2.sql`** — a `migrate deploy` hazard — plus dead `lib/oauth/google 2.ts` etc. Remove all duplicate-numbered files; verify migrations still deploy clean.
- **B6 (P0)** **No legal pages** (privacy policy, terms, DPA, cookie/consent). Artist = data controller, Bright Ears = processor for leads' + scraped venues'/contacts' personal data. UK/EU GDPR + PECR need a documented Legitimate Interest Assessment for cold outreach; add privacy policy, terms, a DPA, cookie consent, and a data-retention/deletion path. (Legal review = FOUNDER, but draft the pages and wire them.)
- **B7 (P1)** Stripe: no `automatic_tax`, no address collection — a Thai seller owes UK VAT from the first sale and EU VAT/OSS from the first euro (no threshold for non-resident digital services). For a US-first launch this can defer; document and gate. Pin the Stripe `apiVersion`.
- **B8 (P1)** Clerk is the **Development** instance; production needs a custom domain + DNS + pk_live/sk_live and does NOT copy dev settings — document the cutover (FOUNDER-gated).
- **B9 (P1)** Gmail `gmail.send` is a restricted scope: testing mode caps at 100 users; publishing needs **CASA Tier 2 (~$500–$4500, 2–6 months, annual)**. Launch reactive first; gate proactive auto-send behind a waitlist/test-user list until CASA clears. Confirm token refresh/persist + AES-256-GCM at-rest (lib/crypto/tokens.ts) hold.
- **B10 (P1)** Ops hardening: no Sentry-class error monitoring (only the homegrown instrumentation.ts Postmark alert — needs OPS_ALERT_EMAIL set), no rate limiter on public/expensive endpoints, Render Postgres **backup/restore must be plan-checked and a real restore test run**. Add a rate limiter, confirm backups, set OPS_ALERT_EMAIL.
- **B11 (P2)** Rotate every secret that passed through chat (OpenRouter, Render API key, Serper, TOKEN_ENCRYPTION_KEY, Stitch). (.env* is gitignored — good.) FOUNDER does the rotation; produce the exact list + where each lives.
- **B12 (P2)** Docs drift: CLAUDE.md still says "Prisma 7" and "no OAuth at MVP" but reality is Prisma 6.19 with Gmail OAuth fully built — reconcile CLAUDE.md / PRODUCT-BRIEF / ADRs with the shipped system.

## TRACK C — User-flow & functional correctness
Walk every real journey end-to-end (build + dev-run + reason through the code) and prove each WORKS; fix dead ends, broken states, and confusing UX. At minimum:
- Sign-up → onboarding wizard → profile → connect leads (forwarding) → first inbound lead → draft → approve → send → follow-up sequence → weekly report.
- Proactive: profile → hunting-license unlock → venue scan → Hunt feed → draft pitch → approve → send (own mailbox) / copy-handoff → status transitions.
- Billing: trial start → checkout → plan upgrade/downgrade → cancel via portal → at-cap pause/upsell.
- Opt-out flow; the "two-headed dashboard" first-run UX (Soundcheck vs No-leads) the founder flagged earlier — make the empty dashboard guide ONE next action.
- Mobile/responsive sanity and basic accessibility (labels, contrast, focus) on the key screens.
Each broken/confusing flow → a finding with a fix.

## TRACK D — Technical health
Typecheck, lint, full test suite, production build — all green. Clear `docs/REVIEW-DEFERRED.md` items. Remove dead code and legacy v1 design tokens (after confirming no usage). Dependency/vuln sanity check. Confirm cron auth + the discovery cost guardrail (70% margin) hold.

## Stop condition
When every item across A–D in `docs/AUDIT-FINDINGS.md` is `FIXED` (verified: tests/build green, change committed) or `FOUNDER` (escalated with options + recommendation), write a final summary at the top of `docs/AUDIT-FINDINGS.md` (counts, the P0s closed, the founder-decision list) and **end the loop**. Do not invent busywork to keep looping.
