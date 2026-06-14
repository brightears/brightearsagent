# AUDIT-FINDINGS — Bright Ears pre-launch audit

> Living checklist & source of truth for the `audit/pre-launch` loop (docs/AUDIT-LOOP.md).
> Branch: `audit/pre-launch`. Baseline at start: **267/267 tests pass, `tsc --noEmit` clean**.

## Status — updated 2026-06-14 (iteration 4 complete)

**Iteration 1:** read-only verify+discover (28 subagents) → seeded AUDIT-FINDINGS.
**Iteration 2 (fixes landed):** Track A copy fully done; housekeeping; docs drift.

- FIXED & verified (tsc 0 · eslint 0/0 · 273/273 tests · next build OK): A3, A4, A6, A7, A8, B5, B12, D1, B1, B4, **C1** (lead outcome controls), **C5** (responsive nav + contrast), **C4** (single first-run CTA + branded opt-out), **B3-NF** (fail-closed auth), **D3-NF** (margin scope doc) — plus A1, A2, **B7** (apiVersion+appUrl; tax→founder), **B10** (rate limits+error alerts; Sentry/backups→founder) marked `FIXED*`.
- OK / verified-good (no action needed): A5 (lead is well-defined), B3 (proxy.ts guard IS wired — confirmed by `ƒ Proxy (Middleware)` in the build), D3 (cron auth + margin guardrail + 0 prod vulns).
- WIP: D2 (dead files + unused token removed; compare/[slug] v1 reskin + REVIEW-DEFERRED items remain).
- NEXT (auto, queued): C3 (billing success/cancel UI + at-cap indicator), D2 (compare/[slug] v1→v2 reskin + REVIEW-DEFERRED), B6 legal-page drafts, C1-NF (ENGAGED compose action), C5-NF (onboarding emoji→SVG), then finalize FOUNDER DECISIONS + open the PR.
- FOUNDER: 34 escalations (money/legal/credentials) — see FOUNDER DECISIONS below.

Status legend: `OPEN` = auto-fixable, not yet done · `FIXED` = applied + verified (commit) · `FIXED*` = interim auto-fix applied, final policy escalated to founder · `WIP` = partially fixed · `FOUNDER` = escalated · `OK` = verified, no issue / already satisfied.

## Seeded findings

