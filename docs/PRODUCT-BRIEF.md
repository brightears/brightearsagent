# Bright Ears SaaS — Product Brief (canonical)

**Date:** June 10, 2026 · Supersedes `../../PRODUCT-BRIEF-GIGSORTED.md` (pre-decision draft). Research basis: 11-agent workflow `wf_fb02d04c-d1d`; raw output path in Appendix.
**Founder decisions locked in:** brand = **Bright Ears** on brightears.io (no new domain); entry price $25/mo with usage tiers; no personal founder name — "we've been there" experience voice + the Vinyl story; design = colorful/fun on a light base (reference royalstreaming.com) — SUPERSEDED June 11 by the dark "Neon Collage" direction, see §8 and `docs/DESIGN.md` v2.1; old agency app moves to `agency.brightears.io` at cutover so Vinyl never stops.

## 1. One-sentence pitch

**The AI office that answers every event inquiry for your DJ/entertainment business — weddings, corporate, parties, residencies — in under 5 minutes, in your voice, with your real availability, follows up until the gig is booked, and proactively hunts new venues for you, while you approve everything from your phone.**

## 2. Who it's for

**The product serves every performer kind (founder decision 2026-07-07):** any bookable performer business — DJs, bands, singers, magicians, comedians, actors, dancers, photo booths, MCs. Engine, product copy and the Hunt's matching are kind-complete (per-kind query packs, kind-aware fit scoring and pitches); **DJ-first lives in marketing only.**
**Marketing wedge:** wedding/mobile/event DJ business owners, 1–5 people, US first then UK/AU/CA. They earn $1,000–3,000 per booked wedding, already pay $20–179/mo for software (DJ Event Planner, Vibo, Check Cherry), and do admin at night around gigs, day jobs, kids.
**NOT for:** club/scene DJs, venues, large agencies.

## 3. The validated pain (their words — use verbatim in copy)

- "Get an inquiry, immediately respond, and then nothing... 30 inquiries so far, maybe 5 have responded."
- "You don't want to be the 5th DJ that reaches out." / "Far more likely to book with the first person to close the deal."
- The customer-written spec: "I can't always text the lead within 5 minutes... I want to automate this. I've looked into DJ Intelligence, SMPL, and DJEP — none of them integrate with Zapier." (r/mobileDJ, Oct 2024)
- "Falling asleep with the laptop on." / "If there were two of me, I would double my business."
- Couples' side: 1/3 of vendors never respond; they book whoever replies first.
- AI attitude: owners happily use ChatGPT for replies; clients must never see it → **white-label + human approval is the design.**

## 4. Competitive position (June 2026, verified)

The wedge — DJ/performer-positioned + self-serve signup + email/form/directory lead ingestion + availability-aware personalized drafts + approve-from-phone + follow-up-until-booked-or-dead + white-label — **is unoccupied**. Mikla.ai proved the category for wedding *venues* ($149–499/mo, ~200 customers, demo-led, no self-serve); DJ incumbents (DJEP $20–50 — no API, no AI, 20-yr-old codebase; GigBuilder — "AI" writing utility, 2.5/5 Capterra; Vibo/Check Cherry — nothing on leads) left it open; HoneyBook's AI drafts only inside its own CRM and demands full migration; The Knot's auto-reply is a one-shot FAQ acknowledgment. Window estimate: 12–18 months. Built-in differentiators: spam/scam triage (The Knot leads are "95% spam" per vendor rage — we turn it into a feature), the verifiable Vinyl story, UK/AU completely unserved.
Main threats: The Knot shipping native AI replies (counter: own-website/Bark/UK/AU leads), HoneyBook bundling (counter: bolt-on positioning — "keep DJEP, add the AI office"), Mikla moving down-market (counter: self-serve + price + DJ logic).

## 5. Architecture — "email spine" (ToS-safe, no OAuth in the reactive path; the proactive agent's own-mailbox OAuth is ADR-004)

