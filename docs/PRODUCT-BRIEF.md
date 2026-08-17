# Bright Ears SaaS — Product Brief (canonical)

**Date:** June 10, 2026 · Supersedes `../../PRODUCT-BRIEF-GIGSORTED.md` (pre-decision draft). Research basis: 11-agent workflow `wf_fb02d04c-d1d`; raw output path in Appendix.
**Founder decisions locked in:** brand = **Bright Ears** on brightears.io (no new domain); entry price $25/mo with usage tiers; no personal founder name — "we've been there" experience voice + the Vinyl story; design = colorful/fun on a light base (reference royalstreaming.com) — SUPERSEDED June 11 by the dark "Neon Collage" direction, see §8 and `docs/DESIGN.md` v2.1; old agency app moves to `agency.brightears.io` at cutover so Vinyl never stops.

## 1. One-sentence pitch

**The AI office that answers every event inquiry for your DJ/entertainment business — weddings, corporate, parties, residencies — in under 5 minutes, in your voice, with your real availability, follows up until the gig is booked, and proactively hunts new venues for you, while you approve everything from your phone.**

## 2. Who it's for

**The product serves every performer kind (founder decision 2026-07-07):** any bookable performer business — DJs, bands, singers, magicians, comedians, actors, dancers, photo booths, MCs. Engine, product copy and the Hunt's matching are kind-complete (per-kind query packs, kind-aware fit scoring and pitches); **DJ-first lives in marketing only.**
**Marketing wedge:** wedding/mobile/event DJ business owners, 1–5 people, with the US first. Expansion into Australia and other reviewed opt-out jurisdictions follows only after the target-country controls and legal review are approved. The UK and Canada are consent/lawful-basis handoff markets in the current rules engine, not automatic-send launch territories. These owners earn $1,000–3,000 per booked wedding, already pay $20–179/mo for software (DJ Event Planner, Vibo, Check Cherry), and do admin at night around gigs, day jobs, kids.
**NOT for:** club/scene DJs, venues, large agencies.

## 3. The validated pain (their words — use verbatim in copy)

- "Get an inquiry, immediately respond, and then nothing... 30 inquiries so far, maybe 5 have responded."
- "You don't want to be the 5th DJ that reaches out." / "Far more likely to book with the first person to close the deal."
- The customer-written spec: "I can't always text the lead within 5 minutes... I want to automate this. I've looked into DJ Intelligence, SMPL, and DJEP — none of them integrate with Zapier." (r/mobileDJ, Oct 2024)
- "Falling asleep with the laptop on." / "If there were two of me, I would double my business."
- Couples' side: 1/3 of vendors never respond; they book whoever replies first.
- AI attitude: owners happily use ChatGPT for replies; clients must never see it → **white-label + human approval is the design.**

## 4. Competitive position (June 2026, verified)

The wedge — DJ/performer-positioned + self-serve signup + email/form/directory lead ingestion + availability-aware personalized drafts + approve-from-phone + follow-up-until-booked-or-dead + white-label — **is unoccupied**. Mikla.ai proved the category for wedding *venues* ($149–499/mo, ~200 customers, demo-led, no self-serve); DJ incumbents (DJEP $20–50 — no API, no AI, 20-yr-old codebase; GigBuilder — "AI" writing utility, 2.5/5 Capterra; Vibo/Check Cherry — nothing on leads) left it open; HoneyBook's AI drafts only inside its own CRM and demands full migration; The Knot's auto-reply is a one-shot FAQ acknowledgment. Window estimate: 12–18 months. Built-in differentiators: spam/scam triage (The Knot leads are "95% spam" per vendor rage — we turn it into a feature), the verifiable Vinyl story, and underserved English-language markets. That market observation is not approval to target a country before the jurisdiction and privacy gates pass.
Main threats: The Knot shipping native AI replies (counter: own-website/Bark and approved-country leads), HoneyBook bundling (counter: bolt-on positioning — "keep DJEP, add the AI office"), Mikla moving down-market (counter: self-serve + price + DJ logic).

## 5. Architecture — "email spine" (ToS-safe, no OAuth in the reactive path; the proactive agent's own-mailbox OAuth is ADR-004)

