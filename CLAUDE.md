@AGENTS.md

# GigSorted — AI back office for wedding/event performer businesses

**Read `../PRODUCT-BRIEF-GIGSORTED.md` before any product or architecture decision.** It is the canonical spec (ICP, wedge, competitive position, architecture, MVP scope, pricing, GTM, kill gates), distilled from an 11-agent research workflow (June 2026).

## What this is

Self-serve SaaS, $59–149/mo: ingests every inquiry a DJ/performer business receives (email, web form, The Knot/WeddingWire/Bark lead notifications), triages spam, drafts a personalized availability-aware reply in the owner's voice, the owner approves from their phone, follow-up sequences run until booked-or-dead. White-label — the end client must never see AI. Weekly report proves the outcome (median response time, gigs booked).

## Hard rules

1. **Total separation from Bright Ears.** Never import from, reference, or touch `../brightears` (live business, run by the Vinyl agent) or `../brightears26`. Patterns may be reimplemented, code never copied wholesale.
2. **Email spine, no OAuth at MVP.** No Gmail/Microsoft OAuth scopes anywhere in the critical path (Google restricted scopes require CASA review — deferred to Phase 1.5 via Unipile/Nylas). Inbound = per-tenant parse address; outbound = platform-managed domain, Reply-To owner.
3. **ToS discipline:** never scrape or script The Knot/WeddingWire vendor inboxes (parsing their *notification emails* in the tenant's own inbox is fine and established practice). GigSalad: draft + deep link only, never auto-send. Bark: official Zapier route with owner-set budget caps.
4. **Automation hard-stops:** BOOKED, DEAD, opt-out, and prospect-reply (ENGAGED) all stop sequences immediately. Every sequence email carries an opt-out. Compliance footer varies by tenant country (CAN-SPAM/PECR/CASL/Spam Act).
5. **Polymorphic from day one:** `PerformerKind` covers all performer types; nothing DJ-specific in shared code. DJ-first lives in marketing copy only.
6. **White-label invariant:** no "AI", "bot", or product branding in any client-facing email. From = business name, Reply-To = owner.
7. **Track LLM cost per tenant** (`LlmUsage`) from the first call — margin visibility is a day-one feature.
8. **Timezones:** all date logic in tenant timezone (`Business.timezone`). No default-to-server-time.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4
- Prisma 7 + Postgres (generated client at `app/generated/prisma` — note custom output path; `prisma.config.ts` present)
- Anthropic API for parse/triage/draft (see `LlmUsage` purposes)
- Postmark or Mailgun inbound-parse + outbound (decision pending — first spike)
- Stripe billing, 14-day trial
- PWA + web push for approve-from-phone

## Status

- [x] Repo scaffolded, schema drafted (June 10, 2026)
- [ ] Local Postgres + first migration
- [ ] Inbound parse spike (Postmark vs Mailgun) + The Knot/WeddingWire/Bark notification-email parsers (fixture-driven: collect real notification emails as test fixtures)
- [ ] Parse → triage → draft pipeline
- [ ] Approve-from-phone PWA loop
- [ ] Sequences engine (cron)
- [ ] Onboarding wizard + Stripe
- [ ] Landing page + comparison/content cluster (see brief §8)

## Decisions pending (founder)

- Final name (working: GigSorted; domains to register listed in brief §9)
- Founder's real name + Vinyl story on the site (recommended yes)
- Pricing confirmation ($59/$99/$149 hypothesis)
