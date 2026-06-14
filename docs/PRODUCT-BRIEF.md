# Bright Ears SaaS — Product Brief (canonical)

**Date:** June 10, 2026 · Supersedes `../../PRODUCT-BRIEF-GIGSORTED.md` (pre-decision draft). Research basis: 11-agent workflow `wf_fb02d04c-d1d`; raw output path in Appendix.
**Founder decisions locked in:** brand = **Bright Ears** on brightears.io (no new domain); entry price $25/mo with usage tiers; no personal founder name — "we've been there" experience voice + the Vinyl story; design = colorful/fun on a light base (reference royalstreaming.com); old agency app moves to `agency.brightears.io` at cutover so Vinyl never stops.

## 1. One-sentence pitch

**The AI office that answers every inquiry for your DJ/entertainment business in under 5 minutes — in your voice, with your real availability — and follows up until the gig is booked, while you approve everything from your phone.**

## 2. Who it's for

**Primary:** wedding/mobile/event DJ business owners, 1–5 people, US first then UK/AU/CA. They earn $1,000–3,000 per booked wedding, already pay $20–179/mo for software (DJ Event Planner, Vibo, Check Cherry), and do admin at night around gigs, day jobs, kids.
**Secondary (same product, later marketing):** any bookable performer business — bands, singers, magicians, photo booths, dancers, MCs. Schema is polymorphic from day one; only marketing narrows to DJs.
**NOT for:** club/scene DJs, venues, large agencies.

## 3. The validated pain (their words — use verbatim in copy)

- "Get an inquiry, immediately respond, and then nothing... 30 inquiries so far, maybe 5 have responded."
- "You don't want to be the 5th DJ that reaches out." / "Far more likely to book with the first person to close the deal."
- The customer-written spec: "I can't always text the lead within 5 minutes... I want to automate this. I've looked into DJ Intelligence, SMPL, and DJEP — none of them integrate with Zapier." (r/mobileDJ, Oct 2024)
- "Falling asleep with the laptop on." / "If there were two of me, I would double my business."
- Couples' side: 1/3 of vendors never respond; they book whoever replies first.
- AI attitude: owners happily use ChatGPT for replies; clients must never see it → **white-label + human approval is the design.**

## 4. Competitive position (June 2026, verified)

The wedge — DJ/performer-positioned + self-serve trial + email/form/directory lead ingestion + availability-aware personalized drafts + approve-from-phone + follow-up-until-booked-or-dead + white-label — **is unoccupied**. Mikla.ai proved the category for wedding *venues* ($149–499/mo, ~200 customers, demo-led, no self-serve); DJ incumbents (DJEP $20–50 — no API, no AI, 20-yr-old codebase; GigBuilder — "AI" writing utility, 2.5/5 Capterra; Vibo/Check Cherry — nothing on leads) left it open; HoneyBook's AI drafts only inside its own CRM and demands full migration; The Knot's auto-reply is a one-shot FAQ acknowledgment. Window estimate: 12–18 months. Built-in differentiators: spam/scam triage (The Knot leads are "95% spam" per vendor rage — we turn it into a feature), the verifiable Vinyl story, UK/AU completely unserved.
Main threats: The Knot shipping native AI replies (counter: own-website/Bark/UK/AU leads), HoneyBook bundling (counter: bolt-on positioning — "keep DJEP, add the AI office"), Mikla moving down-market (counter: self-serve + price + DJ logic).

## 5. Architecture — "email spine" (ToS-safe, no OAuth in the reactive path; the proactive agent's own-mailbox OAuth is ADR-004)

Per-tenant inbound parse address (`leads@{slug}.in.brightears.io`) + one-time forwarding rules catch ALL lead sources (plain email, website forms, The Knot/WW/Bark/GigSalad notification emails — parsing those is established practice: 17hats, Mailparser, Zapier templates). LLM parses + triages spam → drafts availability-aware reply in owner's voice (rate-card-bounded) → PWA push → owner approves/edits in ≤2 taps → sent from `mail.brightears.io`, From = business name, Reply-To = owner → client replies loop back via the forward → sequences (day 2/5/9 default) until booked/dead, hard-stops on reply/booked/dead/opt-out, country-correct compliance footers.
Adapters: Thumbtack Partner API (apply early — only marketplace officially sanctioning automated replies), Bark via official Zapier (budget caps), The Knot/WW deep-link nudge preserves their Quick Responder badge, GigSalad draft+deep-link only. Own-mailbox send (the *proactive* sales agent, ADR-004): the artist's own Gmail via native minimal-scope OAuth (`gmail.send` only) — **shipped** (ROADMAP 10.5), CASA review deferred to public launch; this superseded the earlier Unipile/Nylas plan, and no Microsoft/Outlook OAuth is built yet. Phase 2: FB Messenger/Instagram via Meta review.
Stack: Next.js 16 + Prisma 6.19 + Postgres, OpenRouter + Vercel AI SDK (per-purpose model map: DeepSeek V4 Flash for parse/triage, V4 Pro for drafts; eval harness decides final picks — per-lead LLM cost <1¢), Postmark/Mailgun, Clerk, Stripe, PWA. Deploys to its OWN Render service; never touches the live agency stack.