Per-tenant inbound parse address (`leads@{slug}.in.brightears.io`) + one-time forwarding rules catch ALL lead sources (plain email, website forms, The Knot/WW/Bark/GigSalad notification emails — parsing those is established practice: 17hats, Mailparser, Zapier templates). LLM parses + triages spam → drafts availability-aware reply in owner's voice (rate-card-bounded) → PWA push → owner approves/edits in ≤2 taps → sent from `mail.brightears.io`, From = business name, Reply-To = owner → client replies loop back via the forward → sequences (day 2/5/9 default) until booked/dead, hard-stops on reply/booked/dead/opt-out, country-correct compliance footers.
Adapters: Thumbtack Partner API (apply early — only marketplace officially sanctioning automated replies), Bark via official Zapier (budget caps), The Knot/WW deep-link nudge preserves their Quick Responder badge, GigSalad draft+deep-link only. Own-mailbox send (the *proactive* sales agent, ADR-004) is Google-only: the artist's own Gmail via native minimal-scope OAuth (`gmail.send` only). The integration and founder account were live-tested. Google branding is verified, while data access remains under review: on 2026-08-08 Google requested auditable segregation proving that Google API user data never reaches OpenRouter, plus a new demo video. The 2026-08-17 release adds the disclosure, policy language and code-level boundary test; arbitrary-user Gmail onboarding remains unverified until Google accepts the resubmission. No Microsoft/Outlook OAuth is built. Phase 2: FB Messenger/Instagram via Meta review.
Stack: Next.js 16 + Prisma 6.19 + Postgres, OpenRouter + Vercel AI SDK (per-purpose model map: DeepSeek V4 Flash for parse/triage, V4 Pro for drafts; eval harness decides final picks — per-lead LLM cost <1¢), Postmark, Clerk, Stripe, PWA. Deploys to its OWN Render service; never touches the live agency stack.

## 6. MVP scope