Per-tenant inbound parse address (`leads@{slug}.in.brightears.io`) + one-time forwarding rules catch ALL lead sources (plain email, website forms, The Knot/WW/Bark/GigSalad notification emails — parsing those is established practice: 17hats, Mailparser, Zapier templates). LLM parses + triages spam → drafts availability-aware reply in owner's voice (rate-card-bounded) → PWA push → owner approves/edits in ≤2 taps → sent from `mail.brightears.io`, From = business name, Reply-To = owner → client replies loop back via the forward → sequences (day 2/5/9 default) until booked/dead, hard-stops on reply/booked/dead/opt-out, country-correct compliance footers.
Adapters: Thumbtack Partner API (apply early — only marketplace officially sanctioning automated replies), Bark via official Zapier (budget caps), The Knot/WW deep-link nudge preserves their Quick Responder badge, GigSalad draft+deep-link only. Own-mailbox send (the *proactive* sales agent, ADR-004): the artist's own Gmail via native minimal-scope OAuth (`gmail.send` only) — **shipped** (ROADMAP 10.5), CASA review deferred to public launch; this superseded the earlier Unipile/Nylas plan, and no Microsoft/Outlook OAuth is built yet. Phase 2: FB Messenger/Instagram via Meta review.
Stack: Next.js 16 + Prisma 6.19 + Postgres, OpenRouter + Vercel AI SDK (per-purpose model map: DeepSeek V4 Flash for parse/triage, V4 Pro for drafts; eval harness decides final picks — per-lead LLM cost <1¢), Postmark/Mailgun, Clerk, Stripe, PWA. Deploys to its OWN Render service; never touches the live agency stack.

## 6. MVP scope