| id | T | sev | status | owner | finding |
|----|---|-----|--------|-------|---------|
| A1 | A | P0 | FIXED*  | founder | The "if it doesn't pay for itself in your first season, full refund" guarantee is live in 6 user-facing code locations (and is even published as schema.org FAQ JSON-LD), with bo... |
| A2 | A | P0 | FIXED*  | founder | Confirmed: the landing STATS strip, marquee, metadata, and several other marketing pages present "<5 min median first reply", "ANSWERED IN 4:51", "~50% book the first responder"... |
| A3 | A | P0 | FIXED   | auto | Outcome-promise copy ("wins you the gig", "wins them / carried all the way to booked", "this is how you win the gig", "double your business", "Your gigs, answered and booked") i... |
| A4 | A | P1 | FIXED   | founder | Absolute/superlative copy is pervasive across user-facing marketing pages — the literal "EVERY LEAD. EVERY TIME." hero marquee plus dozens of every/never/always/instant/proven/b... |
| A5 | A | P0 | OK      | auto | The conflation risk does not hold: "lead" is fully defined (one prospect=one lead, spam excluded, pause at cap) in both copy and code, and the proactive Hunt/pitch feature is ne... |
| A6 | A | P1 | FIXED   | auto | The in-app trial-conversion/upgrade screen shows price + "/mo" and a "Choose" button that redirects straight to Stripe checkout, with NO "auto-renews monthly until cancelled" st... |
| A7 | A | P1 | FIXED   | auto | A fabricated product testimonial ("— a beta DJ") exists only on three noindexed internal design-preview pages; the live production marketing pages contain no fake testimonials, ... |
| A8 | A | P1 | FIXED   | auto | The landing page describes the mechanism well (forward leads, drafts in your voice, you tap Approve, follow-up until booked-or-dead, nothing sends without approval), but it fram... |
| B1 | B | P0 | FIXED | auto | Signature verification is correct and fails closed, but there is NO event.id dedup anywhere — no ProcessedStripeEvent table in the schema and the handler never reads event.id, s... |
| B10 | B | P1 | FIXED* | founder | short summary |
| B11 | B | P2 | FOUNDER | founder | The finding holds: .env* is correctly gitignored and untracked, but the project uses ~10 live secrets (one — the Render API key — is explicitly documented in-repo as having pass... |
| B12 | B | P2 | FIXED   | auto | Confirmed: CLAUDE.md and PRODUCT-BRIEF both still claim "Prisma 7" (actual: 6.19.3) and "no OAuth at MVP / deferred to Phase 1.5 via Unipile/Nylas", while Gmail OAuth is fully b... |
| B2 | B | P0 | FOUNDER | founder | Lead-cap metering genuinely pauses drafting at both the webhook and cron paths (the pricing promise holds), but proactive venue PITCHES run on a completely separate per-temperat... |
| B3 | B | P0 | OK      | auto | The dangerous part of the finding is false: proxy.ts is correctly named/placed/exported per Next 16's Proxy convention and the production build verifiably wires up the Clerk gua... |
| B4 | B | P0 | FIXED | auto | Confirmed: all 5 internal auth call sites (inbound webhook + 4 cron routes) read the shared secret from the ?secret= query param via req.nextUrl.searchParams.get("secret"), whic... |
| B5 | B | P0 | FIXED   | auto | 11 git-tracked duplicate "* 2.*" files exist (5 lib/component sources, 4 tests, 2 prisma migration SQLs); all are dead/unreferenced and safe to delete, though the migrate-deploy... |
| B6 | B | P0 | FOUNDER | founder | No legal pages of any kind exist — no privacy policy, terms, DPA, cookie/consent, no LIA, and no data-retention/deletion or DSAR path — while the app actively scrapes third-part... |
| B7 | B | P1 | FIXED* | founder | All three sub-claims hold: the Stripe client is initialized with no pinned apiVersion, and the subscription checkout session enables neither automatic_tax nor any billing-addres... |
| B8 | B | P1 | FOUNDER | founder | Confirmed: Clerk runs as a Development instance (pk_test/sk_test, dev *.accounts.dev Frontend API, no custom domain) — production cutover requires a fresh Production instance wi... |
| B9 | B | P1 | FOUNDER | founder | The technical claims (gmail.send restricted scope is used; refresh/persist works; tokens are AES-256-GCM at rest) are all CONFIRMED and correctly implemented — but the actual ri... |
| C1 | C | P0 | FIXED | auto | The reactive flow has a P0 dead end: once a lead's first reply is sent, there is no UI to Mark booked or Mark dead, so the core "booked-or-dead" outcome can never be recorded th... |
| C2 | C | P1 | FOUNDER | founder | The core profile→license→draft→approve→send/copy path works end-to-end and is well-guarded, but the journey breaks at both bookends: there is no user-facing way to trigger a ven... |
| C3 | C | P1 | FOUNDER | founder | The core billing chain (auto trial → Stripe checkout → portal upgrade/downgrade/cancel, all webhook-synced) is wired end to end and works, but three real gaps remain: no post-ch... |
| C4 | C | P1 | FIXED | auto | Opt-out flow is correct and stops sequences end-to-end; the first-run empty dashboard is genuinely two-headed — three empty blocks with two competing setup CTAs (Soundcheck "Res... |
| C5 | C | P0 | FIXED | auto | Finding holds: real mobile/a11y defects exist — dashboard nav overflows off-screen on phones (P0 for the "approve from the booth" journey), the marketing header hides its only n... |
| D1 | D | P1 | FIXED   | auto | Lint FAILS (3 errors, 15 warnings, exit 1); production build PASSES (exit 0) because Next 16 `next build` no longer runs ESLint, so the lint errors do not block deploys today. |
| D2 | D | P2 | WIP     | auto | Legacy v1 pastel tokens and dead code both confirmed: 6 v1 tokens still defined (one fully unused), one whole marketing route still rendered in the abandoned v1 palette, and 9 g... |
| D3 | D | P2 | OK      | auto | All three D3 checks pass: 0 production high/critical vulns, every cron route enforces fail-closed shared-secret auth, and the 70% margin guardrail exists and is wired to a sched... |

## New adjacent findings (discovered while verifying)

| id | parent | T | sev | status | owner | finding |
|----|--------|---|-----|--------|-------|---------|
| NF1 | A1 | A | P1 | FIXED*  | auto | Guarantee is published as machine-readable schema.org FAQ JSON-LD to search engines |
| NF2 | A1 | A | P1 | FIXED*  | founder | No refund-policy / terms page exists anywhere in the app |
| NF3 | A1 | A | P2 | FIXED*  | auto | Stated finding location 'landing metadata' is inaccurate; the metadata hit is the pricing page, and two comparisons.ts occurrences were missed |
| NF4 | A2 | A | P1 | FIXED*  | founder | Pricing guarantee states 'full refund' as firm policy with no terms |
| NF5 | A2 | A | P1 | FIXED*  | founder | 'About a third of vendors never reply' stated unsourced across multiple pages |
| NF6 | A3 | A | P0 | FIXED   | founder | Uncited quantitative stat claims on landing page ('~50% of couples book the first responder', '$1,800 the booking you stop losing', '<5 min median ... |
| NF7 | A3 | A | P0 | FIXED   | founder | 'full refund' / 'pays for itself' guarantee copy shipped without a written refund policy |
| NF8 | A4 | A | P1 | FIXED   | auto | "25 proven templates" is an unsubstantiated efficacy claim (P1) |
| NF9 | A4 | A | P1 | FIXED   | founder | Speed claims ("under 5 minutes") stated as absolutes vs hedged stat elsewhere on same page (P1) |
| NF10 | A4 | A | P1 | FIXED   | founder | Refund/guarantee language appears in pricing copy and must match the real policy (P1) |
| NF11 | A5 | A | P2 | OK      | founder | Proactive Hunt/venue-pitch feature is shipped but undisclosed in all pricing and marketing copy |
| NF12 | A6 | A | P2 | FIXED   | founder | No Terms of Service / billing-terms link on the Stripe checkout session |
| NF13 | A6 | A | P2 | FIXED   | founder | Refund-guarantee copy ('full refund') has no backing policy mechanism or surfaced terms |
| NF14 | A7 | A | P1 | FIXED   | founder | Founding-members plan trades a discount for reviews/case studies — incentivized-review disclosure needed before those go live |
| NF15 | A7 | A | P2 | FIXED   | founder | Headline stat claims lack on-page substantiation ("~50% of couples book the first responder", "median first reply <5 min") |
| NF16 | A8 | A | P1 | FIXED   | auto | Live demo widget output not labeled as a sample/example |
| NF17 | A8 | A | P2 | FIXED   | auto | '5-minute setup' / 'under 5 minutes' setup claim stated as fact pre-launch |
| NF18 | B1 | B | P2 | OPEN | auto | stripeSubscriptionId is not @unique, and lookups use findFirst |
| NF19 | B1 | B | P2 | OPEN | auto | checkout.session.completed re-calls stripe().subscriptions.retrieve on every redelivery |
| NF20 | B10 | B | P1 | FIXED* | auto | Caught errors in inbound/cron never alerted |
| NF21 | B10 | B | P2 | OPEN | auto | Duplicate dead file lib/outbound/gmail 2.ts |
| NF22 | B11 | B | P2 | FOUNDER | founder | Rotating TOKEN_ENCRYPTION_KEY will silently break all stored Gmail OAuth tokens (no re-encryption / re-auth path) |
| NF23 | B11 | B | P2 | FOUNDER | founder | STITCH_API_KEY stored in .env.local is dead weight in the app (only the MCP uses it) — confirm it's still needed at all |
| NF24 | B12 | B | P2 | FIXED   | auto | PRODUCT-BRIEF §6 OUT list still lists "Gmail send-as" as out-of-scope, contradicting shipped OAuth send |
| NF25 | B12 | B | P2 | FIXED   | auto | CLAUDE.md/ADR-004 imply Microsoft (Outlook) OAuth is built, but only Google is implemented |
| NF26 | B2 | B | P2 | OPEN | auto | Duplicate stale source files shipped in repo ("... 2.ts") |
| NF27 | B2 | B | P2 | OPEN | auto | sendVenuePitch SENDING residual-window has no reaper (acknowledged TODO) |
| NF28 | B3 | B | P1 | OK      | auto | Clerk guard silently disabled when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing in prod |
| NF29 | B3 | B | P2 | OK      | auto | Duplicate ' 2.ts' test/build files from cloud-sync conflicts pollute the tree |
| NF30 | B4 | B | P2 | OPEN | auto | Inline comment instructs operators to put the secret in the webhook URL |
| NF31 | B4 | B | P2 | FOUNDER | founder | Single CRON_SECRET shared across all 4 cron endpoints, no per-route scoping |
| NF32 | B5 | B | P2 | FIXED   | auto | Stale duplicate sources diverge from canonical (not just dead copies) |
| NF33 | B5 | B | P2 | FIXED   | auto | .gitignore has no guard against macOS '* 2.*' sync-duplicate artifacts |
| NF34 | B6 | B | P1 | FOUNDER | founder | Scraped venue-contact PII has no provenance-based deletion or retention limit |
| NF35 | B6 | B | P2 | FOUNDER | founder | Opt-out marks lead DEAD but does not erase or redact lead PII |
| NF36 | B7 | B | P2 | FOUNDER | founder | Stripe price catalog sets no tax_behavior (inclusive/exclusive ambiguity) |
| NF37 | B7 | B | P2 | OPEN | auto | appUrl() falls back to http://localhost:3057 for Stripe success/cancel URLs |
| NF38 | B8 | B | P1 | FOUNDER | founder | Live Clerk secret + many other live secrets are committed in plaintext to .env.local (Postmark token, OpenRouter key, Stripe test secret + webhook ... |
| NF39 | B8 | B | P2 | OPEN | auto | Duplicate stray file 'lib/outbound/gmail 2.ts' (likely an editor/Finder copy) shipped in the repo |
| NF40 | B9 | B | P2 | OPEN | auto | Stale shadow copy 'lib/oauth/google 2.ts' has drifted from the live file (appUrl no longer exported) |
| NF41 | C1 | C | P1 | OPEN | auto | ENGAGED leads with no pending draft cannot be replied to from the UI either |
| NF42 | C1 | C | P2 | FOUNDER | founder | Onboarding step 5 lead address is shown but no Postmark inbound route is provisioned for it |
| NF43 | C2 | C | P2 | OPEN | auto | VenueStatus QUALIFIED is dead — venues never promoted past DISCOVERED |
| NF44 | C2 | C | P2 | OPEN | auto | Optimistic 'Sent' on the pitch card can mask a real send failure path / leave a SENDING-stuck pitch invisible |
| NF45 | C3 | C | P2 | OPEN | auto | Stripe checkout/portal server actions have no error UI — thrown errors surface as a raw Next error page |
| NF46 | C3 | C | P2 | OPEN | auto | At-cap upsell push deep-links to /dashboard/settings but settings has no usage/cap context |
| NF47 | C4 | C | P2 | OPEN | auto | Opt-out success page is unbranded raw HTML (white-label/trust gap) |
| NF48 | C4 | C | P2 | FOUNDER | founder | complianceFooter is only appended to follow-ups, so the FIRST reply carries no opt-out link |
| NF49 | C5 | C | P2 | OPEN | auto | White-on-cyan would fail contrast (2.28:1) — design system flags it but code is currently safe |
| NF50 | C5 | C | P2 | OPEN | auto | Onboarding wizard renders emoji/✓ in UI chrome vs DESIGN.md 'NO EMOJI IN UI. EVER.' |
| NF51 | D1 | D | P1 | FIXED   | auto | 11 committed "* 2" macOS copy-conflict duplicate files (incl. duplicate Prisma migration + oauth source) |
| NF52 | D2 | D | P2 | WIP     | auto | compare/[slug] marketing route still renders in abandoned v1 pastel palette |
| NF53 | D2 | D | P2 | WIP     | auto | 9 git-tracked Finder-duplicate '* 2' files committed into the repo |
| NF54 | D3 | D | P2 | OK      | auto | Serper search-API spend is excluded from the 70% margin guardrail |
| NF55 | D3 | D | P2 | OK      | founder | Margin alert is a silent no-op because OPS_ALERT_EMAIL is unset |

---

## Detail — seeded findings (evidence + fix)

### A1 — [P0] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** The "if it doesn't pay for itself in your first season, full refund" guarantee is live in 6 user-facing code locations (and is even published as schema.org FAQ JSON-LD), with both trigger terms ("pays for itself", "season") defined nowhere and no refund/terms page in the app — an unenforceable, vague-trigger guarantee.

**Evidence:**
- `app/(marketing)/pricing/page.tsx:14` — 14-day free trial, no card. If it doesn't pay for itself in your first season, full refund.
- `app/(marketing)/pricing/page.tsx:75-76` — q: "What if it doesn't pay for itself?", a: "...if Bright Ears doesn't pay for itself in your first season, full refund..."
- `app/(marketing)/pricing/page.tsx:294` — If it doesn&apos;t pay for itself in your first season, full refund.
- `app/(marketing)/pricing/page.tsx:362-363` — And if it doesn&apos;t pay for itself in your first season, full refund.
- `lib/marketing/comparisons.ts:38` — And if it doesn't pay for itself in your first season, full refund. (BRIGHT_EARS_PRICING.overage, rendered at compare/page.tsx:280 and compare/[slug]/page.tsx:251)
- `lib/marketing/comparisons.ts:228` — And if it doesn't pay for itself in your first season, full refund. (HUB_FAQS, rendered AND emitted as JSON-LD via faqJsonLd(HUB_FAQS) at compare/page.tsx:57)

**Fix / action:** FOUNDER must choose the actual policy; an agent should not unilaterally set refund terms. Interim safest fix an agent CAN apply now: replace all 6 strings with an unconditional, time-boxed, any-reason promise — "Full refund within 30 days, no questions asked" (drop "pays for itself"/"season" entirely) — and ALSO remove the unverifiable claim from the JSON-LD path (do not ship a refund promise in faqJsonLd structured data until policy is final). Single-source the wording (one exported constant in lib/marketing) so pricing/page.tsx, comparisons.ts overage + HUB_FAQS all reference it. Create a /refund-policy (or /terms) page stating the exact window, method, and any conditions, and link it from every mention. If the founder instead wants the outcome-based trigger, it must be precisely defined ("first season" = which dates; "pays for itself" = which measurable threshold) and conspicuously disclosed/linked at every occurrence. Update CLAUDE.md:26, docs/PRODUCT-BRIEF.md:43, docs/ADR-003-scope-vs-price.md:24 once decided.

### A2 — [P0] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** Confirmed: the landing STATS strip, marquee, metadata, and several other marketing pages present "<5 min median first reply", "ANSWERED IN 4:51", "~50% book the first responder", and "$1,800" as measured facts with zero attribution or qualification, despite the product being pre-launch with no real data.

**Evidence:**
- `app/(marketing)/page.tsx:32-45` — const MARQUEE_ITEMS = [ "ANSWERED IN 4:51", ... ]; const STATS = [ { n: "<5 min", l: "median first reply" }, { n: "~50%", l: "of couples book the first responder" }, { n: "$1,80...
- `app/(marketing)/page.tsx:310-313` — Three steps, about five minutes of setup — median first reply: under 5 minutes.
- `app/(marketing)/page.tsx:96-98` — A weekly report that proves it ... Every week: your median reply time, what came in, what got booked.
- `app/(marketing)/pricing/page.tsx:273-277` — $1,800 ... One saved $1,800 booking pays for 6 years of Starter.
- `app/(marketing)/compare/page.tsx:314` — Median first reply under 5 minutes — even from the booth.
- `app/(marketing)/story/page.tsx:246-247` — Median first reply: under 5 minutes. Then it follows up until the gig is booked
- `app/(marketing)/tools/templates/page.tsx:407` — Median first reply: under five minutes.
- `app/(marketing)/design/b/page.tsx:210-212, 322` — { n: "<5 min", l: "median first reply" }, ... Replied in 4:51

**Fix / action:** Reframe every measured-sounding claim as either a product promise/target or an attributed external industry stat — never as Bright Ears' own measured result, since none exist pre-launch. Concrete edits: (1) page.tsx STATS — change "median first reply" to a target ("<5 min target first reply") or relabel the section heading from "The stakes" to something forward-looking; make "$1,800" clearly illustrative (e.g. "$1,800 example booking"). (2) "~50% of couples book the first responder" and "a third of vendors never reply" are external claims — cite a source inline/footnote or soften to "couples often book whoever replies first". (3) Marquee "ANSWERED IN 4:51" and design/b "Replied in 4:51" / design/a "Replied in 4 min 51 s" read as a real measured timestamp — relabel as a demo/illustration ("DEMO: replied in minutes") or drop the exact seconds. (4) The repeated "median first reply: under 5 minutes" across home/compare/story/templates should become aspirational ("we aim to reply in under 5 minutes") until real telemetry exists. The design/a,b,c pages are internal previews so lower priority but carry the same copy. The wording mechanics are auto, but the founder must confirm which framing (promise vs. cited stat) and supply sources for the ~50%, one-third, and $1,800 numbers.

### A3 — [P0] OPEN (owner: auto, holds: confirmed)
**Verdict:** Outcome-promise copy ("wins you the gig", "wins them / carried all the way to booked", "this is how you win the gig", "double your business", "Your gigs, answered and booked") is live across the landing page, free-tool CTA, story JSON-LD, and the in-app weekly report email; the substance holds, though the exact phrases "find you bookings"/"book more gigs" the finding quotes are not in current source.

**Evidence:**
- `app/(marketing)/page.tsx:27` — The AI back office that wins you the gig: every inquiry answered in your voice in under 5 minutes...
- `app/(marketing)/page.tsx:205` — watch the engine that wins you the gig write the reply, live.
- `app/(marketing)/page.tsx:450-451` — One plays the gigs. The other wins them — every lead answered in minutes, followed up for days, carried all the way to booked.
- `lib/reports/weekly.ts:63` — (Most businesses take a day or more — this is how you win the gig.)
- `app/(marketing)/tools/templates/page.tsx:659` — heading="If there were two of you, you'd double your business."
- `app/(marketing)/story/page.tsx:25` — slogan: "Your gigs, answered and booked."

**Fix / action:** Reframe every outcome promise to the mechanism plus an explicit dependency disclaimer. Specifically: (1) page.tsx:27 and :205 — replace "that wins you the gig"/"the engine that wins you the gig" with mechanism language, e.g. "answers every inquiry first, in your voice, and follows up until booked or dead — results depend on demand in your area." (2) page.tsx:450-451 — change "The other wins them ... carried all the way to booked" to "The other answers them — every lead replied to in minutes and followed up for days, so you stop losing gigs to a slow reply." (3) weekly.ts:63 — change "this is how you win the gig" to a factual framing, e.g. "Replying first is what couples reward — about half book the first responder." (4) templates/page.tsx:659 — keep the verbatim customer quote as a quote (it is the customer's words), but ensure the product is not the grammatical subject promising the doubling. (5) story/page.tsx:25 slogan — change "Your gigs, answered and booked." to "Every inquiry answered in minutes." These are pure copy edits with no factual/legal/credential dependency, so they are safe to apply directly; the founder need not sign off on wording that removes a promise. (Note: also update the audit wordlist references in docs/AUDIT-LOOP.md to match the actual current phrasings, since "find you bookings"/"book more gigs" no longer exist in source.)

### A4 — [P1] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** Absolute/superlative copy is pervasive across user-facing marketing pages — the literal "EVERY LEAD. EVERY TIME." hero marquee plus dozens of every/never/always/instant/proven/best/only claims — so the finding holds today.

**Evidence:**
- `app/(marketing)/page.tsx:38` — "EVERY LEAD. EVERY TIME.",
- `app/(marketing)/page.tsx:295` — More leads was never the problem. Answering every one of them, fast, every time —
- `app/(marketing)/page.tsx:450-452` — every lead answered in minutes ... And it always asks before sending.
- `app/(marketing)/compare/page.tsx:82` — Best DJ booking software in 2026: the <span className={GRAD}>honest</span> comparison
- `app/(marketing)/compare/page.tsx:86-87` — we're the only one that answers your leads
- `components/tool-reply-generator.tsx:215` — Get our 25 proven inquiry &amp; follow-up templates
- `app/(marketing)/story/page.tsx:286` — Magic. It's diligence, done every time, instantly
- `app/(marketing)/pricing/page.tsx:92` — we never silently bill you more ... No surprise bills, ever.

**Fix / action:** Soften unqualified absolutes to defensible, hedged claims wherever the absolute is a performance/coverage promise rather than a product invariant. Concrete edits: (1) Hero marquee page.tsx:38 — change "EVERY LEAD. EVERY TIME." to a hedged variant like "REAL LEADS. EVERY DAY." or "DRAFTED IN MINUTES." (2) The "in under 5 minutes" / "answered in minutes" claims (page.tsx:27,148; templates:660) — qualify as "typically" / "median <5 min" to match the hedged STATS already on the page (page.tsx:42 "<5 min median first reply"). (3) tool-reply-generator.tsx:215 "25 proven" — drop "proven" (unsubstantiated); use "25 ready-to-send templates" or "25 field-tested templates" only if usage data backs it. (4) compare page "Best DJ booking software" title/H1 (compare/page.tsx:23,31,82) and "the only one that answers your leads" (86-87): "best" is a category SEO keyword and arguably fine in the comparison context, but the H1 already pairs it with "honest comparison" — keep but ensure body keeps the self-deprecating framing; "the only one that answers your leads" is a factual category claim — leave if true vs the named competitors, else hedge. NOTE: several "never"/"always" lines are genuine product invariants tied to hard rules (white-label "clients never see us" page.tsx:105; "never a surprise bill / pause at cap" page.tsx:462, pricing:92,312; "you are always the final word" pricing:112; opt-out "stops instantly") — these are accurate guarantees the system enforces and should be KEPT, not scrubbed. Distinguish enforceable invariants (keep) from performance superlatives (soften). The design/a,b,c pages also contain absolutes but are internal design previews — not in sitemap.ts and not linked in the marketing nav — so deprioritize.

### A5 — [P0] OK (owner: auto, holds: not_reproduced)
**Verdict:** The conflation risk does not hold: "lead" is fully defined (one prospect=one lead, spam excluded, pause at cap) in both copy and code, and the proactive Hunt/pitch feature is never mentioned in any pricing or marketing copy, so nothing can lead a customer to think proactive discovery is included in "15 leads."

**Evidence:**
- `app/(marketing)/pricing/page.tsx:83-84` — q: "What counts as a lead?", a: "A lead is a real inquiry from a real prospect ... One prospect = one lead, no matter how many emails go back and forth with them."
- `app/(marketing)/pricing/page.tsx:87-88` — q: "Does spam count against my monthly leads?", a: "No. Spam, scams and vendor junk are filtered before you ever see them, and they never count toward your lead cap."
- `app/(marketing)/pricing/page.tsx:91-92` — q: "What happens when I hit my monthly lead cap?", a: "Drafting pauses and we notify you immediately ... You can add a lead pack ($10 per 10 leads) or upgrade ..."
- `lib/billing/metering.ts:20-24` — // SPAM doesn't count against the customer ... return db.lead.count({ where: { businessId, createdAt: { gte: monthStart(now) }, status: { not: "SPAM" } } });
- `lib/outreach/caps.ts:17-21` — export const DAILY_PITCH_CAPS: Record<VenueTemperature, number> = { HOT: 10, WARM: 5, SEED: 3 };

**Fix / action:** No fix required for the stated conflation risk — leave the lead definition as-is; it is honest and code-backed. Pitches are architecturally a distinct unit (separate daily-by-temperature send caps in lib/outreach/caps.ts; gated by profile quality canPitch, not plan tier) and are correctly NOT counted against the monthly lead cap (metering.ts only counts non-SPAM Lead rows). Do NOT add proactive-pitch language to the "15 leads" allowance — that would create the very conflation A5 warns about. The genuine open question is the inverse (see newFindings): the Hunt is shipped but undisclosed, which is a packaging/disclosure decision for the founder.

### A6 — [P1] OPEN (owner: auto, holds: confirmed)
**Verdict:** The in-app trial-conversion/upgrade screen shows price + "/mo" and a "Choose" button that redirects straight to Stripe checkout, with NO "auto-renews monthly until cancelled" statement or pre-charge cancellation instructions; that disclosure exists only in the marketing pricing FAQ.

**Evidence:**
- `app/dashboard/settings/page.tsx:57-77` — action={startCheckout.bind(null, p.plan)} ... {p.price}<span ...>/mo</span> ... <button ...>Choose</button>
- `app/dashboard/settings/page.tsx:46-51` — "Pick a plan to keep replies flowing after your trial." : "Your trial has ended — new inquiries are saved but replies are paused until you subscribe."
- `app/actions/billing.ts:25-37` — const session = await stripe().checkout.sessions.create({ mode: "subscription", line_items: [{ price: price.id, quantity: 1 }], ... success_url: ... cancel_url: ... subscription...
- `app/(marketing)/pricing/page.tsx:95-97` — q: "Can I cancel anytime?", a: "Yes. Every plan is month-to-month with no contract. Cancel from your settings in two clicks ..."

**Fix / action:** Add a clear, conspicuous auto-renew disclosure directly on the BillingCard checkout UI in app/dashboard/settings/page.tsx, placed immediately adjacent to the "Choose" buttons (before the form submit), e.g. "$25/mo, billed monthly. Renews automatically until you cancel. Cancel anytime in Settings → Manage billing before your next billing date; no charge after cancellation." Belt-and-suspenders on the Stripe side: in startCheckout (app/actions/billing.ts) add consent_collection.terms_of_service plus custom_text.terms_of_service_acceptance / custom_text.submit restating the recurring-charge and cancellation terms so the hosted page also surfaces them. This is a code/copy change with no business or legal sign-off required for the mechanical disclosure of facts already true in the product (monthly recurring, cancel in settings).

### A7 — [P1] OPEN (owner: auto, holds: partially)
**Verdict:** A fabricated product testimonial ("— a beta DJ") exists only on three noindexed internal design-preview pages; the live production marketing pages contain no fake testimonials, only honestly-framed prospect pain quotes, and all demo/seed data is clearly labeled.

**Evidence:**
- `app/(marketing)/design/a/page.tsx:21-33, 358-360` — const QUOTE_WORDS ... ["From"..."booked"..."I","just","tap","Approve"..."the","booth."] ... <figcaption ...>— a beta DJ</figcaption>
- `app/(marketing)/design/c/page.tsx:24, 353-355` — const QUOTE_WORDS = "“From hello to booked — I just tap Approve from the booth.”".split(" "); ... <figcaption ...>— a beta DJ</figcaption>
- `app/(marketing)/design/b/page.tsx:5, 438-440` — robots: { index: false } ... <figcaption ...>&mdash; a beta DJ</figcaption>
- `app/(marketing)/page.tsx:221-223, 238-241` — Working DJs told us the same three stories, over and over. Their words, not ours: ... “Get an inquiry, immediately respond, and then nothing… 30 inquiries so far, maybe 5 have r...
- `docs/PRODUCT-BRIEF.md:16-21` — ## 3. The validated pain (their words — use verbatim in copy) ... "You don't want to be the 5th DJ that reaches out." ... "If there were two of me, I would double my business."
- `components/demo-widget.tsx:87-90, 117, 159-163, 172-176` — <StickerChip tone="ink">Live demo</StickerChip> ... No inquiry handy? Use a sample ... Drafted in {seconds}s ... From: Your DJ Business / To: Your lead
- `prisma/seed.ts:1-2, 17-25` — // Dev playground: one demo business ... name: "Demo DJ Co", slug: "demo-dj-co", ownerEmail: "owner@demodjco.test"
- `app/epk/[slug]/page.tsx:123, 217` — const quote = business.reviewQuotes[0]; ... {business.reviewQuotes.slice(1).map((q) => (
- `prisma/schema.prisma:119` — reviewQuotes String[] @default([]) // 1-3 short client quotes

**Fix / action:** On all three design-preview pages, replace the fabricated "— a beta DJ" customer endorsement with either (a) attribution that matches the production pages' honest framing — i.e. clearly mark it as a prospect pain quote ("— a working DJ, in their own words") drawn from PRODUCT-BRIEF §3 research, NOT a beta user of the product — or (b) remove the testimonial entirely. Since "From hello to booked — I just tap Approve from the booth" is a product-success claim with no real customer behind it (pre-launch, zero beta DJs), it must not be presented as a customer testimonial. Although these pages are noindexed (robots:{index:false}) and unlinked, they remain reachable by URL, so the safest fix is to delete the figcaption or relabel the line as illustrative/aspirational copy ("what it feels like to use it"), not a quote. The production landing/story/compare pages are already correct: they label DJ quotes as prospect pain points ("Their words, not ours"), which are validation quotes, not Reviews-Rule testimonials. No change needed to the demo widget or seed files — both are clearly labeled and dev-only.

### A8 — [P1] OPEN (owner: auto, holds: partially)
**Verdict:** The landing page describes the mechanism well (forward leads, drafts in your voice, you tap Approve, follow-up until booked-or-dead, nothing sends without approval), but it frames a booking as a delivered outcome ("the AI back office that wins you the gig") and pairs a first-responder stat with the product, while carrying none of the "not every lead books / results depend on demand" honesty qualifier that exists only on the story page — so A8 holds partially.

**Evidence:**
- `app/(marketing)/page.tsx:205` — watch the engine that wins you the gig write the reply, live
- `app/(marketing)/page.tsx:27` — The AI back office that wins you the gig: every inquiry answered in your voice...
- `app/(marketing)/page.tsx:42-45` — { n: "~50%", l: "of couples book the first responder" }, { n: "$1,800", l: "the booking you stop losing" }
- `app/(marketing)/page.tsx:38` — "EVERY LEAD. EVERY TIME."
- `app/(marketing)/story/page.tsx:281-286` — We won't promise ... That every lead books — couples are still couples

**Fix / action:** Port the story page's "We won't promise / not every lead books" honesty model onto the landing page (the money page). Concretely: (1) reframe the outcome promise to mechanism — change "the AI back office / engine that wins you the gig" to something like "helps you reply first" or "carries every lead from inquiry to booked-or-dead — you stay the boss" (lines 27, 205); (2) attribute or remove the bare "~50% of couples book the first responder" stat (cite the source inline, e.g. industry first-responder data) and add a one-line qualifier near the STATS or final CTA such as "Results depend on demand in your area — we make sure every real lead gets a fast, personal reply; we can't make every lead book." The "$1,800 the booking you stop losing" stat should be labeled illustrative/example. The mechanism copy (STEPS, FEATURES, "Nothing sends until you tap") is already honest and should stay. Note this overlaps with A2 (bare stats) and A3 ("wins you the gig" outcome language); coordinate the rewrites so the qualifier is added once, near the claims.

### B1 — [P0] OPEN (owner: auto, holds: confirmed)
**Verdict:** Signature verification is correct and fails closed, but there is NO event.id dedup anywhere — no ProcessedStripeEvent table in the schema and the handler never reads event.id, so Stripe's up-to-3-day retries (which are unordered) can double-apply or replay subscription lifecycle changes.

**Evidence:**
- `app/api/webhooks/stripe/route.ts:24-29` — event = await stripe().webhooks.constructEventAsync(await req.text(), signature, secret); } catch { return NextResponse.json({ error: "invalid signature" }, { status: 400 }); }
- `app/api/webhooks/stripe/route.ts:31-95` — switch (event.type) { case "checkout.session.completed": ... } — no event.id lookup/insert guards the switch; side effects run on every (re)delivery
- `app/api/webhooks/stripe/route.ts:72-77` — } else if (sub.status === "canceled" || sub.status === "unpaid") { await db.business.update({ ... data: { plan: "TRIAL", trialEndsAt: new Date(), stripeSubscriptionId: null } })...
- `prisma/schema.prisma:71-152` — model Business { ... } model PushSubscription { — no ProcessedStripeEvent / WebhookEvent / idempotency model exists in any of the 18 models
- `prisma/schema.prisma:254` — providerMessageId String? @unique // dedup backstop for webhook redelivery — the dedup pattern is used for inbound email but has no Stripe-event equivalent

**Fix / action:** Add a ProcessedStripeEvent model to schema.prisma (id = Stripe event.id, plus createdAt). In POST, after constructEvent succeeds and before the switch, insert event.id; on a P2002 unique-constraint violation return 200 immediately without side effects. Wrap the insert + business.update in db.$transaction so a mid-handler crash doesn't mark an event processed without applying it. This makes the handler idempotent against Stripe's up-to-3-day, unordered retries. decisionOwner auto — pure code/schema change.

### B10 — [P1] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** short summary

**Evidence:**
- `instrumentation.ts:3-8` — Sentry can replace this later; see ROADMAP
- `app/api/demo-reply/route.ts:5-12` — 5/IP/day, 500 global, in-memory Map
- `app/api/inbound/route.ts:20-25` — checkSharedSecret only, no rate limiter
- `ROADMAP.md:76-79` — Sentry optional later; backup verification; uptime monitor

**Fix / action:** Add a rate-limit helper for inbound, onboarding-verify, optout; add reportError. Founder: backups, restore drill, uptime monitor, Sentry.

### B11 — [P2] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** The finding holds: .env* is correctly gitignored and untracked, but the project uses ~10 live secrets (one — the Render API key — is explicitly documented in-repo as having passed through chat), and the founder needs the exact name + read-location list to rotate.

**Evidence:**
- `.gitignore:33-34` — # env files (can opt-in for committing if needed) .env*
- `ROADMAP.md:72` — Render API key provided (⚠️ founder: ROTATE it — it passed through chat)
- `lib/llm/index.ts:32` — _openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY ?? "" });
- `lib/crypto/tokens.ts:29` — const hex = process.env.TOKEN_ENCRYPTION_KEY;
- `lib/oauth/google.ts:47` — const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
- `lib/billing/stripe.ts:9` — const key = process.env.STRIPE_SECRET_KEY;
- `lib/outbound/send.ts:22` — const token = process.env.POSTMARK_SERVER_TOKEN;
- `lib/tenant.ts:4` — const clerkEnabled = !!process.env.CLERK_SECRET_KEY;
- `lib/discovery/serper.ts:362` — this.apiKey = deps.apiKey ?? process.env.SERPER_API_KEY ?? "";
- `scripts/render-deploy.py:23` — KEY = os.environ["RENDER_API_KEY"]

**Fix / action:** Hand the founder this rotate-list (true secrets only; each name → where it is read). Confirmed gitignored/untracked: `git ls-files | grep env` returns nothing and `git check-ignore .env .env.local` matches `.gitignore:34 .env*`. TRUE SECRETS TO ROTATE (env name → read location in repo): (1) OPENROUTER_API_KEY → lib/llm/index.ts:32, lib/inbound/triage.ts:76. (2) SERPER_API_KEY → lib/discovery/serper.ts:362, lib/discovery/provider.ts:157, lib/discovery/contacts.ts:176, scripts/scan-venues.ts:32. (3) TOKEN_ENCRYPTION_KEY → lib/crypto/tokens.ts:29 (NOTE: rotating this invalidates all stored Gmail OAuth tokens — see new finding; coordinate with re-auth). (4) POSTMARK_SERVER_TOKEN → lib/outbound/send.ts:22. (5) CLERK_SECRET_KEY → lib/tenant.ts:4 (server). (6) STRIPE_SECRET_KEY → lib/billing/stripe.ts:9, scripts/stripe-setup.ts:15. (7) STRIPE_WEBHOOK_SECRET → app/api/webhooks/stripe/route.ts:13. (8) GOOGLE_OAUTH_CLIENT_SECRET → lib/oauth/google.ts:47. (9) STITCH_API_KEY → present in .env.local but NOT read by any app/script code; consumed only by the Google Stitch MCP — rotate in Google/Stitch console, no code change. (10) RENDER_API_KEY → only read by scripts/render-deploy.py:23 and scripts/render-crons.py:18 (passed via shell env, NOT stored in .env.local) — explicitly flagged in ROADMAP.md:72 as having passed through chat; rotate in dashboard.render.com → Account Settings → API Keys. Internal shared secrets to regenerate too (random values, set on Render): INBOUND_WEBHOOK_SECRET (app/api/inbound/route.ts:23), CRON_SECRET (app/api/cron/*/route.ts), OPTOUT_SECRET (lib/optout.ts:7). NOT secrets — do NOT rotate: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, GOOGLE_OAUTH_CLIENT_ID, VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY (publishable/public by design); VAPID_PRIVATE_KEY is self-generated and safe to regenerate (subscribers re-subscribe) but low urgency. DATABASE_URL credentials should be rotated if the local/prod password ever appeared in chat. After rotating, update both .env.local and the corresponding Render env vars so prod keeps working.

### B12 — [P2] OPEN (owner: auto, holds: confirmed)
**Verdict:** Confirmed: CLAUDE.md and PRODUCT-BRIEF both still claim "Prisma 7" (actual: 6.19.3) and "no OAuth at MVP / deferred to Phase 1.5 via Unipile/Nylas", while Gmail OAuth is fully built natively and ROADMAP itself marks it LIVE on prod (10.5, June 13).

**Evidence:**
- `CLAUDE.md:38` — Prisma 7 + Postgres (generated client at `app/generated/prisma`; `prisma.config.ts` present)
- `package.json:(deps)` — "@prisma/client": "^6.19.3", "prisma": "^6.19.3"
- `CLAUDE.md:15` — Email spine, no OAuth at MVP. No Gmail/Microsoft OAuth scopes in the critical path (Google restricted scopes need CASA review — deferred to Phase 1.5 via Unipile/Nylas).
- `lib/oauth/google.ts:21-23,63-75,106-139` — export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"; ... export function buildAuthUrl(state) ... export async function exchangeCode(code, ...)
- `ROADMAP.md:106` — [x] 10.5 ✅ June 13 (Gmail OAuth LIVE on prod; adversarial review + 13 fixes; CASA review deferred to public launch) — Own-mailbox sending: Gmail/Microsoft OAuth onboarding step
- `docs/PRODUCT-BRIEF.md:34` — Stack: Next.js 16 + Prisma 7 + Postgres, OpenRouter + Vercel AI SDK
- `docs/PRODUCT-BRIEF.md:30` — ## 5. Architecture — "email spine" (ToS-safe, no OAuth at MVP)
- `docs/PRODUCT-BRIEF.md:33` — Phase 1.5: send-as-their-Gmail via Unipile/Nylas (shared pre-verified OAuth).

**Fix / action:** Reconcile docs with shipped reality (all pure copy edits, no business decision): (1) CLAUDE.md:38 and PRODUCT-BRIEF.md:34 — change "Prisma 7" to "Prisma 6.19". (2) CLAUDE.md:15 — rewrite hard-rule 3 so the "no OAuth" absolute reflects the ADR-004 carve-out: the REACTIVE email spine stays no-OAuth (per-tenant parse address + mail.brightears.io), but the PROACTIVE sales agent sends from the artist's own Gmail via native minimal-scope (gmail.send) OAuth, shipped Phase 10.5, CASA review deferred to public launch; drop the "deferred to Phase 1.5 via Unipile/Nylas" claim. (3) PRODUCT-BRIEF.md:30 header and :33 — strike "no OAuth at MVP" from the §5 header and replace the "Phase 1.5 ... via Unipile/Nylas (shared pre-verified OAuth)" line with the actual built design (own Google OAuth client, raw-fetch, no Unipile/Nylas dependency) cross-referencing ADR-004 D4. Note that the OAuth that shipped is scoped to the sales-agent's own-mailbox outbound (ADR-004), not the reactive product's inbound spine — keep that distinction in the rewritten copy so the separation rationale survives.

### B2 — [P0] FOUNDER (owner: founder, holds: partially)
**Verdict:** Lead-cap metering genuinely pauses drafting at both the webhook and cron paths (the pricing promise holds), but proactive venue PITCHES run on a completely separate per-temperature daily cap that is never reconciled with the plan lead cap — proactive LLM draft/send volume is uncounted against the metered allowance.

**Evidence:**
- `lib/billing/metering.ts:39-44` — const used = await leadsUsedThisMonth(...); const cap = PLAN_LEAD_CAPS[plan]; ... return { used, cap, overCap: trialExpired || used > cap };
- `lib/inbound/pipeline.ts:159-171` — if (!isSpam) { const meter = await meterState(...); if (meter.overCap) { void pushToBusiness(... 'Lead cap reached' ...) } else { void generateDraftForLead(lead.id)... } }
- `lib/sequences/engine.ts:55-56` — const meter = await meterState(lead.business.id, lead.business.plan, now, lead.business.trialEndsAt); if (meter.overCap) continue; // still capped — leave NEW, owner already nudged
- `lib/billing/metering.ts:22-24` — return db.lead.count({ where: { businessId, createdAt: { gte: monthStart(now) }, status: { not: "SPAM" } } });
- `lib/outreach/caps.ts:17-21` — export const DAILY_PITCH_CAPS: Record<VenueTemperature, number> = { HOT: 10, WARM: 5, SEED: 3 };
- `app/actions/venues.ts:106-115` — const createdToday = await db.venuePitch.count({ where: { businessId: business.id, temperature: venue.temperature, createdAt: { gte: startOfTenantDay(...) } } }); if (createdTod...

**Fix / action:** Keep the lead-cap enforcement as-is — it correctly holds. Resolve the proactive-vs-lead reconciliation explicitly. Recommended: (a) make a founder pricing decision on whether proactive pitches consume the plan lead allowance or are a separate gated line item; then (b) implement it. If pitches should count toward the plan: add a meterState/overCap check inside draftVenuePitch (app/actions/venues.ts, before generateVenuePitch at line 153) and gate sendVenuePitch the same way, OR fold a VenuePitch monthly count into leadsUsedThisMonth (lib/billing/metering.ts:20). If proactive is intentionally a separate budget, document it in PRODUCT-BRIEF/ADR-004 and surface a monthly (not just daily) proactive cap by plan, since today only a per-day temperature cap exists (~18 pitches/day = ~540/mo of deepseek-v4-pro draft calls on even a $25 Starter), which threatens the 70% gross-margin rule (CLAUDE.md rule 8). At minimum, add the per-tenant monthly proactive ceiling and a margin alert.

### B3 — [P0] OK (owner: auto, holds: not_reproduced)
**Verdict:** The dangerous part of the finding is false: proxy.ts is correctly named/placed/exported per Next 16's Proxy convention and the production build verifiably wires up the Clerk guard with the right matchers; the only valid sub-point is that no test/health check asserts the guard is active.

**Evidence:**
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:15,35,41-42` — Starting with Next.js 16, Middleware is now called Proxy ... Create a `proxy.ts` ... in the project root ... You can export your proxy function as either a default export or a n...
- `proxy.ts:23-37` — export default clerkEnabled ? clerkMiddleware(async (auth, req) => { if (isProtected(req)) await auth.protect(); }) : ... export const config = { matcher: [ ... "/(api|trpc)(.*)...
- `.next/server/functions-config-manifest.json:3-17` — "/_middleware": { "runtime": "nodejs", "matchers": [ ... "originalSource": "/(api|trpc)(.*)" ] }
- `.next/server/middleware.js:1-6` — R.c("server/chunks/[root-of-the-server]__0obi7ve._.js") ... module.exports=R.m(62395).exports
- `tests/oauth-google-routes.test.ts:15-16` — const getCurrentBusiness = vi.hoisted(() => vi.fn(async () => ({ id: "biz1" }))); vi.mock("@/lib/tenant", ...)

**Fix / action:** Do NOT rename/relocate proxy.ts — it is correct and the prod build (BUILD_ID present, /_middleware in functions-config-manifest.json with the exact matchers, clerkMiddleware compiled into the chunk middleware.js loads) confirms the guard loads. The empty legacy middleware-manifest.json is a non-issue (Next 16 Node-runtime proxy registers under /_middleware in functions-config-manifest.json, not the edge manifest). The one real gap is the missing assertion: add an integration/smoke test (or a CI step against `next build` output) that hits /dashboard and /api/oauth/google/start unauthenticated and asserts a 404/redirect/401, plus a unit test importing proxy.ts that asserts isProtected matches /dashboard,/onboarding,/api/onboarding,/api/oauth and does NOT match / or /pricing. Optionally assert at boot that NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set in production so the guard never silently degrades to the public NextResponse.next() branch.

### B4 — [P0] OPEN (owner: auto, holds: confirmed)
**Verdict:** Confirmed: all 5 internal auth call sites (inbound webhook + 4 cron routes) read the shared secret from the ?secret= query param via req.nextUrl.searchParams.get("secret"), which leaks the secret into access logs, proxies, and Referer headers; none use an Authorization/header secret.

**Evidence:**
- `app/api/inbound/route.ts:21-23` — // Shared-secret check (set the same value in the Postmark webhook URL ?secret=...). ... if (!checkSharedSecret(process.env.INBOUND_WEBHOOK_SECRET, req.nextUrl.searchParams.get(...
- `app/api/cron/sequences/route.ts:9` — if (!checkSharedSecret(process.env.CRON_SECRET, req.nextUrl.searchParams.get("secret"))) {
- `app/api/cron/discovery/route.ts:15` — if (!checkSharedSecret(process.env.CRON_SECRET, req.nextUrl.searchParams.get("secret"))) {
- `app/api/cron/margin-guardrail/route.ts:10` — if (!checkSharedSecret(process.env.CRON_SECRET, req.nextUrl.searchParams.get("secret"))) {
- `app/api/cron/weekly-report/route.ts:9` — if (!checkSharedSecret(process.env.CRON_SECRET, req.nextUrl.searchParams.get("secret"))) {
- `lib/auth-secret.ts:11-17` — export function checkSharedSecret(envVar: string | undefined, provided: string | null): boolean { if (!envVar) return !isProd; ... return a.length === b.length && timingSafeEqua...

**Fix / action:** Move the secret from query string to a request header at all 5 call sites. Add a helper in lib/auth-secret.ts (e.g. extractBearer(req) reading req.headers.get("authorization") and stripping "Bearer ", or an X-Cron-Secret / X-Webhook-Secret header) and replace req.nextUrl.searchParams.get("secret") with that header read; keep the existing timingSafeEqual + fail-closed checkSharedSecret logic unchanged. Optionally keep a transitional header-first/query-fallback for one deploy so external services can migrate, then drop the fallback. The code change must be paired with reconfiguring Postmark's inbound webhook and the cron scheduler (Render/cron config) to send the secret as a header, then rotating the leaked secrets (founder action).

### B5 — [P0] OPEN (owner: auto, holds: confirmed)
**Verdict:** 11 git-tracked duplicate "* 2.*" files exist (5 lib/component sources, 4 tests, 2 prisma migration SQLs); all are dead/unreferenced and safe to delete, though the migrate-deploy risk is latent rather than active.

**Evidence:**
- `(git ls-files output):n/a` — components/mailbox-card 2.tsx, lib/crypto/tokens 2.ts, lib/oauth/google 2.ts, lib/oauth/state 2.ts, lib/outbound/gmail 2.ts, prisma/migrations/20260613090000_mailbox_connection/...
- `prisma/migrations/20260613090000_mailbox_connection/:n/a` — both 'migration 2.sql' files diff byte-identical to canonical migration.sql (diff returns IDENTICAL); only the 2 newest migration dirs are polluted, older 11 are clean
- `lib/oauth/google 2.ts:25-31` — 'google 2.ts' has 'function appUrl()' (no export, old comment) vs canonical 'export function appUrl()' with the proxy-redirect fix — proving the ' 2' copy is a STALE dead versio...
- `vitest.config.ts:9` — include: ["tests/**/*.test.ts"] — '*.test 2.ts' has a space+2 between .test and .ts, so the dup tests do NOT match the glob and do NOT run (no duplicate-test risk, just dead files)

**Fix / action:** Delete all 11 tracked files (git rm) — they are macOS Finder/iCloud "* 2" sync-duplicate artifacts, all introduced in commit 44b0a53, none imported (grep for the ' 2' specifiers returns no references), none matched by the vitest glob, and the 2 migration copies are byte-identical to their canonical migration.sql so removal cannot change deploy behavior. Verified-safe list: components/mailbox-card 2.tsx, lib/crypto/tokens 2.ts, lib/oauth/google 2.ts, lib/oauth/state 2.ts, lib/outbound/gmail 2.ts, tests/{gmail-send,mailbox-crypto,oauth-google-routes,send-venue-pitch}.test 2.ts, and prisma/migrations/{20260613090000_mailbox_connection,20260613100000_venue_pitch_sending}/migration 2.sql. Optionally add a .gitignore guard like '* 2.*' (note: Prisma 6 migrate deploy only executes files named exactly migration.sql, so the stray SQLs are a confusion/footgun risk rather than an active deploy break — still remove them).

### B6 — [P0] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** No legal pages of any kind exist — no privacy policy, terms, DPA, cookie/consent, no LIA, and no data-retention/deletion or DSAR path — while the app actively scrapes third-party contact PII and processes lead personal data.

**Evidence:**
- `app/(marketing)/layout.tsx:7-12, 43-56` — const NAV = [{ href: "/pricing" }, { href: "/compare" }, { href: "/tools/inquiry-reply-generator" }, { href: "/story" }];  // footer reuses NAV — no /privacy, /terms, /legal lin...
- `app/sitemap.ts:6-15` — ROUTES = [ "/", "/pricing", "/compare", "/story", /tools..., "/onboarding" ]  // no legal routes
- `docs/AUDIT-LOOP.md:51` — B6 (P0) No legal pages (privacy policy, terms, DPA, cookie/consent)... add privacy policy, terms, a DPA, cookie consent, and a data-retention/deletion path. (Legal review = FOUN...
- `lib/discovery/contacts.ts:1-10, 27-38` — Contact discovery... find one on the venue's OWN website... export function extractEmails(html: string)  // collects third-party personal data with no privacy notice
- `lib/outreach/jurisdiction.ts:1-13` — Jurisdiction rules engine for cold venue outreach... Fail-closed: anything we haven't researched is treated as consent-required.  // a send-gating table, NOT a documented LIA
- `app/api/optout/route.ts:12-21` — db.lead.update({ where: { id: leadId }, data: { optedOut: true, status: "DEAD" }})  // per-lead outreach opt-out only; not GDPR erasure/export/account deletion

**Fix / action:** Draft and wire four static legal routes under app/(marketing): /privacy, /terms, /cookies, /dpa, plus add these links to the marketing footer (layout.tsx NAV/footer) and app/sitemap.ts. Add a cookie/consent banner (Clerk sets cookies; PECR/ePrivacy require consent) gating any non-essential cookies. Write a documented Legitimate Interest Assessment for the cold venue outreach + contact-scraping in lib/discovery/contacts.ts and reference it in the privacy policy (state Bright Ears = processor for artists' leads, and identify the lawful basis + data source for scraped venue contacts). Build a real data-retention/deletion path: an account-deletion action in app/dashboard/settings that purges/anonymises Lead/Message/MarketingContact/VenuePitch PII, a per-data-subject deletion endpoint (extend the optout pattern to actual erasure, not just status=DEAD), and a defined retention window with a cron purge. The CODE wiring (routes, footer links, sitemap, consent banner, deletion action/cron) is auto-applicable; the legal CONTENT (policy text, DPA terms, LIA conclusion, retention periods) requires founder/legal sign-off.

### B7 — [P1] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** All three sub-claims hold: the Stripe client is initialized with no pinned apiVersion, and the subscription checkout session enables neither automatic_tax nor any billing-address/tax-id collection — so a Thai seller collects no VAT and no customer-location evidence from the first sale.

**Evidence:**
- `lib/billing/stripe.ts:11` — _stripe = new Stripe(key);
- `app/actions/billing.ts:25-35` — const session = await stripe().checkout.sessions.create({ mode: "subscription", line_items: [{ price: price.id, quantity: 1 }], client_reference_id: business.id, ... success_url...
- `scripts/stripe-setup.ts:34-40` — const price = await stripe.prices.create({ product: product.id, unit_amount: item.amount, currency: "usd", recurring: { interval: "month" }, lookup_key: item.lookupKey });

**Fix / action:** 1) Pin the API version explicitly in lib/billing/stripe.ts: new Stripe(key, { apiVersion: \"<dashboard version>\" }) (stripe-node v22.2.0 is installed) so an SDK bump cannot silently change the API contract. 2) In app/actions/billing.ts checkout.sessions.create add automatic_tax: { enabled: true }, billing_address_collection: \"required\", tax_id_collection: { enabled: true }, and customer_update: { address: \"auto\", name: \"auto\" } (needed because an existing customer is reused) so Stripe captures and stores the billing country/address used to determine UK VAT and EU VAT/OSS. 3) Prerequisite (founder): enable Stripe Tax in the dashboard, set the Thai origin tax address, register the product as a digital service, and set tax_behavior on the prices (currently none). Without Stripe Tax enabled, automatic_tax errors at checkout, so the code change must ship together with the dashboard config.

### B8 — [P1] FOUNDER (owner: founder, holds: confirmed)
**Verdict:** Confirmed: Clerk runs as a Development instance (pk_test/sk_test, dev *.accounts.dev Frontend API, no custom domain) — production cutover requires a fresh Production instance with a custom domain + DNS and new pk_live/sk_live keys that do NOT inherit dev settings; this is founder-gated (credentials).

**Evidence:**
- `.env.local:28-30` — # Clerk (app: Bright Ears SaaS, Development instance ...) NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cmVsYXRpdmUtYmx1ZWpheS02My5jbGVyay5hY2NvdW50cy5kZXYk CLERK_SECRET_KEY=sk_test...
- `.env.local:29` — the base64 in pk_test_... decodes to 'relative-bluejay-63.clerk.accounts.dev$' — a Development Frontend API on the shared *.accounts.dev domain, not a custom prod domain
- `app/layout.tsx:43` — return clerkEnabled ? <ClerkProvider>{html}</ClerkProvider> : html;
- `proxy.ts:19` — const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
- `docs/AUDIT-LOOP.md:53` — B8 (P1) Clerk is the Development instance; production needs a custom domain + DNS + pk_live/sk_live and does NOT copy dev settings — document the cutover (FOUNDER-gated).

**Fix / action:** No code change is required; the env-driven config (bare ClerkProvider reading NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/CLERK_SECRET_KEY) is correct and portable. Document and execute the founder-gated cutover before Phase 8 apex-domain switch. Cutover steps: (1) In the Clerk Dashboard, create a Production instance for the Bright Ears SaaS app (Clerk does NOT copy Development settings to Production — every setting must be re-entered: sign-in/up options, social connections, JWT templates, webhooks, allowed redirect origins, email/SMS templates, session/MFA settings). (2) Set the production Frontend API custom domain (e.g. clerk.brightears.io) and add the CNAME / DNS records Clerk provides (accounts., clerk., clkmail./mail subdomains for email) — coordinate with the in./mail./agency.brightears.io DNS work already on the founder gate list, and per Hard Rule 2 do this only after the live venue portal has moved to agency.brightears.io and Vinyl is verified. (3) Wait for DNS verification + SSL issuance in the Clerk dashboard. (4) Add the production Allowed Origins / redirect URLs for the deployed app domain. (5) Generate pk_live/sk_live and set them on Render (NOT in committed files) replacing the pk_test/sk_test values; also set the production NEXT_PUBLIC_CLERK_SIGN_IN/SIGN_UP_FALLBACK_REDIRECT_URL. (6) Re-create any Clerk webhooks/JWT templates against the production instance and update their secrets. (7) Verify sign-in/up/UserButton and proxy.ts route protection on the deployed domain before pointing the apex at this app. Keep the Development instance for local/CI (the app already degrades to single-tenant demo mode when keys are absent — proxy.ts:19-29, lib/tenant.ts:4).

### B9 — [P1] FOUNDER (owner: founder, holds: partially)
**Verdict:** The technical claims (gmail.send restricted scope is used; refresh/persist works; tokens are AES-256-GCM at rest) are all CONFIRMED and correctly implemented — but the actual risk (testing-mode 100-user cap / CASA Tier 2 before public launch) is real and UNMITIGATED in code: any signed-in tenant can connect, with no test-user/waitlist gate.

**Evidence:**
- `lib/oauth/google.ts:21-23,63-75` — export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"; const SCOPES = [GMAIL_SEND_SCOPE, "openid", "email"]; ... scope: SCOPES.join(" "), access_type: "of...
- `lib/crypto/tokens.ts:19-21,53-61` — const ALGO = "aes-256-gcm"; const IV_LEN = 12; const TAG_LEN = 16; ... const iv = randomBytes(IV_LEN); const cipher = createCipheriv(ALGO, key, iv); ... return Buffer.concat([iv...
- `lib/outbound/gmail.ts:48-73` — if (conn.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) { return decryptToken(conn.accessTokenEnc); } ... refreshed = await refreshAccessToken(decryptToken(conn.refreshToke...
- `app/api/oauth/google/callback/route.ts:80-92` — if (!tokens.scope.split(/\s+/).includes(GMAIL_SEND_SCOPE)) { return settingsRedirect(req, "?mailbox=error&reason=scope"); } ... accessTokenEnc: encryptToken(tokens.access), refr...
- `ROADMAP.md:106` — 10.5 June 13 (Gmail OAuth LIVE on prod; adversarial review + 13 fixes; CASA review deferred to public launch)
- `components/mailbox-card.tsx:146-151` — {state.kind === "disconnected" && ( ... <a href="/api/oauth/google/start" className={buttonStyles.primary}>Connect Gmail</a>

**Fix / action:** No crypto/refresh fix is needed — that implementation is correct (AES-256-GCM, random IV, GCM auth tag, ciphertext-only columns, refresh-on-skew with re-encrypt-and-persist, scope audit on callback). The open item is operational: while the Google OAuth app is in testing mode it hard-caps at 100 test users, and public listing requires CASA Tier 2 (~$500-$4500, 2-6 months, annual). Two concrete steps: (1) FOUNDER must run Google verification/CASA submission before opening Gmail-connect beyond ~100 hand-added test users (longest lead time — start now; already documented as deferred in ROADMAP.md:106 and docs/NATIVE-APP-LOOP.md:34). (2) AUTO-safe code hardening: add an in-app gate so Gmail-connect cannot silently exceed the testing-mode cap pre-CASA — e.g. a MailboxConnection count guard or allowlist check in app/api/oauth/google/start/route.ts that bounces with a waitlist message once the cap is hit, instead of sending the 101st user into Google's generic 403. Today components/mailbox-card.tsx offers an open "Connect Gmail" link to every tenant with zero gating.

### C1 — [P0] OPEN (owner: auto, holds: confirmed)
**Verdict:** The reactive flow has a P0 dead end: once a lead's first reply is sent, there is no UI to Mark booked or Mark dead, so the core "booked-or-dead" outcome can never be recorded through the app — most fatally for ENGAGED leads (client replied "yes"), whose sequence is stopped and never re-drafts.

**Evidence:**
- `app/dashboard/leads/[id]/page.tsx:57,165-174` — drafts: { where: { status: "PENDING" }, ... }  ...  {pendingDraft && (<section><DraftReview .../></section>)}
- `components/draft-review.tsx:175-180` — <button ... onClick={onBooked} ...>Mark booked</button> ... <button ... onClick={onDead} ...>Mark dead</button>
- `lib/inbound/pipeline.ts:50-74` — db.lead.update({ where: { id: existing.id }, data: { status: "ENGAGED" } }), ... return { outcome: "reply_attached", leadId: existing.id };
- `lib/sequences/engine.ts:41-45,94-101` — status: { in: ["NEW", "DRAFTED"] }, ... if (lead.optedOut || ["BOOKED", "DEAD", "ENGAGED", "SPAM"].includes(lead.status)) { ... stoppedAt: now ... }
- `lib/reports/weekly.ts:34,67` — db.lead.count({ where: { businessId, bookedAt: { gte: since } } }) ... subject: `Your week: ${n.leadsIn} leads in, ${n.booked} booked`

**Fix / action:** Surface markBooked/markDead (and a manual "draft a reply" / reopen affordance) on the lead detail page independent of whether a PENDING draft exists. Concretely: in app/dashboard/leads/[id]/page.tsx, always render lead-outcome controls for non-terminal leads (NEW, DRAFTED, REPLIED, IN_SEQUENCE, ENGAGED) — extract the Mark booked / Mark dead buttons from components/draft-review.tsx into a small always-on LeadOutcomeControls client component that calls the existing markBooked/markDead server actions (already tenant-scoped and correct). Keep DraftReview for when a PENDING draft is present. This is the minimal fix; both server actions already exist and work, so it is a pure UI wiring change. Verify the dashboard board's BOOKED/DEAD columns then become reachable and the weekly report's "booked" stat can be non-zero.

### C2 — [P1] FOUNDER (owner: founder, holds: partially)
**Verdict:** The core profile→license→draft→approve→send/copy path works end-to-end and is well-guarded, but the journey breaks at both bookends: there is no user-facing way to trigger a venue scan (and no scheduler config wiring the cron), and once a pitch is SENT the venue/pitch disappears from the entire UI with no surface to track it or capture a reply — contradicting the "PITCHED→(reply)→pipeline" promise.

**Evidence:**
- `app/dashboard/page.tsx:60-65` — // from PITCHED onward lives in the reply/pipeline flow, not the rail. const HUNT_STATUSES = [   "DISCOVERED",   "QUALIFIED",   "PITCH_DRAFTED", ] as const
- `app/actions/venues.ts:384-387` — db.venue.updateMany({       where: { id: venue.id, businessId: business.id, status: "PITCH_DRAFTED" },       data: { status: "PITCHED", pitchedAt: new Date() },     }),
- `prisma/schema.prisma:497-499` — // pitches send from the ARTIST'S own Gmail/Microsoft inbox via OAuth ... gmail.send scope ONLY — // reply capture (readonly/modify) is a later phase.
- `lib/discovery/provider.ts:155-160` — export function getDiscoveryProvider(): DiscoveryProvider {   if (process.env.DISCOVERY_PROVIDER === "stub") return new StubDiscoveryProvider();   if (process.env.SERPER_API_KEY...
- `components/hunt-feed.tsx:289-294` — hint="Once the venue scanner connects, new openings and rooms that fit your sound land here ..."           cta={             <span ...>               Scanner arrives with the ne...

**Fix / action:** Treat as two fixes. (1) Post-send dead-end (the bigger gap): add a venue-outreach surface (e.g. a "Sent / In conversation" rail or /dashboard/venues page) querying VenueStatus PITCHED/REPLIED/IN_CONVERSATION/BOOKED/DEAD with manual status controls, so a SENT pitch is trackable; until venue-reply capture (gmail.send is send-only, no read scope) and the FOUND→PITCHED→pipeline bridge are built, at minimum let the owner manually mark a PITCHED venue REPLIED/BOOKED/DEAD. (2) Scan triggering: add the cron schedule to the deploy config (no render.yaml/vercel.json exists) and/or expose an owner-facing "Scan now" affordance honoring the 20h budget guard; also make the empty-state copy honest about the SERPER_API_KEY/provider dependency (without a key getDiscoveryProvider() silently returns the fixture StubDiscoveryProvider).

### C3 — [P1] FOUNDER (owner: founder, holds: partially)
**Verdict:** The core billing chain (auto trial → Stripe checkout → portal upgrade/downgrade/cancel, all webhook-synced) is wired end to end and works, but three real gaps remain: no post-checkout success/cancel confirmation UI, no in-app at-cap indicator or usage meter (at-cap relies solely on an optional push), and the advertised lead-pack overage path is marketing copy with zero implementation.

**Evidence:**
- `lib/tenant.ts:29-30` — plan: "TRIAL", trialEndsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
- `app/actions/billing.ts:32-33` — success_url: `${appUrl()}/dashboard/settings?billing=success`, cancel_url: `${appUrl()}/dashboard/settings?billing=cancelled`,
- `app/dashboard/settings/page.tsx:122` — searchParams: Promise<{ mailbox?: string | string[]; reason?: string | string[] }>;
- `app/api/webhooks/stripe/route.ts:60-77` — case "customer.subscription.updated": ... if (plan && plan !== business.plan) { await db.business.update(...) } ... else if (sub.status === "canceled" || sub.status === "unpaid")
- `lib/inbound/pipeline.ts:161-166` — if (meter.overCap) { void pushToBusiness(business.id, { title: "Lead cap reached", body: `${meter.used}/${meter.cap} leads this month — ... Upgrade to keep replies flowing.`
- `app/(marketing)/pricing/page.tsx:92` — You can add a lead pack ($10 per 10 leads) or upgrade your plan in one click.

**Fix / action:** 1) In app/dashboard/settings/page.tsx widen the searchParams type to include billing?: string and render a success toast/banner on ?billing=success and a soft notice on ?billing=cancelled (the redirect targets already exist in billing.ts:32-33 — only the consumer is missing). 2) Surface at-cap in the UI, not just via optional push: have the dashboard and/or BillingCard call meterState (lib/billing/metering.ts) and render a 'X/Y leads this month — drafting paused' banner with an upgrade/lead-pack CTA when overCap, so an owner with push disabled still sees it. 3) Decide and implement (or remove) the lead-pack overage path: scripts/stripe-setup.ts only creates the 3 subscription products, there is no lead-pack price, checkout, or UI, yet pricing/compare pages advertise '$10 per 10 leads' — either add a one-time lead-pack price + a checkout action + a button on the at-cap surface, or strike the claim from marketing copy until v1.1.

### C4 — [P1] OPEN (owner: auto, holds: partially)
**Verdict:** Opt-out flow is correct and stops sequences end-to-end; the first-run empty dashboard is genuinely two-headed — three empty blocks with two competing setup CTAs (Soundcheck "Resume setup" vs "Connect your leads") that both deep-link to the same onboarding wizard, giving no single clear next action.

**Evidence:**
- `app/api/optout/route.ts:12-21` — db.lead.update({ where:{id:leadId}, data:{optedOut:true,status:"DEAD",deadAt:new Date()} }), db.sequenceRun.updateMany({ where:{leadId,stoppedAt:null}, data:{stoppedAt:new Date(...
- `lib/sequences/engine.ts:94-101` — if (lead.optedOut || ["BOOKED","DEAD","ENGAGED","SPAM"].includes(lead.status)) { ... stopReason: lead.optedOut ? "opted_out" : ... }
- `app/actions/drafts.ts:40-42` — const body = draft.isFollowUp ? approvedBody + complianceFooter(lead.business.name, lead.id) : approvedBody;
- `app/dashboard/page.tsx:199-233` — <OnboardingBanner /> ... title="No leads yet." ... <Link href="/onboarding" ...>Connect your leads</Link>
- `components/onboarding-banner.tsx:36-45` — Soundcheck pending ... we still need {missing} ... <Link href="/onboarding" ...>Resume setup →</Link>
- `app/onboarding/page.tsx:24-25` — const initialStep = packages.length === 0 ? 0 : hasVoice ? 3 : 2;

**Fix / action:** Collapse the first-run state to ONE primary action. When a tenant has no packages/voice (onboarding incomplete), suppress or demote the "No leads yet / Connect your leads" EmptyState CTA and let the OnboardingBanner be the single call to action — setup must finish before leads can be drafted anyway. Conversely, once setup is complete but zero leads exist, hide the banner and show only the "Connect your leads" welcome. Concretely: in app/dashboard/page.tsx gate the empty-state CTA on the same needsPackages/needsVoice signal the banner uses (lift that check into a shared helper), and have the EmptyState's CTA route to the correct wizard step rather than implying "Connect your leads" when the real blocker is packages/voice (initialStep resolves to step 0 anyway, so the label over-promises). Safe copy/flow change, no business decision required.

### C5 — [P0] OPEN (owner: auto, holds: confirmed)
**Verdict:** Finding holds: real mobile/a11y defects exist — dashboard nav overflows off-screen on phones (P0 for the "approve from the booth" journey), the marketing header hides its only nav + Start-free CTA below 640px with no hamburger fallback, and several cream text styles fail WCAG AA and the design's own contrast floor; forms, alt text, focus rings and reduced-motion are actually fine.

**Evidence:**
- `app/dashboard/layout.tsx:21-27` — <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6"> ... <DashboardNavLinks links={NAV} />
- `components/dashboard-nav.tsx:14` — <div className="flex items-center gap-1.5 text-sm">
- `app/(marketing)/layout.tsx:23` — <nav className="hidden items-center gap-7 text-sm font-medium sm:flex">
- `app/(marketing)/page.tsx:169` — <p className="mt-6 text-sm text-cream/45">{TRUST_LINE}</p>
- `app/(marketing)/layout.tsx:44` — px-6 py-10 text-sm text-cream/45
- `docs/DESIGN.md:10` — secondary text on ink = cream/55%.

**Fix / action:** 1) Dashboard nav (P0): make components/dashboard-nav.tsx responsive — either a hamburger/sheet menu below sm, or wrap the bar and let the link row horizontally scroll (overflow-x-auto + flex-nowrap, drop the fixed h-16 to min-h) so all five sections stay reachable on a phone; verify at 375px. 2) Marketing header (P1): add a mobile menu toggle (button with aria-expanded/aria-controls) that reveals NAV + the Start-free CTA below sm in app/(marketing)/layout.tsx; never leave the primary CTA hidden on mobile. 3) Contrast (P1): bump every text-cream/40, /45, /50 used for readable copy up to at least cream/65–70 (computed: /45=3.81:1, /50=4.40:1, both fail AA 4.5:1; /70=7.40:1 passes) — concrete spots: page.tsx:169, :423, :461, layout.tsx:44, leads/[id]/page.tsx:153, the tools pages, calendar:209,216. Decorative/aria-hidden ornaments can stay. All three are pure layout/copy/Tailwind-class changes with no business input required.

### D1 — [P1] OPEN (owner: auto, holds: partially)
**Verdict:** Lint FAILS (3 errors, 15 warnings, exit 1); production build PASSES (exit 0) because Next 16 `next build` no longer runs ESLint, so the lint errors do not block deploys today.

**Evidence:**
- `package.json:6-8` — "build": "next build", "lint": "eslint",
- `app/(marketing)/design/a/page.tsx:125` — <a href="/" className="flex items-center gap-2.5">  // error @next/next/no-html-link-for-pages
- `components/demo-widget.tsx:43-45` — useEffect(() => {   if (phase === "typing" && result && typed >= totalChars) setPhase("done"); }, [phase, result, typed, totalChars]);  // error react-hooks/set-state-in-effect
- `components/motion.tsx:65-66` — const delay = wordIndex * staggerMs; wordIndex += 1;  // error react-hooks/immutability: Cannot reassign variable after render completes
- `next.config.ts:3-5` — const nextConfig: NextConfig = {   /* config options here */ };  // no eslint.ignoreDuringBuilds / typescript.ignoreBuildErrors — build enforces tsc, NOT eslint in Next 16

**Fix / action:** Treat lint as a real gate (CI runs `npm run lint`, not just `next build`). Fix the 3 errors: (1) app/(marketing)/design/a/page.tsx:125 — replace `<a href="/">` with `<Link href="/">` from next/link. (2) components/demo-widget.tsx:44 — move the "typing complete" transition into the typing interval's setTyped updater (set phase to "done" when the clamp reaches total) instead of a setState-in-effect, or guard with a ref. (3) components/motion.tsx:66 — compute a stable per-word index from li/wi (e.g. precompute cumulative word counts) instead of mutating `wordIndex`/`accentUsed` during render. Then clear the 15 warnings (unused vars in tests/lib, stale eslint-disable in lib/outbound/gmail.ts:95 — drop the directive; many warnings come from the stray "* 2" duplicate files, see newFindings). All three are mechanical code/copy fixes with no business decision — safe to auto-apply.

### D2 — [P2] OPEN (owner: auto, holds: confirmed)
**Verdict:** Legacy v1 pastel tokens and dead code both confirmed: 6 v1 tokens still defined (one fully unused), one whole marketing route still rendered in the abandoned v1 palette, and 9 git-tracked Finder-duplicate "* 2.ts(x)" files that are never imported.

**Evidence:**
- `app/globals.css:27-33` — /* Legacy tokens kept so v1 screens render during the migration; remove after reskin */\n  --color-deep-teal: #1a5152;\n  --color-soft-lavender: #d59ec9;\n  --color-warm-peach: ...
- `app/(marketing)/compare/[slug]/page.tsx:33-35` — yes: "bg-brand-cyan-soft text-deep-teal",\n    partial: "bg-warm-peach text-ink",\n    no: "bg-off-white text-ink/50",
- `components/mailbox-card 2.tsx:1-1` — git-tracked duplicate (154 lines vs real 201-line mailbox-card.tsx); settings page imports "@/components/mailbox-card", never the " 2" copy
- `lib/oauth/google 2.ts:1-1` — git ls-files lists 5 source + 4 test "* 2.ts(x)" duplicates; grep for imports of "tokens 2/google 2/state 2/gmail 2/mailbox-card 2" returns NOT IMPORTED for all
- `docs/REVIEW-DEFERRED.md:7-11` — Extract lib/format.ts (formatMoney...); ... Lead status labels duplicated ... One shared LEAD_STATUS_LABELS.
- `app/dashboard/page.tsx:19-20` — // Which statuses appear as pipeline columns... Labels + colors come\n// from LEAD_STATUS_META (the single source of truth in components/ui.tsx).

**Fix / action:** Auto-safe cleanup pass: (1) Delete the 9 dead Finder-duplicate files via git rm: "components/mailbox-card 2.tsx", "lib/crypto/tokens 2.ts", "lib/oauth/google 2.ts", "lib/oauth/state 2.ts", "lib/outbound/gmail 2.ts", and "tests/{gmail-send,mailbox-crypto,oauth-google-routes,send-venue-pitch}.test 2.ts" (all verified never-imported; test copies end in ".test 2.ts" so vitest's tests/**/*.test.ts glob already skips them — no behavior change). (2) Remove the unused --color-earthy-brown token from globals.css (zero references). (3) Migrate app/(marketing)/compare/[slug]/page.tsx off the v1 pastel tokens (deep-teal/soft-lavender/warm-peach/off-white/bare-ink) to the v2 Neon Collage palette, then drop the remaining 5 legacy tokens from globals.css lines 28-33 — this is the last file holding them. REVIEW-DEFERRED.md status to record: cleanup items 1 (lib/format.ts), 2 (fmtEventDate dup — leads/[id] carries timeZone, dashboard's fmtDate does not), 3 (tool-reply-generator still lacks the 429 case demo-widget has), 4, 6 OPEN; item 5 (lead status labels) PARTIALLY DONE via shared LEAD_STATUS_META; efficiency + altitude + parser + display items all OPEN. Update REVIEW-DEFERRED.md to tick item 5 and add a dead-duplicate-files cleanup note.

### D3 — [P2] OK (owner: auto, holds: already_fixed)
**Verdict:** All three D3 checks pass: 0 production high/critical vulns, every cron route enforces fail-closed shared-secret auth, and the 70% margin guardrail exists and is wired to a scheduled cron — but two real adjacent gaps undercut the guardrail's accuracy and delivery.

**Evidence:**
- `lib/auth-secret.ts:11-17` — export function checkSharedSecret(envVar, provided) { if (!envVar) return !isProd; if (!provided) return false; ... return a.length === b.length && timingSafeEqual(a, b); }
- `app/api/cron/margin-guardrail/route.ts:9-12` — if (!checkSharedSecret(process.env.CRON_SECRET, req.nextUrl.searchParams.get("secret"))) { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
- `lib/billing/margin.ts:30-31,59` — export const MARGIN_FLOOR_PCT = 70; ... flagged: grossMarginPct < MARGIN_FLOOR_PCT,
- `lib/llm/index.ts:45-46` — await db.llmUsage.create({ data: { businessId, purpose, model, ... } });
- `docs/DEPLOYMENT.md:12` — Cron `brightears-app-margin-guardrail` | `0 2 * * *` (daily 02:00 UTC) -> `/api/cron/margin-guardrail`

**Fix / action:** No fix required for the three stated checks — they hold today. npm audit: 0 high/critical in production deps (--omit=dev); the 5 high vulns are entirely in the dev-only vitest/vite/esbuild chain (esbuild dev-server file read, Deno RCE) and are not in the runtime, so they are acceptable but worth a routine `npm audit fix` on the dev toolchain. Cron auth: all four routes (sequences, weekly-report, margin-guardrail, discovery) gate on checkSharedSecret with CRON_SECRET, fail-closed in prod, timing-safe — correct. Margin guardrail: lib/billing/margin.ts + the cron implement rule 8 correctly. Close D3 as already satisfied; address the two newFindings below to make the guardrail trustworthy.

---

## Detail — new adjacent findings

### NF1 (from A1) — [P1] OPEN — Guarantee is published as machine-readable schema.org FAQ JSON-LD to search engines
- **Evidence:** app/(marketing)/compare/page.tsx:57 injects faqJsonLd(HUB_FAQS); HUB_FAQS[228] in lib/marketing/comparisons.ts contains 'if it doesn't pay for itself in your first season, full refund', so the unenforceable promise is emitted as application/ld+json FAQPage structured data, not just on-page copy.
- **Fix:** Strip any refund/guarantee claim from JSON-LD output until the policy is final and a refund-policy page exists; structured-data claims raise advertising-law exposure and are indexed/quoted by search engines.

### NF2 (from A1) — [P1] FOUNDER — No refund-policy / terms page exists anywhere in the app
- **Evidence:** find across the repo for *terms*/*refund*/*legal*/*guarantee* page files returns nothing; the guarantee's triggers ('pays for itself','season') are therefore defined and linked nowhere in any user-facing policy.
- **Fix:** Add a /refund-policy (and likely /terms) route stating the exact refund window, method, and conditions, and link it from every guarantee mention. Founder must supply the real policy terms.

### NF3 (from A1) — [P2] OPEN — Stated finding location 'landing metadata' is inaccurate; the metadata hit is the pricing page, and two comparisons.ts occurrences were missed
- **Evidence:** app/(marketing)/page.tsx, app/layout.tsx and app/(marketing)/layout.tsx contain NO guarantee/refund/season text; the metadata occurrence is app/(marketing)/pricing/page.tsx:14. The finding's '~lines 14/76/294/362' is correct for pricing but omits lib/marketing/comparisons.ts:38 and :228, which render on /compare and /compare/[slug].
- **Fix:** Use the corrected 6-location inventory (pricing/page.tsx 14,76,294,362 + comparisons.ts 38,228) when applying the fix so the compare pages are not left with stale guarantee copy.

### NF4 (from A2) — [P1] FOUNDER — Pricing guarantee states 'full refund' as firm policy with no terms
- **Evidence:** app/(marketing)/pricing/page.tsx:76 — "if Bright Ears doesn't pay for itself in your first season, full refund" plus the $1.67/lead vs $28–47 Bark comparison stated as fact (pricing/page.tsx:285-289). Pre-launch this is an unbacked refund promise with no defined 'season', eligibility, or terms page.
- **Fix:** Founder must define refund terms (what 'first season' means, eligibility, how to claim) and link a terms page, or soften the guarantee wording. Also verify the $1.67/lead internal cost and the $28–47 Bark figure are real.

### NF5 (from A2) — [P1] FOUNDER — 'About a third of vendors never reply' stated unsourced across multiple pages
- **Evidence:** page.tsx:243 "a third of vendors never reply at all"; templates/page.tsx:395 & 559-560 "about a third of vendors never reply"; story/page.tsx:210 and lead-roi-calculator repeat it. Presented as established fact with no citation.
- **Fix:** Likely a real industry stat (WeddingWire/The Knot) but must be cited or softened. Add a source footnote or rephrase as a general observation.

### NF6 (from A3) — [P0] FOUNDER — Uncited quantitative stat claims on landing page ('~50% of couples book the first responder', '$1,800 the booking you stop losing', '<5 min median first reply') with no source or pre-launch-data disclaimer
- **Evidence:** app/(marketing)/page.tsx:41-45 STATS array renders "~50%","of couples book the first responder" and "$1,800","the booking you stop losing" and "<5 min","median first reply" as headline stats; identical stats duplicated in app/(marketing)/design/a/page.tsx:46, design/b/page.tsx:212, design/c/page.tsx:29. For a pre-launch product with no customers, a 'median first reply' metric is unearned and the % / $ figures are uncited.
- **Fix:** Either cite each stat inline (source + date) or relabel as illustrative/target (e.g. 'designed to reply in under 5 minutes'); remove 'median first reply' framing until real tenant data exists. Founder must supply/approve any real numbers.

### NF7 (from A3) — [P0] FOUNDER — 'full refund' / 'pays for itself' guarantee copy shipped without a written refund policy
- **Evidence:** app/(marketing)/pricing/page.tsx:14 "If it doesn't pay for itself in your first season, full refund." and lib/marketing/comparisons.ts:228 repeats "if it doesn't pay for itself in your first season, full refund." — a money-back legal commitment with no defined terms (what 'pays for itself' means, refund window, eligibility).
- **Fix:** Founder must confirm the real refund policy and terms before this copy ships; engineering should link it to a written policy page. Do not auto-edit a money/legal promise.

### NF8 (from A4) — [P1] OPEN — "25 proven templates" is an unsubstantiated efficacy claim (P1)
- **Evidence:** components/tool-reply-generator.tsx:215 "Get our 25 proven inquiry & follow-up templates" and the StickerChip at :211 "Free — 25 templates". "proven" implies validated efficacy on a pre-launch product with no usage data.
- **Fix:** Drop "proven" — use "25 ready-to-send templates" or "field-tested" only with real data to back it. Safe copy edit.

### NF9 (from A4) — [P1] FOUNDER — Speed claims ("under 5 minutes") stated as absolutes vs hedged stat elsewhere on same page (P1)
- **Evidence:** page.tsx:27 (metadata) and page.tsx:148 "Every inquiry answered in your voice in under 5 minutes" are unqualified, while page.tsx:42 STATS hedges the same metric as "<5 min median first reply". Inconsistent: the absolute version overpromises a per-lead guarantee the median stat does not support.
- **Fix:** Align prose to the hedged median framing ("in minutes" / "typically under 5 minutes") so marketing copy and the stat row agree. Safe copy edit, but verify the median number is real before publishing.

### NF10 (from A4) — [P1] FOUNDER — Refund/guarantee language appears in pricing copy and must match the real policy (P1)
- **Evidence:** pricing/page.tsx:14 "If it doesn't pay for itself in your first season, full refund." and pricing:92 "No surprise bills, ever." These are money/legal commitments surfaced in user-facing copy.
- **Fix:** Confirm the season-based full-refund guarantee and the never-overbill promise are policies the founder will actually honor and that billing enforces (CLAUDE.md states pause-at-cap is implemented). If the guarantee wording is final, keep; otherwise founder must set exact terms.

### NF11 (from A5) — [P2] FOUNDER — Proactive Hunt/venue-pitch feature is shipped but undisclosed in all pricing and marketing copy
- **Evidence:** The Hunt is a substantial, working feature (components/hunt-feed.tsx, components/venue-pitch-review.tsx, lib/agent/venue-pitch.ts, lib/outreach/caps.ts with DAILY_SEND_CAPS HOT:10/WARM:5/SEED:3) that sends outbound venue pitches from the owner's own mailbox. A grep of app/(marketing) and lib/marketing for hunt|proactive|outbound|venue pitch|reach out returns no customer-facing description — the landing page (app/(marketing)/page.tsx) and pricing page frame the product purely as a reactive inbox assistant ('every inquiry answered'). Customers buying Starter/Pro/Studio are never told proactive outreach exists, what its limits are, or that its daily caps are NOT part of the 15/60/150 monthly lead allowance.
- **Fix:** Founder decision: decide whether the Hunt is a launch feature, beta, or held back. If launching it, add a clearly-labeled, SEPARATE allowance line to pricing/marketing (e.g. 'Proactive outreach: up to ~18 venue pitches/day, separate from your monthly leads') so it is disclosed without being conflated with the lead cap. If holding it back, confirm it is not reachable by paying customers pre-launch. Either way the current silent-feature state is a transparency gap.

### NF12 (from A6) — [P2] FOUNDER — No Terms of Service / billing-terms link on the Stripe checkout session
- **Evidence:** startCheckout in app/actions/billing.ts (lines 25-37) creates the subscription checkout session with no consent_collection, no custom_text, and no terms_of_service acceptance. Combined with the pricing page CTAs ('Start free' at app/(marketing)/pricing/page.tsx:241-250 and 365-369) which never link to a Terms page, the user is never shown or asked to accept binding subscription terms before being charged.
- **Fix:** Add a Terms of Service / billing-terms page and link it from both the marketing CTAs and the checkout flow; enable Stripe consent_collection.terms_of_service:'required' with the ToS URL set in the Stripe dashboard so acceptance is captured at checkout.

### NF13 (from A6) — [P2] FOUNDER — Refund-guarantee copy ('full refund') has no backing policy mechanism or surfaced terms
- **Evidence:** app/(marketing)/pricing/page.tsx repeats 'If it doesn't pay for itself in your first season, full refund.' (lines 76, 294, 363) but there is no refund-policy page, no definition of 'first season', and no in-app/checkout reference to it. Under FTC/ARL a refund guarantee used as a sales inducement must be honored as stated and its material terms disclosed.
- **Fix:** Define and publish the refund policy (what 'first season' means, how to claim, timeframe) and link it from pricing + checkout; founder must confirm the actual policy before it is codified.

### NF14 (from A7) — [P1] FOUNDER — Founding-members plan trades a discount for reviews/case studies — incentivized-review disclosure needed before those go live
- **Evidence:** docs/PRODUCT-BRIEF.md line 43: "Founding members: first 25 at $15/mo for year one ↔ review + case study." This means the first published Bright Ears reviews/case studies will be materially incentivized (discounted price in exchange for the review). Under the FTC Reviews & Testimonials Rule (effective 2024) and UK DMCC, that material connection must be clearly and conspicuously disclosed wherever such reviews/case studies appear. No disclosure mechanism or copy currently exists in the marketing pages.
- **Fix:** Before any founding-member review or case study is published on the marketing site, add a clear-and-conspicuous disclosure adjacent to it (e.g. "Founding member — received a discounted plan"). Add this as a standing requirement in MARKETING-PLAN.md so it is not forgotten at launch.

### NF15 (from A7) — [P2] FOUNDER — Headline stat claims lack on-page substantiation ("~50% of couples book the first responder", "median first reply <5 min")
- **Evidence:** app/(marketing)/page.tsx lines 42-44 STATS: { n: "<5 min", l: "median first reply" }, { n: "~50%", l: "of couples book the first responder" }, { n: "$1,800", l: "the booking you stop losing" }. The "~50%" / "a third of vendors never reply" figures are market stats with no cited source on-page, and "median first reply <5 min" is a performance claim for a pre-launch product with no live customer data. PRODUCT-BRIEF §3 references the underlying research but the page shows no source.
- **Fix:** Add a source citation or qualifier for the market statistics (e.g. footnote linking the study), and frame "<5 min median first reply" as a target/capability rather than a measured outcome until real customer telemetry exists. This is adjacent to A7 but is a substantiation issue rather than a testimonial issue.

### NF16 (from A8) — [P1] OPEN — Live demo widget output not labeled as a sample/example
- **Evidence:** components/demo-widget.tsx renders the AI draft inside a 'Now playing — your reply' card with a 'Drafted in {seconds}s' chip (lines 159-203) but never labels the output as an illustrative sample. This is exactly the labeling A7 calls for (docs/AUDIT-LOOP.md line 39: 'Label the live demo widget output ... as sample/example, never as real outcomes'), and it reinforces the same outcome-implication problem A8 flags on the hero.
- **Fix:** Add an unobtrusive 'Sample reply — generated live from your text' label/disclaimer in the demo result card so the live output reads as an example, not a measured outcome.

### NF17 (from A8) — [P2] OPEN — '5-minute setup' / 'under 5 minutes' setup claim stated as fact pre-launch
- **Evidence:** app/(marketing)/page.tsx line 30 TRUST_LINE '14-day free trial · no card · 5-minute setup' and line 312 'about five minutes of setup' assert a measured setup time with no substantiation; same A2 class as the '<5 min median first reply' stat already flagged.
- **Fix:** Reframe as a target/estimate ('setup in minutes' / 'about five minutes') consistently and avoid presenting it as a measured fact until validated.

### NF18 (from B1) — [P2] OPEN — stripeSubscriptionId is not @unique, and lookups use findFirst
- **Evidence:** prisma/schema.prisma:91 declares `stripeSubscriptionId String?` with no @unique (compare stripeCustomerId:90 which IS @unique). The webhook resolves the business via db.business.findFirst({ where: { stripeSubscriptionId: sub.id } }) at route.ts:62-64 and 83-86. Without a unique index this silently picks an arbitrary row if an id ever collides, and findFirst is non-deterministic.
- **Fix:** Add @unique to Business.stripeSubscriptionId and switch the two findFirst calls to findUnique. This also enforces the data invariant that one Stripe subscription maps to exactly one business.

### NF19 (from B1) — [P2] OPEN — checkout.session.completed re-calls stripe().subscriptions.retrieve on every redelivery
- **Evidence:** route.ts:43 `const sub = await stripe().subscriptions.retrieve(subscriptionId);` runs before any dedup; under Stripe's retry storms (up to 3 days) this fires a billable/rate-limited Stripe API call per redelivery, not just a no-op DB write.
- **Fix:** The event.id dedup from B1 fixes this too — short-circuiting duplicates before the switch avoids the redundant retrieve(). No separate change needed once B1 lands.

### NF20 (from B10) — [P1] OPEN — Caught errors in inbound/cron never alerted
- **Evidence:** inbound 61-65 and cron 51-53 only console.error, not OPS_ALERT_EMAIL.
- **Fix:** Extract a reportError helper for those catch blocks.

### NF21 (from B10) — [P2] OPEN — Duplicate dead file lib/outbound/gmail 2.ts
- **Evidence:** mirrors gmail.ts, same 429 handling at 180/227.
- **Fix:** Delete after confirming no imports.

### NF22 (from B11) — [P2] FOUNDER — Rotating TOKEN_ENCRYPTION_KEY will silently break all stored Gmail OAuth tokens (no re-encryption / re-auth path)
- **Evidence:** lib/crypto/tokens.ts:29 derives the AES-256-GCM key directly from process.env.TOKEN_ENCRYPTION_KEY, and .env.local comments it as 'AES-256-GCM key for token-at-rest encryption' with 'ALSO add this exact value to Render so encrypted tokens decrypt there.' Gmail send (Phase 10.5, lib/oauth/google.ts + lib/gmail send) stores OAuth refresh tokens encrypted with this key. If the founder rotates it (which B11 asks them to do), every previously-stored token becomes undecryptable and mailbox sending fails with no automatic re-auth prompt.
- **Fix:** Before/at rotation: document that rotating TOKEN_ENCRYPTION_KEY requires connected mailboxes to re-authorize (re-run the Gmail OAuth start flow). Ideally add a decrypt-failure handler that flags the mailbox as 'reconnect required' instead of throwing. Treat key rotation as a coordinated step, not a drop-in swap.

### NF23 (from B11) — [P2] FOUNDER — STITCH_API_KEY stored in .env.local is dead weight in the app (only the MCP uses it) — confirm it's still needed at all
- **Evidence:** grep for STITCH_API_KEY across all *.ts/*.tsx/*.js/*.json (excluding node_modules/.next) returns zero code reads; it appears only in .env.local and in CLAUDE.md:31 ('key in .env.local') as input to the Google Stitch design MCP. Per CLAUDE.md the pastel direction is being replaced and Stitch is a one-off design-generation tool, not a runtime dependency.
- **Fix:** Rotate it in the Stitch/Google console for hygiene, but since no shipped code path reads it, consider removing STITCH_API_KEY from .env.local once the design pass is done so it isn't a standing secret with no runtime owner.

### NF24 (from B12) — [P2] OPEN — PRODUCT-BRIEF §6 OUT list still lists "Gmail send-as" as out-of-scope, contradicting shipped OAuth send
- **Evidence:** docs/PRODUCT-BRIEF.md:39 OUT (phase 2+) list includes "Gmail send-as" as deferred, but lib/outbound/gmail.ts sendGmail() + the MailboxConnection model (prisma/schema.prisma:515) ship live own-mailbox Gmail sending (ROADMAP.md:106 marks 10.5 done June 13).
- **Fix:** Remove "Gmail send-as" from the PRODUCT-BRIEF.md:39 OUT list (it is now IN, via the sales agent), or annotate it as superseded by ADR-004 Phase 10.5.

### NF25 (from B12) — [P2] OPEN — CLAUDE.md/ADR-004 imply Microsoft (Outlook) OAuth is built, but only Google is implemented
- **Evidence:** ADR-004:35 and ROADMAP.md:106 say "Gmail/Microsoft OAuth" / "Gmail/Outlook", and onboarding-wizard.tsx references Outlook, but only lib/oauth/google.ts and lib/outbound/gmail.ts exist — no Microsoft/Graph OAuth client or send transport is present in lib/. MailboxProvider enum defaults to GOOGLE.
- **Fix:** Verify whether Microsoft mailbox connect is actually wired; if not, qualify the docs to say "Gmail at 10.5; Microsoft/Outlook deferred" so the onboarding copy doesn't promise an Outlook connect flow that 404s or no-ops.

### NF26 (from B2) — [P2] OPEN — Duplicate stale source files shipped in repo ("... 2.ts")
- **Evidence:** Sibling copies exist for live source/tests: lib/outbound/gmail 2.ts (duplicate of lib/outbound/gmail.ts) and tests/send-venue-pitch.test 2.ts (duplicate of tests/send-venue-pitch.test.ts). These look like editor/Finder copy artifacts. They can drift from the canonical files and cause confusing double test runs or accidental edits to the wrong file.
- **Fix:** Delete lib/outbound/gmail 2.ts and tests/send-venue-pitch.test 2.ts (verify they are byte-identical or stale duplicates first). Add a lint/CI guard against filenames containing " 2.".

### NF27 (from B2) — [P2] OPEN — sendVenuePitch SENDING residual-window has no reaper (acknowledged TODO)
- **Evidence:** app/actions/venues.ts:369-378 documents that if the process dies after a successful Gmail send but before the SENDING→SENT write, the pitch is stuck SENDING forever; the idempotency guard (line 266) then refuses resend (safe direction), but there is no sweep to recover. Comment: 'TODO(reaper): sweep pitches SENDING > N minutes → surface for manual review.'
- **Fix:** Add a small cron sweep (mirroring the sequence engine's expire pass) that flags VenuePitch rows in SENDING older than N minutes for manual review, so genuinely-delivered pitches don't silently stall the venue at PITCH_DRAFTED.

### NF28 (from B3) — [P1] OPEN — Clerk guard silently disabled when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing in prod
- **Evidence:** proxy.ts lines 19-29: clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; when falsy, proxy() returns NextResponse.next() — every protected route (/dashboard,/onboarding,/api/oauth) goes fully public with zero error. A prod deploy missing/typoing this env var opens all tenant routes silently, and lib/tenant falls back to the demo business.
- **Fix:** In proxy.ts (or instrumentation.ts startup), throw/refuse to boot if NODE_ENV==='production' and the Clerk publishable key is absent, so a misconfigured prod can never run in the public single-tenant fallback. The dev-fallback branch should be gated on NODE_ENV!=='production'.

### NF29 (from B3) — [P2] OPEN — Duplicate ' 2.ts' test/build files from cloud-sync conflicts pollute the tree
- **Evidence:** tests/ contains conflict-copy duplicates e.g. tests/oauth-google-routes.test 2.ts, tests/gmail-send.test 2.ts, tests/mailbox-crypto.test 2.ts; .next/server also has 'edge 2' and 'middleware 2'. These can run stale duplicate tests or mask drift.
- **Fix:** Delete the ' 2.ts'/' 2' conflict copies under tests/ and ensure .next is gitignored; add a lint/CI guard that fails on filenames matching / \d+\.(ts|js)$/ in tests/.

### NF30 (from B4) — [P2] OPEN — Inline comment instructs operators to put the secret in the webhook URL
- **Evidence:** app/api/inbound/route.ts:21 comment: "set the same value in the Postmark webhook URL ?secret=..." documents and perpetuates the leak vector; must be updated when auth moves to a header so operators don't re-introduce the query-param secret.
- **Fix:** Update the comment to describe header-based auth once call sites are migrated.

### NF31 (from B4) — [P2] FOUNDER — Single CRON_SECRET shared across all 4 cron endpoints, no per-route scoping
- **Evidence:** All four cron routes (sequences, discovery, margin-guardrail, weekly-report) gate on the same process.env.CRON_SECRET; one leaked URL exposes every cron endpoint, widening blast radius alongside the query-param transport.
- **Fix:** Acceptable for MVP; after moving to header auth, rotate CRON_SECRET on a schedule. Per-route secrets are optional.

### NF32 (from B5) — [P2] OPEN — Stale duplicate sources diverge from canonical (not just dead copies)
- **Evidence:** 'lib/oauth/google 2.ts' and 'components/mailbox-card 2.tsx' DIFFER from their canonical siblings; google 2.ts is missing the exported appUrl() and the Render-proxy absolute-redirect fix present in lib/oauth/google.ts. These stale copies are a maintenance trap if anyone edits the wrong file.
- **Fix:** Delete as part of B5 cleanup; the divergence confirms they are obsolete, not safety mirrors.

### NF33 (from B5) — [P2] OPEN — .gitignore has no guard against macOS '* 2.*' sync-duplicate artifacts
- **Evidence:** .gitignore covers .DS_Store and env files but nothing prevents Finder/iCloud ' 2' duplicates from being re-committed; all 11 dups landed together in commit 44b0a53, indicating an accidental bulk add.
- **Fix:** Add an ignore rule (e.g. '* 2.*' and '* 2') and consider a pre-commit check so this class of file cannot reappear.

### NF34 (from B6) — [P1] FOUNDER — Scraped venue-contact PII has no provenance-based deletion or retention limit
- **Evidence:** lib/discovery/contacts.ts:1-15 scrapes literal emails from venue websites and stores them (contactSource provenance), and MarketingContact/Venue rows persist indefinitely. There is no retention TTL and no path to delete a scraped person's data on request — directly compounds the B6 GDPR/erasure gap for the data Bright Ears collects without notice.
- **Fix:** Add a retention window + cron purge for scraped contacts that never converted, and a deletion endpoint keyed on email so a venue/person can be erased and suppressed (extend OutreachSuppression to cover scraped contacts, not just opted-out leads).

### NF35 (from B6) — [P2] FOUNDER — Opt-out marks lead DEAD but does not erase or redact lead PII
- **Evidence:** app/api/optout/route.ts:12-21 sets optedOut/status=DEAD/deadAt and stops sequences, but the lead's name/email/message content remain stored in full. An opt-out under GDPR/PECR is often coupled with an erasure/objection right; today the personal data is retained with only a flag.
- **Fix:** On opt-out, additionally suppress and offer/perform redaction of free-text PII after a short grace period, or document in the privacy policy why the record is retained (suppression-list lawful basis) — decide retention vs erasure with legal.

### NF36 (from B7) — [P2] FOUNDER — Stripe price catalog sets no tax_behavior (inclusive/exclusive ambiguity)
- **Evidence:** scripts/stripe-setup.ts:34-40 creates prices with unit_amount/currency/recurring but no tax_behavior field, so once Stripe Tax is enabled, VAT handling on the $25/$79/$149 prices is undefined (inclusive vs added on top).
- **Fix:** Set tax_behavior explicitly (e.g. "exclusive") on each price and decide whether displayed USD prices include or exclude VAT before going live — a founder pricing/legal call.

### NF37 (from B7) — [P2] OPEN — appUrl() falls back to http://localhost:3057 for Stripe success/cancel URLs
- **Evidence:** app/actions/billing.ts:9-11 returns process.env.APP_URL ?? "http://localhost:3057", and lines 32-33 use it to build success_url/cancel_url for live Stripe checkout. If APP_URL is unset in production, paying customers are redirected to localhost after checkout.
- **Fix:** Fail-closed in production: throw when APP_URL is unset and NODE_ENV==="production" instead of using the localhost fallback. Safe to apply in code.

### NF38 (from B8) — [P1] FOUNDER — Live Clerk secret + many other live secrets are committed in plaintext to .env.local (Postmark token, OpenRouter key, Stripe test secret + webhook secret, Stitch/Serper keys, TOKEN_ENCRYPTION_KEY)
- **Evidence:** .env.local holds real secrets in plaintext: CLERK_SECRET_KEY=sk_test_... (line 30), POSTMARK_SERVER_TOKEN=c1e207e5-... (line 24), OPENROUTER_API_KEY=sk-or-v1-... (line 2), STRIPE_SECRET_KEY=sk_test_51RV2SN... (line 37), STRIPE_WEBHOOK_SECRET=whsec_... (line 40), STITCH_API_KEY / SERPER_API_KEY (lines 43-44), TOKEN_ENCRYPTION_KEY=a59e61... (line 56). .gitignore line 'env files' ignores .env* so they are likely untracked, BUT these are live working credentials sitting on disk and were exposed to this audit; if .env.local was ever force-added or shared they are compromised.
- **Fix:** Confirm .env.local has never been committed (git log --all -- .env.local). Even dev keys for live-tier services (Postmark prod server token, OpenRouter, Stitch, Serper) and the AES TOKEN_ENCRYPTION_KEY should be rotated before launch and stored only in Render env, never in repo. Treat the Stripe test secret + webhook secret as needing rotation when moving to live mode.

### NF39 (from B8) — [P2] OPEN — Duplicate stray file 'lib/outbound/gmail 2.ts' (likely an editor/Finder copy) shipped in the repo
- **Evidence:** grep surfaced both lib/outbound/gmail.ts:108 and lib/outbound/gmail 2.ts:108 with identical content ('Basic shape: local@domain ...'). The ' 2.ts' filename is a macOS duplicate artifact, not an intentional module.
- **Fix:** Delete lib/outbound/gmail 2.ts (and scan for other ' 2.' duplicates) so a stale copy can't be imported or drift from the real gmail.ts. Safe auto-fix once confirmed it is unreferenced.

### NF40 (from B9) — [P2] OPEN — Stale shadow copy 'lib/oauth/google 2.ts' has drifted from the live file (appUrl no longer exported)
- **Evidence:** diff lib/oauth/google.ts 'lib/oauth/google 2.ts' shows the shadow defines appUrl() as a private (non-exported) function while the live file exports it; the start/callback routes import { appUrl } from "@/lib/oauth/google". The shadow is an older copy and is not imported anywhere (resolution hits google.ts), so it is inert today, but if ever swapped in it would break the routes. 14 such ' 2.*' shadow files exist in the repo (also 'lib/crypto/tokens 2.ts' and 'lib/outbound/gmail 2.ts', currently identical).
- **Fix:** Delete the ' 2.*' shadow duplicates (e.g. 'lib/oauth/google 2.ts', 'lib/crypto/tokens 2.ts', 'lib/outbound/gmail 2.ts' and the 11 others) — they appear to be macOS file-copy artifacts that create drift/confusion risk and could be accidentally imported or restored.

### NF41 (from C1) — [P1] OPEN — ENGAGED leads with no pending draft cannot be replied to from the UI either
- **Evidence:** When a client writes back, lib/inbound/pipeline.ts (lines 50-74) sets the lead to ENGAGED, stops the sequence, and never calls generateDraftForLead. lib/sequences/engine.ts treats ENGAGED as a hard-stop (line 94) and the redraft sweep only covers NEW/DRAFTED (line 41-45). So an ENGAGED lead has no PENDING draft, and the lead detail page (app/dashboard/leads/[id]/page.tsx line 165) renders no reply UI at all — the owner can read the client's reply but has no in-app way to compose/approve a response to continue the conversation.
- **Fix:** On the lead detail page add a manual 'Draft a reply' / compose action for ENGAGED (and other non-terminal) leads that triggers generateDraftForLead or opens a free-compose box wired to a send action, so an active conversation isn't a dead end.

### NF42 (from C1) — [P2] FOUNDER — Onboarding step 5 lead address is shown but no Postmark inbound route is provisioned for it
- **Evidence:** components/onboarding-wizard.tsx line 913 builds leadAddress = `leads@${business.slug}.in.brightears.io` and instructs the owner to forward mail there; app/api/inbound/route.ts requires INBOUND_WEBHOOK_SECRET and a configured Postmark inbound webhook + MX for *.in.brightears.io. Per CLAUDE.md founder gates, Postmark/Mailgun account and DNS for in.brightears.io are unprovisioned, so the 'Prove it works' verifier (polls /api/onboarding/verify every 5s) will never flip to detected in production until those exist — a confusing forever-listening state.
- **Fix:** Gate or annotate step 5 until inbound MX/webhook is live, or add a timeout fallback message after N seconds of no detection so the owner isn't stuck on an infinite 'Listening for your first lead…' spinner. Founder must provision Postmark + DNS (existing gate).

### NF43 (from C2) — [P2] OPEN — VenueStatus QUALIFIED is dead — venues never promoted past DISCOVERED
- **Evidence:** scoreVenue in lib/discovery/ingest.ts sets fitScore on create/update but leaves status at the schema default DISCOVERED; no code anywhere assigns QUALIFIED (grep of lib/app/scripts shows it only in WHERE-clause filters, never as a write). The schema documents QUALIFIED as 'scored + fit — eligible for pitching' but the scan never sets it, so the distinction the feed/draft guards check for is meaningless.
- **Fix:** Either set status to QUALIFIED in ingest when score.fitScore clears a fit threshold, or remove QUALIFIED from the enum and the WHERE filters to avoid implying a qualification step that doesn't run.

### NF44 (from C2) — [P2] OPEN — Optimistic 'Sent' on the pitch card can mask a real send failure path / leave a SENDING-stuck pitch invisible
- **Evidence:** components/venue-pitch-review.tsx line 249: `if (result.ok) setSentAt(new Date())` flips the card to a permanent 'Sent' badge optimistically. sendVenuePitch documents a RESIDUAL WINDOW where a pitch can be stuck in SENDING after a delivered-but-unrecorded send (app/actions/venues.ts lines 369-378, 'TODO(reaper)'). With no venue surface post-PITCH_DRAFTED and no reaper, a SENDING-stuck or APPROVED-after-revert pitch has no place to be seen or retried by the owner.
- **Fix:** Build the deferred SENDING reaper (sweep pitches SENDING > N minutes for manual review) and surface SENDING/stuck pitches in the venue-outreach view from finding (1).

### NF45 (from C3) — [P2] OPEN — Stripe checkout/portal server actions have no error UI — thrown errors surface as a raw Next error page
- **Evidence:** startCheckout/openBillingPortal (app/actions/billing.ts:14-51) throw plain Errors ('Billing not configured yet', 'Price for ... not found', 'No subscription yet') and the plan-card / Manage-billing <form action=...> in app/dashboard/settings/page.tsx:39,57-78 have no useActionState/error boundary, unlike SettingsForm which shows state.error. A thrown error becomes an unstyled error page mid-flow.
- **Fix:** Wrap these actions in a client form with useActionState (mirror components/settings-form.tsx) or add an error.tsx for the settings route so a failed checkout/portal launch shows a friendly inline message instead of crashing.

### NF46 (from C3) — [P2] OPEN — At-cap upsell push deep-links to /dashboard/settings but settings has no usage/cap context
- **Evidence:** pipeline.ts:165 sets url: "/dashboard/settings" for the 'Lead cap reached' push, but app/dashboard/settings/page.tsx never reads meterState, so the owner arrives at a page that shows plan cards with no indication of how many leads they have used or that drafting is paused.
- **Fix:** Same fix as gap #2 — render the meter/at-cap banner on the settings BillingCard so the push destination actually explains the situation.

### NF47 (from C4) — [P2] OPEN — Opt-out success page is unbranded raw HTML (white-label/trust gap)
- **Evidence:** app/api/optout/route.ts:23-26 returns inline `<html><body style='font-family:sans-serif...'>You're unsubscribed.</body>` — no Bright Ears/tenant branding, no styling consistency with the app. The opt-out is a client-facing surface (CLAUDE.md rule 7 white-label invariant) yet renders a bare default-font page.
- **Fix:** Render the unsubscribe confirmation via a styled, tenant-business-named page (business name only, never 'AI'/'Bright Ears' per white-label rule) so the recipient sees a trustworthy, on-brand confirmation rather than raw sans-serif HTML.

### NF48 (from C4) — [P2] FOUNDER — complianceFooter is only appended to follow-ups, so the FIRST reply carries no opt-out link
- **Evidence:** app/actions/drafts.ts:40-42 appends complianceFooter only when `draft.isFollowUp`. The initial reply (a solicited response to an inquiry) has no opt-out link. CLAUDE.md rule 5 says 'Every sequence email carries an opt-out' — the first reply is arguably outside sequences, so this may be intentional, but worth a founder/compliance confirmation since the footer text ('you inquired with…') would read fine on the first reply too.
- **Fix:** Confirm with founder/legal whether the solicited first reply needs an opt-out footer in each jurisdiction (CAN-SPAM exempts transactional/solicited replies; PECR/CASL nuances differ). If yes, append the footer on all outbound, not just follow-ups.

### NF49 (from C5) — [P2] OPEN — White-on-cyan would fail contrast (2.28:1) — design system flags it but code is currently safe
- **Evidence:** components/ui.tsx:68 buttonStyles.primary correctly uses text-ink-stage on bg-brand-cyan (7.88:1). The DESIGN.md / ui.tsx comments warn 'white-on-cyan fails contrast'; no current call site puts white text on cyan. Adversarial check: this is a latent trap, not a live bug — guard it in review so a future cyan button doesn't ship white text.
- **Fix:** Leave as-is but keep the ui.tsx comment; consider a lint/snapshot guard so no future white-on-cyan combo ships.

### NF50 (from C5) — [P2] OPEN — Onboarding wizard renders emoji/✓ in UI chrome vs DESIGN.md 'NO EMOJI IN UI. EVER.'
- **Evidence:** components/onboarding-wizard.tsx — step-progress '✓' (line 988, self-described 'typographic ✓'), package-list '✓' (351), saved-dates '✓' (620), and the lead-caught celebration strings 'First lead caught ✓' / 'Now playing — your reply' (831-832). The '🎉' at line 519 is inside a textarea placeholder (sample email copy) — sanctioned by the rule's email-warmth exception. The ✓ marks are borderline (typographic glyph, mostly aria-hidden) rather than clear violations.
- **Fix:** Optional polish: replace the standalone ✓ chrome marks with the sanctioned cyan-square/Kicker mark or a stroked SVG check (as pricing/page.tsx CheckIcon already does) to fully honor the no-emoji law; the placeholder 🎉 can stay.

### NF51 (from D1) — [P1] OPEN — 11 committed "* 2" macOS copy-conflict duplicate files (incl. duplicate Prisma migration + oauth source)
- **Evidence:** git ls-files shows 11 tracked duplicates: lib/oauth/google 2.ts, lib/oauth/state 2.ts, lib/crypto/tokens 2.ts, lib/outbound/gmail 2.ts, components/mailbox-card 2.tsx, 4 tests/*.test 2.ts, and prisma/migrations/.../migration 2.sql (x2). These are byte-for-byte sync-conflict copies; several trip lint warnings (e.g. tests/gmail-send.test 2.ts, lib/outbound/gmail 2.ts:95). The two `migration 2.sql` are unexpected copies sitting inside real migration directories.
- **Fix:** git rm all 11 "* 2" files; add a .gitignore rule for "* 2.*" if iCloud/Finder keeps generating them. Verify lib/oauth/google.ts (canonical) is the one imported. Confirm Prisma ignores migration 2.sql (it reads only migration.sql per dir, so migrations should still apply) but remove to avoid confusion/audit drift.

### NF52 (from D2) — [P2] OPEN — compare/[slug] marketing route still renders in abandoned v1 pastel palette
- **Evidence:** app/(marketing)/compare/[slug]/page.tsx is the ONLY file referencing deep-teal/soft-lavender/warm-peach/off-white/bare-ink (~25 className hits, e.g. lines 33-35, 79, 92, 271 'bg-gradient-to-br from-brand-cyan-soft via-white to-soft-lavender/30'). DESIGN.md v2.1 Don'ts forbid 'pastel gradients-on-white (the failed v1)'. It is a live competitor-comparison route, so real visitors see an off-brand v1 page inconsistent with the v2 ink/cyan/magenta site.
- **Fix:** Reskin this page to v2 Neon Collage (ink canvas, white data cards, cyan interactive, magenta/orange accents, mono kickers) matching the sibling app/(marketing)/compare/page.tsx which already uses v2 tokens; that unblocks removing all legacy tokens.

### NF53 (from D2) — [P2] OPEN — 9 git-tracked Finder-duplicate '* 2' files committed into the repo
- **Evidence:** git ls-files shows components/mailbox-card 2.tsx, lib/crypto/tokens 2.ts, lib/oauth/google 2.ts, lib/oauth/state 2.ts, lib/outbound/gmail 2.ts, and tests/{gmail-send,mailbox-crypto,oauth-google-routes,send-venue-pitch}.test 2.ts. All four test copies are byte-identical to their originals (diff IDENTICAL); the source copies are never imported. They entered around commit 44b0a53. Risk: stale clones diverge silently from originals and confuse future edits/greps.
- **Fix:** git rm all 9 files in a single cleanup commit; add a .gitignore guard or pre-commit check for '* 2.*' filename pattern to stop Finder duplicates being committed again.

### NF54 (from D3) — [P2] OPEN — Serper search-API spend is excluded from the 70% margin guardrail
- **Evidence:** lib/billing/margin.ts computeMargins() only sums LlmUsage token cost (MODEL_PRICING) per tenant. Discovery's Serper queries are a paid external API (SERPER_API_KEY set in .env.local) tracked only as a count — lib/discovery/scan.ts:118-119 returns result.serperQueries, but that number is never priced or written anywhere computeMargins reads. So a tenant running heavy discovery scans erodes real gross margin invisibly to the guardrail; the 70% alert can read 'healthy' while true margin is below floor.
- **Fix:** Either persist priced Serper cost into a cost ledger and add it to computeMargins (e.g. a per-tenant DiscoveryUsage row with query count * Serper unit price, summed alongside llmCostUsd), or document explicitly that discovery cost is out-of-scope for the margin lens. Code-level fix; Serper's per-query price is public.

### NF55 (from D3) — [P2] FOUNDER — Margin alert is a silent no-op because OPS_ALERT_EMAIL is unset
- **Evidence:** app/api/cron/margin-guardrail/route.ts:17 gates the alert on `if (flagged.length && process.env.OPS_ALERT_EMAIL)`. OPS_ALERT_EMAIL is NOT present in .env.local (grep count 0). The cron computes flagged tenants and returns them in JSON but sends no alert when the env var is missing — so the 'Alert if margin < 70%' half of CLAUDE.md rule 8 currently delivers nothing to anyone until that var is set on the deploy.
- **Fix:** Set OPS_ALERT_EMAIL in the deploy env (and .env.local for parity), and consider a startup/health check that warns when the guardrail cron has no alert destination so a missing var can't silently disable the only outbound signal.


---

## FOUNDER DECISIONS

_Each needs your call (money, legal exposure, brand voice, credentials, real data). Where safe, an interim auto-fix is already applied (noted). Decide, then I (or you) finalize._

### FD1 · A1 (P0) — The "if it doesn't pay for itself in your first season, full refund" guarantee is live in 6 user-facing code locations (and is even publishe
**My recommendation:** FOUNDER must choose the actual policy; an agent should not unilaterally set refund terms. Interim safest fix an agent CAN apply now: replace all 6 strings with an unconditional, time-boxed, any-reason promise — "Full refund within 30 days, no questions asked" (drop "pays for itself"/"season" entirely) — and ALSO remove the unverifiable claim from the JSON-LD path (do not ship a refund promise in faqJsonLd structured data until policy is final). Single-source the wording (one exported constant in lib/marketing) so pricing/page.tsx, comparisons.ts overage + HUB_FAQS all reference it. Create a /r
**Why your call:** money/legal exposure — sets a refund obligation

### FD2 · A2 (P0) — Confirmed: the landing STATS strip, marquee, metadata, and several other marketing pages present "<5 min median first reply", "ANSWERED IN 4
**My recommendation:** Reframe every measured-sounding claim as either a product promise/target or an attributed external industry stat — never as Bright Ears' own measured result, since none exist pre-launch. Concrete edits: (1) page.tsx STATS — change "median first reply" to a target ("<5 min target first reply") or relabel the section heading from "The stakes" to something forward-looking; make "$1,800" clearly illustrative (e.g. "$1,800 example booking"). (2) "~50% of couples book the first responder" and "a third of vendors never reply" are external claims — cite a source inline/footnote or soften to "couples o
**Why your call:** needs real data/sources you must supply or approve

### FD3 · A4 (P1) — Absolute/superlative copy is pervasive across user-facing marketing pages — the literal "EVERY LEAD. EVERY TIME." hero marquee plus dozens o
**My recommendation:** Soften unqualified absolutes to defensible, hedged claims wherever the absolute is a performance/coverage promise rather than a product invariant. Concrete edits: (1) Hero marquee page.tsx:38 — change "EVERY LEAD. EVERY TIME." to a hedged variant like "REAL LEADS. EVERY DAY." or "DRAFTED IN MINUTES." (2) The "in under 5 minutes" / "answered in minutes" claims (page.tsx:27,148; templates:660) — qualify as "typically" / "median <5 min" to match the hedged STATS already on the page (page.tsx:42 "<5 min median first reply"). (3) tool-reply-generator.tsx:215 "25 proven" — drop "proven" (unsubstanti
**Why your call:** money/legal exposure — sets a refund obligation

### FD4 · B10 (P1) — short summary
**My recommendation:** Add a rate-limit helper for inbound, onboarding-verify, optout; add reportError. Founder: backups, restore drill, uptime monitor, Sentry.
**Why your call:** business decision

### FD5 · B11 (P2) — The finding holds: .env* is correctly gitignored and untracked, but the project uses ~10 live secrets (one — the Render API key — is explici
**My recommendation:** Hand the founder this rotate-list (true secrets only; each name → where it is read). Confirmed gitignored/untracked: `git ls-files | grep env` returns nothing and `git check-ignore .env .env.local` matches `.gitignore:34 .env*`. TRUE SECRETS TO ROTATE (env name → read location in repo): (1) OPENROUTER_API_KEY → lib/llm/index.ts:32, lib/inbound/triage.ts:76. (2) SERPER_API_KEY → lib/discovery/serper.ts:362, lib/discovery/provider.ts:157, lib/discovery/contacts.ts:176, scripts/scan-venues.ts:32. (3) TOKEN_ENCRYPTION_KEY → lib/crypto/tokens.ts:29 (NOTE: rotating this invalidates all stored Gmail 
**Why your call:** credentials / account / paid-service decision only you can make

### FD6 · B2 (P0) — Lead-cap metering genuinely pauses drafting at both the webhook and cron paths (the pricing promise holds), but proactive venue PITCHES run 
**My recommendation:** Keep the lead-cap enforcement as-is — it correctly holds. Resolve the proactive-vs-lead reconciliation explicitly. Recommended: (a) make a founder pricing decision on whether proactive pitches consume the plan lead allowance or are a separate gated line item; then (b) implement it. If pitches should count toward the plan: add a meterState/overCap check inside draftVenuePitch (app/actions/venues.ts, before generateVenuePitch at line 153) and gate sendVenuePitch the same way, OR fold a VenuePitch monthly count into leadsUsedThisMonth (lib/billing/metering.ts:20). If proactive is intentionally a 
**Why your call:** needs real data/sources you must supply or approve

### FD7 · B6 (P0) — No legal pages of any kind exist — no privacy policy, terms, DPA, cookie/consent, no LIA, and no data-retention/deletion or DSAR path — whil
**My recommendation:** Draft and wire four static legal routes under app/(marketing): /privacy, /terms, /cookies, /dpa, plus add these links to the marketing footer (layout.tsx NAV/footer) and app/sitemap.ts. Add a cookie/consent banner (Clerk sets cookies; PECR/ePrivacy require consent) gating any non-essential cookies. Write a documented Legitimate Interest Assessment for the cold venue outreach + contact-scraping in lib/discovery/contacts.ts and reference it in the privacy policy (state Bright Ears = processor for artists' leads, and identify the lawful basis + data source for scraped venue contacts). Build a rea
**Why your call:** needs real data/sources you must supply or approve

### FD8 · B7 (P1) — All three sub-claims hold: the Stripe client is initialized with no pinned apiVersion, and the subscription checkout session enables neither
**My recommendation:** 1) Pin the API version explicitly in lib/billing/stripe.ts: new Stripe(key, { apiVersion: \"<dashboard version>\" }) (stripe-node v22.2.0 is installed) so an SDK bump cannot silently change the API contract. 2) In app/actions/billing.ts checkout.sessions.create add automatic_tax: { enabled: true }, billing_address_collection: \"required\", tax_id_collection: { enabled: true }, and customer_update: { address: \"auto\", name: \"auto\" } (needed because an existing customer is reused) so Stripe captures and stores the billing country/address used to determine UK VAT and EU VAT/OSS. 3) Prerequisit
**Why your call:** credentials / account / paid-service decision only you can make

### FD9 · B8 (P1) — Confirmed: Clerk runs as a Development instance (pk_test/sk_test, dev *.accounts.dev Frontend API, no custom domain) — production cutover re
**My recommendation:** No code change is required; the env-driven config (bare ClerkProvider reading NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/CLERK_SECRET_KEY) is correct and portable. Document and execute the founder-gated cutover before Phase 8 apex-domain switch. Cutover steps: (1) In the Clerk Dashboard, create a Production instance for the Bright Ears SaaS app (Clerk does NOT copy Development settings to Production — every setting must be re-entered: sign-in/up options, social connections, JWT templates, webhooks, allowed redirect origins, email/SMS templates, session/MFA settings). (2) Set the production Frontend API
**Why your call:** credentials / account / paid-service decision only you can make

### FD10 · B9 (P1) — The technical claims (gmail.send restricted scope is used; refresh/persist works; tokens are AES-256-GCM at rest) are all CONFIRMED and corr
**My recommendation:** No crypto/refresh fix is needed — that implementation is correct (AES-256-GCM, random IV, GCM auth tag, ciphertext-only columns, refresh-on-skew with re-encrypt-and-persist, scope audit on callback). The open item is operational: while the Google OAuth app is in testing mode it hard-caps at 100 test users, and public listing requires CASA Tier 2 (~$500-$4500, 2-6 months, annual). Two concrete steps: (1) FOUNDER must run Google verification/CASA submission before opening Gmail-connect beyond ~100 hand-added test users (longest lead time — start now; already documented as deferred in ROADMAP.md:
**Why your call:** credentials / account / paid-service decision only you can make

### FD11 · C2 (P1) — The core profile→license→draft→approve→send/copy path works end-to-end and is well-guarded, but the journey breaks at both bookends: there i
**My recommendation:** Treat as two fixes. (1) Post-send dead-end (the bigger gap): add a venue-outreach surface (e.g. a "Sent / In conversation" rail or /dashboard/venues page) querying VenueStatus PITCHED/REPLIED/IN_CONVERSATION/BOOKED/DEAD with manual status controls, so a SENT pitch is trackable; until venue-reply capture (gmail.send is send-only, no read scope) and the FOUND→PITCHED→pipeline bridge are built, at minimum let the owner manually mark a PITCHED venue REPLIED/BOOKED/DEAD. (2) Scan triggering: add the cron schedule to the deploy config (no render.yaml/vercel.json exists) and/or expose an owner-facing
**Why your call:** needs real data/sources you must supply or approve

### FD12 · C3 (P1) — The core billing chain (auto trial → Stripe checkout → portal upgrade/downgrade/cancel, all webhook-synced) is wired end to end and works, b
**My recommendation:** 1) In app/dashboard/settings/page.tsx widen the searchParams type to include billing?: string and render a success toast/banner on ?billing=success and a soft notice on ?billing=cancelled (the redirect targets already exist in billing.ts:32-33 — only the consumer is missing). 2) Surface at-cap in the UI, not just via optional push: have the dashboard and/or BillingCard call meterState (lib/billing/metering.ts) and render a 'X/Y leads this month — drafting paused' banner with an upgrade/lead-pack CTA when overCap, so an owner with push disabled still sees it. 3) Decide and implement (or remove)
**Why your call:** needs real data/sources you must supply or approve

### Founder-owned adjacent findings

- **FD13** (from A1, P1) No refund-policy / terms page exists anywhere in the app — _rec:_ Add a /refund-policy (and likely /terms) route stating the exact refund window, method, and conditions, and link it from every guarantee mention. Founder must supply the real policy terms.
- **FD14** (from A2, P1) Pricing guarantee states 'full refund' as firm policy with no terms — _rec:_ Founder must define refund terms (what 'first season' means, eligibility, how to claim) and link a terms page, or soften the guarantee wording. Also verify the $1.67/lead internal cost and the $28–47 Bark figure are real.
- **FD15** (from A2, P1) 'About a third of vendors never reply' stated unsourced across multiple pages — _rec:_ Likely a real industry stat (WeddingWire/The Knot) but must be cited or softened. Add a source footnote or rephrase as a general observation.
- **FD16** (from A3, P0) Uncited quantitative stat claims on landing page ('~50% of couples book the first responder', '$1,800 the booking you stop losing', '<5 min median first reply') with no source or pre-launch-data disclaimer — _rec:_ Either cite each stat inline (source + date) or relabel as illustrative/target (e.g. 'designed to reply in under 5 minutes'); remove 'median first reply' framing until real tenant data exists. Founder must supply/approve any real numbers.
- **FD17** (from A3, P0) 'full refund' / 'pays for itself' guarantee copy shipped without a written refund policy — _rec:_ Founder must confirm the real refund policy and terms before this copy ships; engineering should link it to a written policy page. Do not auto-edit a money/legal promise.
- **FD18** (from A4, P1) Speed claims ("under 5 minutes") stated as absolutes vs hedged stat elsewhere on same page (P1) — _rec:_ Align prose to the hedged median framing ("in minutes" / "typically under 5 minutes") so marketing copy and the stat row agree. Safe copy edit, but verify the median number is real before publishing.
- **FD19** (from A4, P1) Refund/guarantee language appears in pricing copy and must match the real policy (P1) — _rec:_ Confirm the season-based full-refund guarantee and the never-overbill promise are policies the founder will actually honor and that billing enforces (CLAUDE.md states pause-at-cap is implemented). If the guarantee wording is final, keep; ot
- **FD20** (from A5, P2) Proactive Hunt/venue-pitch feature is shipped but undisclosed in all pricing and marketing copy — _rec:_ Founder decision: decide whether the Hunt is a launch feature, beta, or held back. If launching it, add a clearly-labeled, SEPARATE allowance line to pricing/marketing (e.g. 'Proactive outreach: up to ~18 venue pitches/day, separate from yo
- **FD21** (from A6, P2) No Terms of Service / billing-terms link on the Stripe checkout session — _rec:_ Add a Terms of Service / billing-terms page and link it from both the marketing CTAs and the checkout flow; enable Stripe consent_collection.terms_of_service:'required' with the ToS URL set in the Stripe dashboard so acceptance is captured 
- **FD22** (from A6, P2) Refund-guarantee copy ('full refund') has no backing policy mechanism or surfaced terms — _rec:_ Define and publish the refund policy (what 'first season' means, how to claim, timeframe) and link it from pricing + checkout; founder must confirm the actual policy before it is codified.
- **FD23** (from A7, P1) Founding-members plan trades a discount for reviews/case studies — incentivized-review disclosure needed before those go live — _rec:_ Before any founding-member review or case study is published on the marketing site, add a clear-and-conspicuous disclosure adjacent to it (e.g. "Founding member — received a discounted plan"). Add this as a standing requirement in MARKETING
- **FD24** (from A7, P2) Headline stat claims lack on-page substantiation ("~50% of couples book the first responder", "median first reply <5 min") — _rec:_ Add a source citation or qualifier for the market statistics (e.g. footnote linking the study), and frame "<5 min median first reply" as a target/capability rather than a measured outcome until real customer telemetry exists. This is adjace
- **FD25** (from B11, P2) Rotating TOKEN_ENCRYPTION_KEY will silently break all stored Gmail OAuth tokens (no re-encryption / re-auth path) — _rec:_ Before/at rotation: document that rotating TOKEN_ENCRYPTION_KEY requires connected mailboxes to re-authorize (re-run the Gmail OAuth start flow). Ideally add a decrypt-failure handler that flags the mailbox as 'reconnect required' instead o
- **FD26** (from B11, P2) STITCH_API_KEY stored in .env.local is dead weight in the app (only the MCP uses it) — confirm it's still needed at all — _rec:_ Rotate it in the Stitch/Google console for hygiene, but since no shipped code path reads it, consider removing STITCH_API_KEY from .env.local once the design pass is done so it isn't a standing secret with no runtime owner.
- **FD27** (from B4, P2) Single CRON_SECRET shared across all 4 cron endpoints, no per-route scoping — _rec:_ Acceptable for MVP; after moving to header auth, rotate CRON_SECRET on a schedule. Per-route secrets are optional.
- **FD28** (from B6, P1) Scraped venue-contact PII has no provenance-based deletion or retention limit — _rec:_ Add a retention window + cron purge for scraped contacts that never converted, and a deletion endpoint keyed on email so a venue/person can be erased and suppressed (extend OutreachSuppression to cover scraped contacts, not just opted-out l
- **FD29** (from B6, P2) Opt-out marks lead DEAD but does not erase or redact lead PII — _rec:_ On opt-out, additionally suppress and offer/perform redaction of free-text PII after a short grace period, or document in the privacy policy why the record is retained (suppression-list lawful basis) — decide retention vs erasure with legal
- **FD30** (from B7, P2) Stripe price catalog sets no tax_behavior (inclusive/exclusive ambiguity) — _rec:_ Set tax_behavior explicitly (e.g. "exclusive") on each price and decide whether displayed USD prices include or exclude VAT before going live — a founder pricing/legal call.
- **FD31** (from B8, P1) Live Clerk secret + many other live secrets are committed in plaintext to .env.local (Postmark token, OpenRouter key, Stripe test secret + webhook secret, Stitch/Serper keys, TOKEN_ENCRYPTION_KEY) — _rec:_ Confirm .env.local has never been committed (git log --all -- .env.local). Even dev keys for live-tier services (Postmark prod server token, OpenRouter, Stitch, Serper) and the AES TOKEN_ENCRYPTION_KEY should be rotated before launch and st
- **FD32** (from C1, P2) Onboarding step 5 lead address is shown but no Postmark inbound route is provisioned for it — _rec:_ Gate or annotate step 5 until inbound MX/webhook is live, or add a timeout fallback message after N seconds of no detection so the owner isn't stuck on an infinite 'Listening for your first lead…' spinner. Founder must provision Postmark + 
- **FD33** (from C4, P2) complianceFooter is only appended to follow-ups, so the FIRST reply carries no opt-out link — _rec:_ Confirm with founder/legal whether the solicited first reply needs an opt-out footer in each jurisdiction (CAN-SPAM exempts transactional/solicited replies; PECR/CASL nuances differ). If yes, append the footer on all outbound, not just foll
- **FD34** (from D3, P2) Margin alert is a silent no-op because OPS_ALERT_EMAIL is unset — _rec:_ Set OPS_ALERT_EMAIL in the deploy env (and .env.local for parity), and consider a startup/health check that warns when the guardrail cron has no alert destination so a missing var can't silently disable the only outbound signal.
