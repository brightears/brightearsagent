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
- [x] ADR-001: **Postmark** (inbound-parse quality + deliverability; provider-agnostic InboundEmail type isolates a future swap) — 🔑 founder Postmark account STILL PENDING (not blocking: everything runs on fixtures locally)
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
- [ ] Model selection eval: run harness across candidates (drafts: v4-pro vs glm-5 vs kimi-k2.6 vs claude-haiku; parse/triage: v4-flash vs qwen3.6-flash vs gemini-flash-lite) — cheapest pass wins; record in docs/ADR-002-models.md
- [x] Acceptance verified: eval 16/16 (median LLM latency 8.1s); E2E webhook answered in 0.05s, background draft PENDING in 19s (< 30s target); lead NEW → DRAFTED; 53 unit tests + build green

## Phase 3 — Approve-from-phone loop (the product's hands) — mostly ✅ (June 10, 2026)
- [ ] Clerk auth + tenant resolution 🔑 BLOCKED on founder Clerk app (clerk.com, free tier → paste publishable + secret keys). Tenant shim in place: `lib/tenant.ts` getCurrentBusiness() is the single swap point
- [x] Dashboard complete: pipeline columns (linked cards) → lead detail with full thread + spam-reason alerts → draft review (approve/edit/reject + booked/dead, dev-transport notice) → calendar (month grid in business tz, gig CRUD, performer assignment) → packages (rate-card CRUD, soft-deactivate, cents-safe pricing) → settings (profile form, lead-address card with copy button, push toggle)
- [x] PWA + push: manifest + service worker + device subscription flow; push fires on every new PENDING draft ("Reply ready: {client}" → deep-link to lead); dead endpoints pruned; VAPID self-generated. (Real-device tap-through pending a browser/phone session — code path verified to subscription storage)
- [x] Outbound send: transport abstraction — dev transport writes .eml files (verified: white-label From=business, Reply-To=owner, correct prices); Postmark transport ready, activates when 🔑 POSTMARK_SERVER_TOKEN lands; mail.brightears.io From-domain at Phase 8
- [x] Status transitions E2E + firstReplyAt stamped: verified DRAFTED→(approve)→REPLIED with timestamp; reply-match→ENGAGED verified in Phase 1; BOOKED creates the gig; DEAD stops sequences
- [x] Acceptance (dev-transport variant): fixture → webhook 0.05s → draft PENDING ~19s → approve → .eml in outbox + lead REPLIED. Remaining for full sign-off: real push tap on a phone + real email delivery (needs Postmark token + browser session)

## Phase 4 — Sequences + reporting (the product's persistence)
- [ ] Sequence engine: cron route (Render cron later, local script now) walks SequenceRuns; drafts follow-ups (auto or approval per tenant setting); hard-stops on BOOKED/DEAD/ENGAGED/opt-out; opt-out link + country-correct compliance footer
- [ ] Booked/dead flows: one-tap "Mark booked" (creates Gig from lead) / "Mark dead"; auto-dead after sequence exhausts
- [ ] Weekly report email per tenant: leads in, median first-reply time, replies sent, engaged, booked (+ revenue if package attached) — the renewal engine; plain, braggable numbers
- [ ] Acceptance: simulated 3-week clock test — sequences fire on schedule, stop correctly, report numbers match DB

## Phase 5 — Self-serve onboarding + billing 🔑 Stripe account + products
- [ ] Onboarding wizard: business profile → performer kind → packages/rate card → voice samples → gig calendar import (manual + ICS paste) → forwarding setup with per-provider walkthroughs (Gmail/Outlook/Knot/WW notification settings) + "send yourself a test lead" verifier
- [ ] Stripe: 14-day trial (no card) → Starter $25 / Pro $79 / Studio $149; lead-metering with plan caps; at cap: pause drafting + friendly upsell (never surprise bills); lead packs $10/10
- [ ] Margin guardrail: nightly job flags any tenant with gross margin < 70% (LlmUsage vs plan price)
- [ ] Acceptance: stranger-test — someone who isn't us signs up, onboards, and gets their first drafted reply within 20 minutes without help

## Phase 6 — Marketing site + content (the product's face)
- [ ] Landing page on the new app (brand + voice + design per CLAUDE.md; verbatim customer-language headlines; the Vinyl story section — "we've been there", no personal names; live demo widget: paste an inquiry → watch the reply draft itself)
- [ ] Pricing page, comparison hub + 6 pairwise pages (vs DJ Event Planner, GigBuilder, Vibo, Check Cherry, HoneyBook, "DJEP alternatives"), FAQ with schema markup
- [ ] Free tool: Inquiry Reply Generator (email-gated) + "25 Wedding DJ Inquiry & Follow-Up Templates" post
- [ ] AEO substrate: llms.txt, structured data, clean semantic HTML, sitemap; founder-story page
- [ ] Acceptance: Lighthouse ≥ 90 on all marketing pages; site reads fun + colorful (royalstreaming reference), not dark
- [ ] NOTE: marketing site ships under the temp URL first; copy/links must not hardcode brightears.io until Phase 8

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