**IN:** self-serve signup, subscribe-to-activate (no automatic free trial — see §7; cancel anytime; no money-back guarantee), onboarding wizard (profile, packages, voice samples, forwarding walkthrough, gig calendar), inbound parse + 4 source parsers + generic LLM parser, spam triage, draft engine + eval harness, approve-from-phone PWA, sequences, lead pipeline UI, weekly report email, the proactive Hunt (venue discovery → fit-scoring → pitch drafting → approve → own-mailbox send), Stripe with lead-metering, polymorphic PerformerKind.
**OUT (phase 2+):** quotes/contracts/e-sign + deposit links — this is the **v1.1 money path** scoped in `ADR-003-scope-vs-price.md` (quote builder → contract-lite e-sign → deposit via the DJ's OWN payment link, zero custody), gated on Gate 1 pass; until then `Business.bookingLinkUrl` carries the owner's existing booking/contract/deposit page in closing replies and nudges — payment chasing, client planning portal, IG/FB DMs, Gmail send-as *for the reactive spine* (the proactive sales agent already sends from the artist's own Gmail via OAuth, ADR-004), machine-readable booking endpoint (in the pocket — later each customer gets their own AI-readable booking endpoint; never a central marketplace), non-DJ marketing.

## 7. Pricing (founder-confirmed; tier recut per ADR-003)

**Subscribe to activate (founder decision 2026-06-16, SUPERSEDES the 2026-06-14 "14-day free trial" decision): Starter/Pro/Studio monthly, cancel anytime; NO automatic free trial; NO money-back guarantee** (single-sourced in `lib/marketing/guarantee.ts`; cancellation/billing terms in `/terms`). A free trial was gameable (sign up, grab gigs, churn, re-sign with a new email) and a guaranteed loss on un-vetted users. Instead, selected artists get a free first month via a **private Stripe PROMOTION CODE** the founder mints in the Stripe Dashboard and hands out — nothing about trials or codes appears on the site (`allow_promotion_codes: true` shows the code field on Stripe checkout). New tenants get plan=TRIAL meaning "free / not subscribed" and the agent is **paused** until they subscribe (`lib/billing/metering.ts: isAgentPaused = plan === "TRIAL"`); subscribing switches on drafting, venue pitching AND the discovery scan; `trialEndsAt` is vestigial. The unenforceable "pays for itself" claim stays removed for legal reasons. **Starter $25/mo** (15 inbound leads/mo, 1 performer, approve-every-send) → **Pro $79/mo** (60 inbound leads/mo, per-source auto-send autopilot) → **Studio $149/mo** (150 inbound leads/mo, multi-performer roster — shipped July 2026 P13: performer CRUD, per-performer availability, `rosterCap` 10 in `lib/billing/plan-features.ts`). **Tier recut (`ADR-003-scope-vs-price.md`, June 2026): every tier is the full-capability assistant** — replies, follow-up sequences until booked-or-dead, weekly report, spam triage, approve-from-phone, AND the proactive Hunt (venue-finding agent) in ALL tiers; tiers gate only capacity + autonomy (inbound leads, performers, auto-send, team), never capability. **Two SEPARATE allowances:** reactive inbound **leads** (metered per plan) and proactive **venue pitches** (shared across plans, gated by profile quality not tier — daily caps `lib/outreach/caps.ts`: HOT 10 / WARM 5 / SEED 3, ≤18/day). Success-fee rejected (ADR-003); per-gig economics live as framing instead (one saved example $1,800 gig = 6 years of Starter — illustrative; ~$1.32–1.67 per lead handled vs Bark's $28–47 per raw lead). At cap, pause drafting for the month + prompt upgrade — never surprise bills. (Audit C3 STRIKE 2026-06-15: the advertised "$10/10 lead pack" was softened out of all user-facing copy — pricing, comparisons, docs — because no purchase flow is built. A real buyable lead-pack top-up is a DEFERRED founder revenue option, not shipped.) Customers are metered in **leads** (they don't think in tokens); `LlmUsage` is our internal margin lens with a 70% gross-margin guardrail. Founding members: first 25 at $15/mo for year one ↔ review + case study. Positioning: against a $1,500–3,000 booked event (wedding, corporate, party, residency) and against DJEP as a *bolt-on*, not a switch.

## 8. Brand, voice, design

See CLAUDE.md "Brand, voice & design" and **`docs/DESIGN.md` v2.1 — dark "Neon Collage"** (the June-10 light-pastel reading of royalstreaming.com was wrong; founder-picked replacement June 11): ink canvas #17161f, cream/white content panels, cyan #00bbe4 as the product voice (everything you click), magenta→orange gradients as the show voice (headlines, celebration, marketing CTAs), mono sticker chips, reduced-motion safety. Experience voice without personal names ("We've been there — 20 years running entertainment for venues... so we built Vinyl for ourselves, and now this for you"), customers' verbatim language in headlines.

## 9. Go-to-market

Full engine in `MARKETING-PLAN.md`. Summary: agents produce the content/AEO/free-tool/prospect-list machine; founder does community presence (DJ Facebook groups under the Bright Ears identity), podcast guesting with the Vinyl story, association partnerships (USDJA/ADJA/NAME/NADJ/DJAA), and measured cold outreach (US norms allow it). Calendar anchors: DJX Atlantic City Aug 10–13; Wedding MBA Las Vegas Nov 17–19.

## 10. Gates

- **Gate 1 (launch + 90 days):** ≥10 paying businesses, ≥3 arms-length. Miss badly → reposition or kill. **Pass → unlock Money Path v1 per `ADR-003-scope-vs-price.md`** (quote → contract-lite e-sign → deposit via the DJ's own payment link, zero custody; ships to all tiers, ~2.5–4 weeks; its own success gate: ≥30% of active customers send a deposit request within 30 days).
- **Gate 2 (month 6):** signup→subscribed ≥25%; logo churn ≤5%/mo after first cohort; case-study-grade booked-gig numbers exist.
- **Target:** ฿150k/month profit ≈ ~50 customers at blended ~$85 — realistic 12–18 months post-launch if gates pass.

## Appendix
- Research raw output: `/private/tmp/claude-501/-Users-norbert-Documents-Projects-Bright-Ears/7a77bba6-81f7-4281-a99e-c517d38f7b82/tasks/w7b28c8re.output`
- Strategy background: `../../STRATEGY-RESEARCH-JUNE-2026.md`