## 6. MVP scope

**IN:** self-serve signup, 14-day trial (no card), onboarding wizard (profile, packages, voice samples, forwarding walkthrough, gig calendar), inbound parse + 4 source parsers + generic LLM parser, spam triage, draft engine + eval harness, approve-from-phone PWA, sequences, lead pipeline UI, weekly report email, Stripe with lead-metering, polymorphic PerformerKind.
**OUT (phase 2+):** quotes/contracts/e-sign + deposit links — this is the **v1.1 money path** scoped in `ADR-003-scope-vs-price.md` (quote builder → contract-lite e-sign → deposit via the DJ's OWN payment link, zero custody), gated on Gate 1 pass; until then `Business.bookingLinkUrl` carries the owner's existing booking/contract/deposit page in closing replies and nudges — payment chasing, client planning portal, IG/FB DMs, Gmail send-as *for the reactive spine* (the proactive sales agent already sends from the artist's own Gmail via OAuth, ADR-004), machine-readable booking endpoint (in the pocket — later each customer gets their own AI-readable booking endpoint; never a central marketplace), non-DJ marketing.

## 7. Pricing (founder-confirmed; tier recut per ADR-003)

14-day full-Pro trial, no card → **Starter $25/mo** (15 leads/mo, 1 performer, approve-every-send) → **Pro $79/mo** (60 leads/mo, per-source auto-send autopilot) → **Studio $149/mo** (150 leads/mo, multi-performer routing, team seats). **Tier recut (`ADR-003-scope-vs-price.md`, June 2026): every tier is the full-capability assistant** — instant replies, follow-up sequences until booked-or-dead, weekly report, spam triage, approve-from-phone in ALL tiers; tiers gate only capacity + autonomy (leads, performers, auto-send, team), never capability (capability-gating is the resented HoneyBook anti-pattern; DJEP/GigBuilder/Check Cherry all gate capacity). **Refund guarantee: REMOVED pending founder decision (audit A1, 2026-06-14)** — the "pays for itself in your first season, full refund" wording was unenforceable/unverifiable and is pulled from all surfaces + JSON-LD; interim live wording is the true risk-reversal (free trial · no card · cancel anytime · pause-at-cap), final policy is the founder's call. Success-fee rejected (ADR-003); per-gig economics live as framing instead (one saved $1,800 gig = 6 years of Starter; ~$1.32–1.67 per lead handled vs Bark's $28–47 per raw lead). Lead packs $10/10; at cap, pause + upsell — never surprise bills. Customers are metered in **leads** (they don't think in tokens); `LlmUsage` is our internal margin lens with a 70% gross-margin guardrail. Founding members: first 25 at $15/mo for year one ↔ review + case study. Positioning: against a $1,500–3,000 booked wedding and against DJEP as a *bolt-on*, not a switch.

## 8. Brand, voice, design

See CLAUDE.md "Brand, voice & design" — Bright Ears logo + palette (cyan #00bbe4 primary on a light, colorful, fun base; royalstreaming.com reference; explicitly NOT the current dark site), experience voice without personal names ("We've been there — 20 years running entertainment for venues... so we built Vinyl for ourselves, and now this for you"), customers' verbatim language in headlines.

## 9. Go-to-market

Full engine in `MARKETING-PLAN.md`. Summary: agents produce the content/AEO/free-tool/prospect-list machine; founder does community presence (DJ Facebook groups under the Bright Ears identity), podcast guesting with the Vinyl story, association partnerships (USDJA/ADJA/NAME/NADJ/DJAA), and measured cold outreach (US norms allow it). Calendar anchors: DJX Atlantic City Aug 10–13; Wedding MBA Las Vegas Nov 17–19.

## 10. Gates

- **Gate 1 (launch + 90 days):** ≥10 paying businesses, ≥3 arms-length. Miss badly → reposition or kill. **Pass → unlock Money Path v1 per `ADR-003-scope-vs-price.md`** (quote → contract-lite e-sign → deposit via the DJ's own payment link, zero custody; ships to all tiers, ~2.5–4 weeks; its own success gate: ≥30% of active customers send a deposit request within 30 days).
- **Gate 2 (month 6):** trial→paid ≥25%; logo churn ≤5%/mo after first cohort; case-study-grade booked-gig numbers exist.
- **Target:** ฿150k/month profit ≈ ~50 customers at blended ~$85 — realistic 12–18 months post-launch if gates pass.

## Appendix
- Research raw output: `/private/tmp/claude-501/-Users-norbert-Documents-Projects-Bright-Ears/7a77bba6-81f7-4281-a99e-c517d38f7b82/tasks/w7b28c8re.output`
- Strategy background: `../../STRATEGY-RESEARCH-JUNE-2026.md`
