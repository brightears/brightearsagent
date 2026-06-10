# ROADMAP — Bright Ears SaaS (build queue)

Rules of engagement for any agent working this file:
- Work items **top to bottom**, one at a time. Mark `[x]` only when the acceptance check passes locally (build + tests green). Commit after each completed item with a clear message.
- 🔑 = **founder gate**: stop, tell the founder exactly what to create/provide (with a link and steps), then continue with the next non-blocked item if one exists.
- Never touch `../brightears` or `../brightears26`. Read `CLAUDE.md` + `docs/PRODUCT-BRIEF.md` first. When writing LLM code, read the `/claude-api` skill.
- Prefer boring, testable code. Every parser and the sequence engine get fixture-driven tests.

## Phase 0 — Foundations
- [ ] Local Postgres (document choice: Postgres.app or Docker) + `.env.local` template + first migration from `prisma/schema.prisma`; `npm run db:*` scripts (generate/migrate/studio/seed)
- [ ] Seed script: one demo Business ("Demo DJ Co", US/Eastern) with packages, performers, gigs, and 10 sample leads in varied states — the dev playground
- [ ] Tailwind v4 brand tokens (palette from CLAUDE.md), base layout, logo wired; light/colorful theme foundation (royalstreaming.com direction, NOT dark)
- [ ] Acceptance: `npm run build` green; seeded dashboard page renders lead list

## Phase 1 — Inbound spike (the product's mouth)
- [ ] Decide Postmark vs Mailgun for inbound-parse + outbound (write a short ADR in docs/) 🔑 founder creates the chosen account (free/dev tier fine)
- [ ] Inbound webhook endpoint: receives parse payload, resolves tenant by slug address, stores raw payload (idempotent on provider message id)
- [ ] Fixture library: collect real The Knot / WeddingWire / Bark / GigSalad notification emails + 5 generic contact-form/plain-email samples into `fixtures/inbound/` (sanitized). Sources: own test accounts, public examples, founder's network
- [ ] Source-specific parsers (The Knot, WeddingWire, Bark, GigSalad) + LLM fallback parser for plain email/forms → normalized `Lead`; unit tests against every fixture
- [ ] Spam/scam triage classifier (LLM + heuristics), `spamScore`/`spamReason`, SPAM status; test with known scam patterns (advance-fee, fake-event)
- [ ] Acceptance: piping any fixture through the webhook creates a correct Lead (or SPAM) in < 10s; all parser tests green

## Phase 2 — Draft engine (the product's brain) 🔑 Anthropic API key
- [ ] Voice profile: onboarding fields (voiceSamples, tone choices) → cached system prompt per tenant (use prompt caching)
- [ ] Availability check: Gig calendar conflict logic (date + tenant tz, multi-performer aware)
- [ ] Draft generator: lead + availability + matching packages + voice → personalized reply (subject + body), honest about availability, quotes only from rate card, never invents facts; follow-up variant generator (sequence-step aware, adapts to thread)
- [ ] `LlmUsage` logging on every call (purpose, model, tokens); per-tenant cost rollup query
- [ ] Eval harness: 15+ scenario fixtures (available/booked/vague date/price-shopper/spam-adjacent/non-wedding event) with assertion checks (no invented prices, correct availability statement, opt-out present on follow-ups); runs in CI
- [ ] Acceptance: eval suite passes; median draft latency < 30s from webhook to PENDING draft

## Phase 3 — Approve-from-phone loop (the product's hands)
- [ ] Clerk auth + tenant resolution 🔑 founder creates Clerk app
- [ ] Dashboard: lead pipeline (NEW→…→BOOKED/DEAD columns), lead detail with full thread, draft review (approve / edit / reject), gig calendar CRUD, packages CRUD, settings
- [ ] PWA + web push: push on new PENDING draft; approve/edit from phone in ≤ 2 taps; drafts expire when stale
- [ ] Outbound send: via provider from `mail.brightears.io` (until DNS: provider sandbox domain), From = business name, Reply-To = owner; threading headers so client replies chain; replies loop back via tenant forward → ENGAGED
- [ ] Status transitions wired end-to-end + `firstReplyAt` stamped (the headline metric)
- [ ] Acceptance: full demo loop on seeded tenant — fixture in → push received → approve on phone → email delivered (to test inbox) → reply flips lead to ENGAGED

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

## Phase 7 — Production deployment 🔑 Render account (new service — NOT the existing one)
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
