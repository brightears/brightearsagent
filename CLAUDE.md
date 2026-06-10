@AGENTS.md

# Bright Ears — AI back office for wedding/event performer businesses

**Read `docs/PRODUCT-BRIEF.md` before any product or architecture decision** (canonical spec). **`ROADMAP.md` is the build queue** — work it top to bottom. `docs/MARKETING-PLAN.md` is the launch engine.

## What this is

Self-serve SaaS under the existing **Bright Ears** brand (will take over brightears.io at cutover — see ROADMAP Phase 8): ingests every inquiry a DJ/performer business receives (email, web form, The Knot/WeddingWire/Bark lead notifications), triages spam, drafts a personalized availability-aware reply in the owner's voice, the owner approves from their phone, follow-up sequences run until booked-or-dead. White-label — the end client must never see AI. Weekly report proves the outcome (median response time, gigs booked).

## Hard rules

1. **Total separation from the live agency stack.** Never import from, modify, or depend on `../brightears` (live business at brightears.io, run by the Vinyl agent) or `../brightears26`. Patterns may be reimplemented; code never copied wholesale. Brand assets (logo, favicons) in `public/brand/` were copied from the old repo — that's the only sanctioned crossover.
2. **brightears.io cutover discipline (Phase 8):** the old service moves to `agency.brightears.io` FIRST (LINE webhook re-registered, Clerk origins updated, Vinyl verified working for several days) before the apex domain ever points at this app. Until then this app deploys on its own Render service with a temporary URL. Vinyl must never lose a single day of operation.
3. **Email spine, no OAuth at MVP.** No Gmail/Microsoft OAuth scopes in the critical path (Google restricted scopes need CASA review — deferred to Phase 1.5 via Unipile/Nylas). Inbound = per-tenant parse address (`leads@{slug}.in.brightears.io`); outbound via `mail.brightears.io` (own SPF/DKIM, isolated from any existing mail), From = business name, Reply-To = owner.
4. **ToS discipline:** never scrape or script The Knot/WeddingWire vendor inboxes (parsing their *notification emails* arriving in the tenant's own inbox is fine — established practice). GigSalad: draft + deep link only, never auto-send. Bark: official Zapier route with owner-set budget caps.
5. **Automation hard-stops:** BOOKED, DEAD, opt-out, and prospect-reply (ENGAGED) stop sequences immediately. Every sequence email carries an opt-out. Compliance footer varies by tenant country (CAN-SPAM/PECR/CASL/Spam Act).
6. **Polymorphic from day one:** `PerformerKind` covers all performer types; nothing DJ-specific in shared code. DJ-first lives in marketing copy only.
7. **White-label invariant:** no "AI", "bot", or Bright Ears branding in any client-facing email.
8. **Track LLM cost per tenant** (`LlmUsage`) from the first call. Meter customers in LEADS (they understand leads, not tokens); tokens are our internal margin lens. Alert if any tenant's gross margin drops below 70%.
9. **Timezones:** all date logic in tenant timezone (`Business.timezone`).
10. **When writing LLM code, read the `/claude-api` skill first** (model ids, pricing, structured outputs, prompt caching for per-tenant voice prompts).

## Pricing (founder-confirmed)

14-day free trial (full Pro, no card) → **Starter $25/mo** (15 leads/mo, 1 performer) → **Pro $79/mo** (60 leads/mo, sequences, per-source auto-send, weekly report) → **Studio $149/mo** (multi-performer, 150 leads/mo, team). Overage: lead packs ($10 per 10 leads) — never surprise bills; pause + upsell instead.

## Brand, voice & design

- **Brand:** Bright Ears. Logo + favicons in `public/brand/` (`logo.svg` primary). Brand palette from the existing identity: brand-cyan `#00bbe4` (primary), deep-teal `#1a5152`, soft-lavender `#d59ec9`, warm tertiary `#f1bca6`, earthy-brown `#a47764`, off-white `#e5e2e1`, dark-gray `#333333`.
- **Design direction (founder-set):** brighter, more colourful and fun than the current dark brightears.io. Reference: royalstreaming.com — light/white base, generous whitespace, real photography, clean modern sans-serif, professional-but-approachable. On that base, use the cyan/lavender/warm accents playfully (gradient blobs, colorful cards, friendly illustration). NOT dark, NOT luxury-black, NOT corporate-stiff.
- **Voice (founder-set):** never use the founder's personal name. First-person-plural experience voice: "We've been there — running entertainment for venues for 20 years, drowning in the same inquiries, schedules and invoices. So we built an AI back office for our own agency (her name is Vinyl, she still runs it today) — and now we've built one for yours." Sell the experience and the verifiable story, not a persona.
- Marketing copy uses the customers' own language (verbatim pain quotes in `docs/PRODUCT-BRIEF.md` §3): "respond in under 5 minutes — even from the booth", "stop being the 5th DJ to reply", "no more falling asleep with the laptop on".

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 — heed AGENTS.md: read `node_modules/next/dist/docs/` before writing code
- Prisma 7 + Postgres (generated client at `app/generated/prisma`; `prisma.config.ts` present)
- Anthropic API for parse/triage/draft
- Postmark or Mailgun inbound-parse + outbound (decide in ROADMAP Phase 1 spike)
- Stripe billing; Clerk auth
- PWA + web push for approve-from-phone

## Founder gates (work stops until he provides)

Accounts/credentials only he can create — flag loudly when reached: Anthropic API key · Postmark/Mailgun account · Clerk app · Stripe account + products · Render service · DNS access for in./mail./agency. brightears.io · LINE Developers Console change (cutover only).