**IN:** self-serve signup, subscribe-to-activate (no automatic free trial — see §7; cancel anytime; no money-back guarantee), profile-first onboarding (business identity and mailing address, artist profile, voice, availability and forwarding), optional packages later for sharper inbound quotes, inbound parse + 4 source parsers + generic LLM parser, spam triage, draft engine + eval harness, approve-from-phone PWA, sequences, lead pipeline UI, weekly report email, the proactive Hunt (venue discovery → fit-scoring → pitch drafting → approve → own-mailbox send), Stripe with lead-metering, polymorphic PerformerKind.
**OUT (phase 2+):** quotes/contracts/e-sign + deposit links — this is the **v1.1 money path** scoped in `ADR-003-scope-vs-price.md` (quote builder → contract-lite e-sign → deposit via the DJ's OWN payment link, zero custody), gated on Gate 1 pass; until then `Business.bookingLinkUrl` carries the owner's existing booking/contract/deposit page in closing replies and nudges — payment chasing, client planning portal, IG/FB DMs, Gmail send-as *for the reactive spine* (the proactive sales agent already sends from the artist's own Gmail via OAuth, ADR-004), machine-readable booking endpoint (in the pocket — later each customer gets their own AI-readable booking endpoint; never a central marketplace), non-DJ marketing.

## 7. Pricing (founder-confirmed; tier recut per ADR-003)

**Subscribe to activate (founder decision 2026-06-16, SUPERSEDES the 2026-06-14 "14-day free trial" decision): Starter/Pro/Studio monthly, cancel anytime; NO automatic free trial; NO money-back guarantee.** The product wording is single-sourced in `lib/marketing/guarantee.ts`. The founder approved the Privacy Policy, Terms, Cookie Policy, DPA, Acceptable Use Policy and restricted Hunt LIA on 2026-08-17. They are effective and indexable from that date; the LIA permits only the controlled-launch countries, scale and safeguards it records.

A free trial was gameable (sign up, grab gigs, churn, re-sign with a new email) and a guaranteed loss on un-vetted users. Selected comp-beta artists instead receive a free first month through an exact `BETA_COMP_EMAILS` allowlist: the server resolves `BETA_PROMO_CODE` and attaches the promotion to Stripe Checkout automatically. The generic promotion-code box is not exposed and the tester does not type a code. If an allowlisted artist's promotion is missing or invalid, checkout fails closed before charge; ordinary full-price checkout is unaffected. New tenants get `plan=TRIAL`, meaning "free / not subscribed", and the agent is paused until they subscribe (`lib/billing/metering.ts: isAgentPaused = plan === "TRIAL"`); subscribing switches on drafting, venue pitching and the discovery scan. `trialEndsAt` is vestigial. The unenforceable "pays for itself" claim stays removed for legal reasons.

**Starter $25/mo** (15 inbound leads/mo, 1 performer, approve-every-send) → **Pro $79/mo** (60 inbound leads/mo, per-source auto-send autopilot) → **Studio $149/mo** (150 inbound leads/mo, multi-performer roster — shipped July 2026 P13: performer CRUD, per-performer availability, `rosterCap` 10 in `lib/billing/plan-features.ts`). **Tier recut (`ADR-003-scope-vs-price.md`, June 2026): every tier is the full-capability assistant** — replies, follow-up sequences until booked-or-dead, weekly report, spam triage, approve-from-phone, and the proactive Hunt in all tiers; tiers gate capacity + autonomy (inbound leads, performers, auto-send, team), never capability. Reactive inbound **leads** and proactive **venue pitches** are separate allowances; Hunt caps are HOT 10 / WARM 5 / SEED 3, ≤18/day. At a paid lead cap, drafting pauses and the product prompts an upgrade — never a surprise bill. A buyable lead-pack top-up remains deferred. Customers are metered in leads; `LlmUsage` is the internal 70%-gross-margin guardrail. The first-25 founding-member offer at $15/mo for year one in exchange for a review and case study is planned in `ROADMAP.md`, not live. Positioning remains against a $1,500–3,000 booked event and against DJEP as a bolt-on, not a switch.

## 8. Brand, voice, design

See CLAUDE.md "Brand, voice & design" and **`docs/DESIGN.md` v2.1 — dark "Neon Collage"** (the June-10 light-pastel reading of royalstreaming.com was wrong; founder-picked replacement June 11): ink canvas #17161f, cream/white content panels, cyan #00bbe4 as the product voice (everything you click), magenta→orange gradients as the show voice (headlines, celebration, marketing CTAs), mono sticker chips, reduced-motion safety. Experience voice without personal names ("We've been there — 20 years running entertainment for venues... so we built Vinyl for ourselves, and now this for you"), customers' verbatim language in headlines.

## 9. Go-to-market

Full engine in `MARKETING-PLAN.md`. Summary: agents produce the content/AEO/free-tool/prospect-list machine; founder does community presence (DJ Facebook groups under the Bright Ears identity), podcast guesting with the Vinyl story, association partnerships (USDJA/ADJA/NAME/NADJ/DJAA), and measured cold outreach (US norms allow it). Calendar anchors: DJX Atlantic City Aug 10–13; Wedding MBA Las Vegas Nov 17–19.

## 10. Gates

- **Hunt beta quality check (before interpreting conversion):** the rolling
  30-day founder scorecard measures explicit useful matches (approved versus
  owner-skipped), pitch approval and clear discovery misses. Initial decision
  thresholds are ≥70% useful matches from 20 reviewed, ≥70% pitch approval
  from 10 decisions and ≤10% clear misses from 20 reviewed. Contact discovery
  is reported separately as current stored-contact inventory and mutually
  exclusive latest-attempt states, with descriptive published and
  persisted-actionable yield among distinct tenant venues actually attempted
  in the 30-day window.
  It has no calibrated pass/fail target: historical eligible-at-start coverage
  and per-attempt history were not stored, and the former 60% from 20 recently
  found venues was not a valid cohort metric. Smaller decision samples remain
  visibly **LEARNING** and are not launch claims. A discovery-only benchmark may
  scan and ingest candidates, but never drafts or sends outreach.
- **Hunt 14-day conversation gate:** only selected comp artists stamped with
  `betaStartedAt` enter this cohort. Once at least 10 artists have completed 14
  days, require ≥30% to have a real venue reply after a primary pitch sent
  inside that artist's cohort window. Earlier/manual replies do not count.
- **Gate 1 (launch + 90 days):** ≥10 paying businesses, ≥3 arms-length. Miss badly → reposition or kill. **Pass → unlock Money Path v1 per `ADR-003-scope-vs-price.md`** (quote → contract-lite e-sign → deposit via the DJ's own payment link, zero custody; ships to all tiers, ~2.5–4 weeks; its own success gate: ≥30% of active customers send a deposit request within 30 days).
- **Gate 2 (month 6):** signup→subscribed ≥25%; logo churn ≤5%/mo after first cohort; case-study-grade booked-gig numbers exist.
- **Target:** ฿150k/month profit ≈ ~50 customers at blended ~$85 — realistic 12–18 months post-launch if gates pass.

## Appendix
- Research raw output: `/private/tmp/claude-501/-Users-norbert-Documents-Projects-Bright-Ears/7a77bba6-81f7-4281-a99e-c517d38f7b82/tasks/w7b28c8re.output`
- Strategy background: `../../STRATEGY-RESEARCH-JUNE-2026.md`
