# ROADMAP — Bright Ears SaaS (build queue)

Rules of engagement for any agent working this file:
- Work items **top to bottom**, one at a time. Mark `[x]` only when the acceptance check passes locally (build + tests green). Commit after each completed item with a clear message.
- 🔑 = **founder gate**: stop, tell the founder exactly what to create/provide (with a link and steps), then continue with the next non-blocked item if one exists.
- Never touch `../brightears` or `../brightears26`. Read `CLAUDE.md` + `docs/PRODUCT-BRIEF.md` first. When writing LLM code, read the `/claude-api` skill.
- Prefer boring, testable code. Every parser and the sequence engine get fixture-driven tests.

## Phase 0 — Foundations ✅ (June 10, 2026)
- [x] Local Postgres: existing Homebrew `postgresql@15` service, db `brightears_app_dev`; `.env.local` holds DATABASE_URL + OpenRouter key; `prisma.config.ts` loads `.env.local` then `.env`; `npm run db:*` scripts added (generate/migrate/deploy/studio/seed) + `postinstall: prisma generate`; first migration `20260610093627_init` applied (11 tables)
- [x] Seed script `prisma/seed.ts` (idempotent): Demo DJ Co with 2 performers (DJ + photo booth), 3 packages, 2 booked gigs (availability-conflict fixtures), 10 leads covering every status incl. a date-conflict lead and an advance-fee SPAM lead
- [x] Tailwind v4 brand tokens in `app/globals.css` (@theme: brand-cyan/deep-teal/soft-lavender/warm-peach/earthy-brown on light #fdfcfb, no dark mode), layout metadata + Geist font, logo wired from `public/brand/`
- [x] Acceptance verified: `npm run build` green; `/dashboard` (pipeline columns by status) server-renders all seeded leads + spam-filtered count

## Phase 1 — Inbound spike (the product's mouth) ✅ (June 10, 2026)
- [x] ADR-001: **Postmark** (inbound-parse quality + deliverability; provider-agnostic InboundEmail type isolates a future swap) — 🔑 ✅ DONE June 11: account live (server 19519786, token in .env.local), sender signature norbert@brightears.io verified, OUTBOUND_FROM set, REAL email sent & delivered through the full pipeline (webhook → draft → approve → Postmark → inbox). Test mode: ≤100 emails, recipients @brightears.io only. BEFORE LAUNCH: click "Request approval" in Postmark (lifts recipient restriction) + DKIM/Return-Path DNS at Phase 8
- [x] Inbound webhook `app/api/inbound` (Postmark JSON → InboundEmail), tenant by slug address, shared-secret auth, idempotent on MessageID, error-wrapped (500 → Postmark retries)
- [x] Fixture library: 14 sanitized fixtures across theknot/weddingwire/bark/gigsalad/generic, structures researched from vendor-support docs + Mailparser/Zapier templates (agents' format evidence in fixture `_researchNotes`)
- [x] Source parsers ×4 + LLM fallback parser (null-tolerant schema — cheap models return null for empty optionals); reply-matching attaches client replies to their lead → ENGAGED + stops sequences; 46 unit tests green
- [x] Triage: scam heuristics (overpayment/wire-back etc.) + category-constrained LLM classifier with cost-asymmetry rule (only scam/bulk/vendor/notice categories may spam-flag; "unclear" never does); platform-parser leads skip LLM triage (their boilerplate fools it); parse+triage run concurrently on the fallback path
- [x] Acceptance verified end-to-end through the live webhook with live DeepSeek calls: platform fixtures → NEW in 0.02s; contact-form → NEW with correct body-field extraction in ~6.5s; terse price-shopper → NEW (not spam); overpayment scam → SPAM; all < 10s
- [ ] Follow-up (when Postmark live): capture REAL notification emails from each platform and add as fixtures — current field labels are doc-reconstructed; parsers use tolerant alias lists but real samples should confirm

## Phase 2 — Draft engine (the product's brain) — mostly ✅ (June 10, 2026)
- [x] `lib/llm` wrapper (landed in Phase 1): OpenRouter + Vercel AI SDK, per-purpose model map, lazy provider init, LlmUsage logging baked in — no call site names a model
- [x] Voice profile: `lib/agent/voice.ts` — per-tenant system prompt from voiceSamples + rate card; hard rules (never invent, availability honesty, white-label, no placeholders, sign-off)
- [x] Availability: `lib/agent/availability.ts` — multi-performer conflict logic (free/partial/conflict/unknown), noon-UTC date convention, 7 unit tests
- [x] Draft generator: `lib/agent/drafter.ts` — pure function (eval-friendly), first-reply + sequence-step follow-up variants, thread-aware, subject threading from rawSubject, deterministic refusal-language normalization of the availability self-report
- [x] LlmUsage logging on every call via the wrapper
- [x] Eval harness: 16 scenarios in `evals/scenarios.ts` + `npm run eval:drafts` runner — deterministic gates: price whitelist (client-quoted amounts allowed), availability-statement match, white-label regex, placeholder ban, word budgets, per-scenario must/mustNot. Eval-spec bugs found & fixed by first runs (honest "$400 budget" echo is correct behavior; follow-ups may skip availability talk)
- [x] Model selection eval → docs/ADR-002-models.md: drafts stay on **v4-pro** (16/16 ×2 AND wins blind writing-quality judge 5–3 vs flash; GLM-5 8/16 eliminated; Kimi 52.6s latency eliminated); parse/triage stay on **v4-flash** (cost floor, E2E-proven). Judge feedback folded into voice prompt. Eval pass bar: zero safety failures + ≤1 quality flake
- [x] Acceptance verified: eval 16/16 (median LLM latency 8.1s); E2E webhook answered in 0.05s, background draft PENDING in 19s (< 30s target); lead NEW → DRAFTED; 53 unit tests + build green

## Phase 3 — Approve-from-phone loop (the product's hands) — mostly ✅ (June 10, 2026)
- [ ] Clerk auth + tenant resolution 🔑 BLOCKED on founder Clerk app (clerk.com, free tier → paste publishable + secret keys). Tenant shim in place: `lib/tenant.ts` getCurrentBusiness() is the single swap point
- [x] Dashboard complete: pipeline columns (linked cards) → lead detail with full thread + spam-reason alerts → draft review (approve/edit/reject + booked/dead, dev-transport notice) → calendar (month grid in business tz, gig CRUD, performer assignment) → packages (rate-card CRUD, soft-deactivate, cents-safe pricing) → settings (profile form, lead-address card with copy button, push toggle)
- [x] PWA + push: manifest + service worker + device subscription flow; push fires on every new PENDING draft ("Reply ready: {client}" → deep-link to lead); dead endpoints pruned; VAPID self-generated. (Real-device tap-through pending a browser/phone session — code path verified to subscription storage)
- [x] Outbound send: transport abstraction — dev transport writes .eml files (verified: white-label From=business, Reply-To=owner, correct prices); Postmark transport ready, activates when 🔑 POSTMARK_SERVER_TOKEN lands; mail.brightears.io From-domain at Phase 8
- [x] Status transitions E2E + firstReplyAt stamped: verified DRAFTED→(approve)→REPLIED with timestamp; reply-match→ENGAGED verified in Phase 1; BOOKED creates the gig; DEAD stops sequences
- [x] Acceptance (dev-transport variant): fixture → webhook 0.05s → draft PENDING ~19s → approve → .eml in outbox + lead REPLIED. Remaining for full sign-off: real push tap on a phone + real email delivery (needs Postmark token + browser session)

## Phase 4 — Sequences + reporting (the product's persistence) ✅ (June 10, 2026)
- [x] Sequence engine `lib/sequences/engine.ts` + `/api/cron/sequences` (CRON_SECRET-gated): runs start when the first reply sends; steps at day-offsets [2,5,9] from firstReplyAt; follow-ups go through owner approval (never stacks while one is PENDING); defensive hard-stops on BOOKED/DEAD/ENGAGED/SPAM/opt-out; stale-draft expiry; backfill for pre-engine leads. Opt-out: HMAC-tokenized `/api/optout` link in a compliance footer appended at SEND time (owner reviews clean copy, footer can't be edited away). Follow-up auto-send deferred until trust earned (approval is one tap)
- [x] Booked/dead flows: markBooked creates the Gig + stops runs (Phase 3); markDead stops runs; auto-DEAD when sequence exhausts with continued silence
- [x] Weekly report `lib/reports/weekly.ts` + `/api/cron/weekly-report`: leads in, spam filtered count ("you never saw them"), median first-reply minutes with bragging line, replies/engaged/booked/in-sequence; skips empty weeks
- [x] Acceptance: `scripts/test-sequences.ts` simulated 3-week clock — backfill, step 1 fires day 2 (live LLM draft), no stacking while pending, approve adds compliance footer (opt-out token asserted), steps 2-3 fire days 5/9, exhaust → auto-DEAD day 11, stop-on-reply, stop-on-opt-out, report numbers match direct SQL. PASS

## Phase 5 — Self-serve onboarding + billing — non-Stripe half ✅ (June 10, 2026)
- [x] Onboarding wizard `/onboarding`: 5 steps (basics with performer-kind selector → packages → voice samples + tone chips → booked dates → forwarding setup with Gmail/Outlook/Knot/WW walkthroughs) + LIVE verifier (polls `/api/onboarding/verify`; tested: fresh lead through the real webhook flips it to verified 🎉); resume heuristic; dashboard "Resume setup" banner
- [x] Stripe ✅ DONE June 11 (test mode / sandbox, keys in .env.local): catalog created (3 USD prices on the THB account — works); REAL checkout completed with test card → webhook flipped plan TRIAL→PRO, linked customer + subscription, cleared trial (13/13 webhook events 200); verified PRO lead cap (60), customer-portal session creation, live subscription status active. Webhook forwarded locally via `stripe listen`. Cancel/downgrade handler code-reviewed; live cancel demo optional. BEFORE LAUNCH: register the webhook endpoint in the Stripe dashboard pointing at the deployed URL → real `whsec_` (Phase 8); re-run scripts/stripe-setup.ts in LIVE mode; switch to live keys
- [x] Lead metering: plan caps (15/60/150, trial=60); at cap leads still ingest, drafting pauses + upsell push — surprise bills structurally impossible; spam never counts against the customer
- [x] Margin guardrail: nightly cron + `scripts/margins.ts`; pricing snapshot tied to ADR-002; validated on real data (demo tenant: $0.0034 LLM cost vs $25 plan after a full testing day)
- [ ] Acceptance: stranger-test (signup → onboard → first drafted reply < 20 min, no help) — needs 🔑 Clerk + 🔑 Stripe; wizard flow verified end-to-end on the dev tenant including the live lead verifier

## Design-polish pass (founder feedback June 11 — do before launch, after Stripe)
- [ ] Dashboard + app screens don't yet match the royalstreaming-style reference or the marketing site's colorful energy — founder: "it will still need many design adjustments". Bring the dashboard/onboarding up to the same design language: lighter cards on subtle color, playful accents, better spacing/typography. (Logo white-on-white already hot-fixed with teal tiles — a proper two-variant logo treatment belongs in this pass.)

## Phase 6 — Marketing site + content (the product's face) — ✅ built (June 10, 2026)
- [x] Landing page `/`: "Stop being the 5th DJ to reply" hero, verbatim pain cards, LIVE demo widget (POST /api/demo-reply, typewriter render, rate-limited 5/IP/day + 500/day global, live-tested with a real inquiry → perfect reply), how-it-works, "We've been there" Vinyl section, feature grid, gradient CTA band
- [x] Pricing (3 cards, Pro highlighted, 10-question FAQ + FAQPage JSON-LD), `/story` long-form narrative (no personal names, Organization JSON-LD)
- [x] Comparison cluster: `/compare` hub + 6 static pairwise pages (verified June-2026 competitor pricing, honest-and-generous tone, content in `lib/marketing/comparisons.ts`)
- [x] Free tools: Inquiry Reply Generator (email-gated templates via MarketingContact), 25 actually-written templates with copy buttons, Lead ROI calculator (transparent math)
- [x] AEO substrate: public/llms.txt, app/sitemap.ts, app/robots.ts (GPTBot/ClaudeBot/PerplexityBot explicitly allowed), JSON-LD on pricing/story/compare
- [x] All 12 routes render 200; marketing pages prerender static; build green; 55 tests green
- [ ] Acceptance remainder: Lighthouse ≥ 90 run (needs a browser session — do during Phase 7 E2E) · note: JSON-LD/llms.txt cite brightears.io as canonical (intended post-cutover domain; harmless pre-cutover)

## Pre-Phase-7 — Code review ✅ (June 10, 2026)
- [x] High-effort multi-agent review of all 16 commits (7 finder angles + verify): 10 correctness + security findings fixed (commit 4d060c1) — compliance send-boundary hard-stop, sequence scheduling/retry/redraft robustness, double-draft + invalid-date + idempotency races, triage false-positive split, fail-closed prod auth, tenant-scoped actions, unique constraints + hot-query indexes. Lower-severity cleanup/efficiency/altitude items tracked in docs/REVIEW-DEFERRED.md
- [x] Local dev secrets added (INBOUND_WEBHOOK_SECRET/CRON_SECRET/OPTOUT_SECRET) so prod fail-closed auth doesn't block local E2E

## Phase 7 — Production deployment 🔑 GitHub repo + push access, Render API key or new service (NOT the existing brightears service)
- [ ] Founder: install GitHub CLI (`brew install gh && gh auth login`) or provide a repo + token; create private repo `brightears-app`, push; create Render API key (dashboard.render.com → Account Settings → API Keys) so agents can configure the service directly
- [ ] New Render web service + Postgres (separate from `brightears`/`brightears-db`!), env config, real migrations (`prisma migrate deploy` — NEVER `db push --accept-data-loss`), automated DB backups enabled and documented
- [ ] Render cron for sequences + weekly reports; health checks; error tracking (Sentry or similar); uptime monitor
- [ ] Security pass: webhook signature verification (provider + Stripe), rate limiting, tenant isolation audit, secrets audit (nothing committed)
- [ ] E2E smoke suite against production temp URL
- [ ] Acceptance: production demo loop green end-to-end on temp URL for 7 consecutive days

## Phase 8 — brightears.io cutover (Vinyl-safe, in this exact order) 🔑 DNS + LINE console + Clerk dashboard
- [ ] 1. Create `agency.brightears.io` → OLD Render service; verify venue portal + admin load there
- [ ] 2. Update LINE Developers Console webhook URL to `agency.brightears.io/api/line/webhook`; update old app's Clerk allowed origins; update Vinyl's configured base URLs + Render cron target if URL-based
- [ ] 3. **Soak 7 days**: confirm LINE ratings, reminders, broadcasts, Vinyl pushes all work on the subdomain (watch the old service logs)
- [ ] 4. Point apex `brightears.io` + `www` → NEW service; old service lives on the subdomain permanently; add redirects for the 6 venue-portal bookmark paths → subdomain
- [ ] 5. Set up `in.brightears.io` (inbound parse MX) + `mail.brightears.io` (outbound SPF/DKIM/DMARC); switch outbound from sandbox; re-verify deliverability (mail-tester ≥ 9/10)
- [ ] 6. Tell the 6 venues (one LINE broadcast via Vinyl — founder approves wording)
- [ ] Acceptance: new site live on brightears.io AND a full Vinyl day (morning reminders, feedback cards, a poster push) runs without error

## Phase 9 — Launch (see docs/MARKETING-PLAN.md)
- [ ] Founding-member offer live (first 25: $15/mo for year one in exchange for review + case study — anchored under Starter)
- [ ] G2 + Capterra listings; ProductHunt-style launch assets
- [ ] Marketing engine loop running (one content asset per run, queue in MARKETING-PLAN)
- [ ] Mystery-shop "2026 Wedding DJ Lead Response Study" started (needs 3-4 weeks of reply-waiting — start EARLY, can begin during Phase 6)
- [ ] Gate 1 (launch + 90 days): ≥ 10 paying businesses, ≥ 3 with no prior contact with us. Miss badly → reposition or kill (see brief §10)
