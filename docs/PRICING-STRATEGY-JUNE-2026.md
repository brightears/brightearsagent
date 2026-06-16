I have everything I need from the four research outputs. They converge tightly; my synthesis job is to lock the calls (which candidate, prices, model strategy) and write the honest copy. Here is the memo.

---

# Bright Ears — Effort-Based Pricing: Decision Memo

**To:** Founder · **From:** Head of Product+Pricing · **Date:** 2026-06-16
**Decision needed:** Re-axis the tiers off "N inbound leads/mo." Ship the effort-based ladder below.

---

## 1. The reframe in one line

**Stop selling "how many leads you'll get." Start selling "how hard your AI works for you" — how often it hunts, how far it reaches, how deep it researches, and how much it does on its own — plus a complete back office that takes a stranger all the way to a signed, paid deposit.**

The current "15/60/150 inbound leads/mo" axis is **outcome-metering** — it reads as a promise to deliver N leads we cannot guarantee (depends on the artist's city, art form, season). The AI-agent pricing playbook independently names this the trap to avoid: "non-performance may lead to no revenue," and effort spent in the *attempt* goes unmonetized ([Chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)). The mature analogs already meter on effort, not outcome — AiSDR on **sends/mo**, Artisan on **leads contacted** with a **co-pilot vs autopilot** axis ([babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs)). Your instinct is correct and category-validated.

---

## 2. Recommended 3-tier structure

**Ship Candidate A ("Cadence + Coverage ladder"), with Candidate B's autonomy framing in the copy.** Cadence and coverage are the most *provable and least promise-y* dials — the artist literally sees "checked every 3 hours, searched your whole region, surfaced 30 vetted opportunities" in the weekly report. Autonomy is the most *differentiated* dial but a weak primary gate (making Starter "approve everything" risks the HoneyBook crippled-entry-tier feel ADR-003 warns against), so it rides as a strong secondary.

**Prices: keep $25 / $79 / $149.** ADR-003 locked these and they're right — lowering signals "toy," raising breaks the "same price as GigBuilder, but it answers for you" anchor. Keep the **14-day free-Pro trial** and the founder's "Start free" copy rule (never "no card").

| | **Starter — $25/mo** | **Pro — $79/mo** | **Studio — $149/mo** |
|---|---|---|---|
| **Tagline** | "Never the last to reply." | "Your AI hunts while you sleep." | "A back office for your whole roster." |
| **Hunt — scan cadence** | Once a day | Every few hours | Continuous (near-real-time on HOT) |
| **Hunt — coverage** | Home city | Whole metro | Region + neighbouring cities + **Travel/residency mode** |
| **Hunt — research depth** | Standard fit-check | Deep research on HOT/WARM | Deep research on all + recent-event tailoring |
| **Opportunities surfaced/wk** | up to ~10 | up to ~30 | up to ~60 |
| **Pitches sent/day** | up to 6 | up to 12 | up to 18 |
| **Autonomy** | You approve every send | Auto-send to proven HOT/WARM | Full autopilot + auto-routing |
| **Inbound handled/mo** | 15 | 60 | 150 |
| **Performers / seats / brands** | 1 performer | 1 performer | Multi-performer + team seats + multiple brands |
| **Money path** (quote→e-sign→deposit) | ✓ all tiers | ✓ | ✓ |
| **Model** | Same internal per-purpose map (never exposed) | Same | Same |
| **Who it's for** | Solo performer, one city, wants speed-to-lead + a foot in proactive | Working performer wanting real pipeline across their metro, hands-off outbound | Touring/residency artists + small agencies/rosters who need reach, autopilot, and team routing |
| **Heavy-month LLM COGS** | ~$0.51 | ~$1.41 | ~$3.00 |
| **Gross margin** | ~98% | ~98% | ~98% |

**Note the "Model" row is identical on purpose** — see §3. The dials that move money are cadence, coverage, depth, autonomy, and roster — all honest, all provable, none a promise.

---

## 3. Model-per-tier & margin call

**Recommendation: do NOT tier the model name. Keep ONE internal per-purpose model map across all tiers (CLAUDE.md rule 10) and tier the EFFORT — more passes, deeper enrichment, more cadence, more candidates — on the same cheap models.** This directly resolves your margin worry: there is no per-tier model map to reconcile.

Rough unit economics (verified June 2026; `LlmUsage` logs the real numbers):

- 1 inbound lead ≈ 8K in / 3K out → **~$0.006 on DeepSeek** ([DeepSeek](https://deepseek.ai/pricing)), vs $0.069 on Sonnet 4.6 ([OpenRouter](https://openrouter.ai/anthropic/claude-sonnet-4.6)).
- 1 Hunt pitch ≈ 12K in / 2K out → **~$0.007 on DeepSeek**.
- **All-DeepSeek, every tier maxed: ~98% gross margin.** Huge headroom over your 70% floor.

The *aggressive* alternative — putting Sonnet on all 300 deep-research pitches at the Studio cap — lands at **72%**: technically above the floor but fragile (one heavy user or token surprise breaches it). **Opus on the pitch path breaks it (~55%) — never do that.**

**The clean call:**
1. Buyer never sees a model name. Model costs swing ~10×/yr ([Chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)); hard-anchoring a tier to "Studio gets Claude" is a margin landmine.
2. Higher tiers buy **more effort, same models** — this is what AiSDR (sends/mo) and Clay (enrichment depth) do.
3. *If and only if* evals prove DeepSeek writes a mediocre pitch, upgrade the **deep-research pass on Pro/Studio only** to Sonnet, frame it to the buyer as **"deeper research,"** cap the pass count, and the math still clears 70%. Let the eval harness pick the model.
4. Keep the existing `LlmUsage` per-tenant <70% margin alert (rule 8) as the guardrail; add a per-tier soft cap on deep-research passes.

---

## 4. Feature ladder

**The single sharpest point: you don't need a pile of new features — you need to re-axis what you already built.** Travel Mode, the Hunt engine + temperature model, voice profiles, lead pipeline, internal calendar, follow-up sequences, weekly report, multi-performer model, and auto-send plumbing are **already shipped**. The only true L-effort build is the money path.

**Gates (what moves someone up):**

| Feature | Placement | Build | Roadmap fit |
|---|---|---|---|
| **Auto-send autonomy** (co-pilot→autopilot) | Starter approve → Pro auto-send HOT/WARM → Studio full | **S–M** (mostly built; expose + per-source) | Core (Phase 3/4, 10.5) |
| **Hunt cadence** (daily → few-times → ~3-hourly) | the gate | **M** (cron + plan lookup) | Strong — ROADMAP 10.8 pre-committed |
| **Hunt coverage + Travel Mode** (city → metro → region + travel) | the gate | **M** (Travel Mode built; plan-gate new) | Strong |
| **Hunt research depth / surface count** | the gate | **M** (scoring built; depth-by-plan new) | Strong |
| **Roster / seats / brands** | Studio gate | **M** (`Performer`/`Member` exist; limits/invites new) | Niche-normal (Dubsado/HoneyBook gate these) |

> Keep **per-day pitch caps gated by profile quality, not tier**, so deliverability discipline (ADR-004) survives — only cadence/coverage/depth climb the ladder.

**All-tier capabilities (raise the ceiling + crush churn — NOT between-tier gates):**

### ★ The v1.1 money path — quote → contract-lite e-sign → deposit via the artist's OWN link
- **Ships to ALL tiers (ADR-003).** It is the #1 reason someone pays at all vs a $25 toy and the top retention control point — single-trick AI tools churn 50–70%; money/back-office control points retain hardest.
- **Demand is the strongest paid-upgrade signal in the research:** "it takes a stranger all the way to a signed, paid deposit" is the perception cliff; performers report ghosting "after an hour on a custom proposal" and active deposit-dispute pain ([Our DJ Talk](https://ourdjtalk.com/djchat/how-do-you-handle-deposit-disputes.38003/)); the DJ-specific competitor sells "Get Paid Faster" / "contracts in minutes" ([MY DJ CRM](https://mydjcrm.com/)).
- **Build: L (~3 wk).** Scope is bounded: AI quote from the existing `Package` rate card → typed-name + checkbox + SHA-256 + IP/timestamp e-sign (ESIGN/UETA-sufficient) → deposit via the DJ's own payment link, **zero custody** (Stripe Connect is unavailable to a Thailand platform — hard constraint).
- **Gate: build only after ROADMAP Gate 1** (≥10 paying, ≥3 arms-length). Interim bridge already lives: `Business.bookingLinkUrl` in closing replies + nudges.

Other all-tier capabilities, in order after the money path: **analytics dashboard + usage meter** (S→M; the weekly report is the honesty mechanism — makes effort *felt*), then review/referral automation (M), then *defer* external calendar sync + Zapier (both reintroduce OAuth into the email-spine path — weigh carefully).

---

## 5. Honest copy

The one rule for every line: describe **what the AI does** (scans, researches, drafts, sends, handles) — never **what you'll get** (gigs, bookings, revenue). Safe verbs: *surfaced, vetted, handled, pitched.* Banned: *delivered, won, booked-for-you,* and any number of gigs.

**The flagship before→after:**

> **❌ Before (Pro):** "60 inbound leads/mo"
> **✅ After (Pro):** "We answer up to 60 inquiries a month — in your voice, with follow-ups until booked-or-dead — and hunt your whole metro every few hours, auto-sending vetted pitches you approved the style of."

**Example tier bullets:**

**Starter — $25 · "Never the last to reply."**
- Replies to every inquiry in minutes, in your voice — you tap Approve.
- Hunts your home city once a day and surfaces up to ~10 vetted venue opportunities a week.
- Handles up to 15 inquiries a month, with follow-ups until booked-or-dead.
- Quote → e-signed agreement → deposit via your own payment link. Included.

**Pro — $79 · "Your AI hunts while you sleep."**
- Everything in Starter, working across your **whole metro, every few hours**.
- **Auto-sends** personalized pitches to vetted hot venues — from your own mailbox. You just watch.
- Deep research on your best-fit venues, so the pitch is relevant, not generic.
- Handles up to 60 inquiries a month.

**Studio — $149 · "A back office for your whole roster."**
- Everything in Pro, scanning **continuously** across **your region plus the cities you tour to** (Travel Mode).
- Full autopilot + multi-performer routing, team seats, and multiple brands.
- Surfaces up to ~60 vetted opportunities a week, with recent-event tailoring.
- Handles up to 150 inquiries a month.

**Supporting honesty mechanics:** keep the **pause-don't-bill** behavior at cap (the playbook's "soft ceiling" done right — and a marketing weapon against Bark's expiring pay-per-lead credits); surface an **in-product usage meter** (cadence used, pitches sent, leads handled, opportunities surfaced) so the effort is visible; put **per-gig math** next to every tier ("one saved $1,800 gig = years of subscription") instead of a lead count.

---

## 6. The zeitgeist hook

**"It hunts for gigs while you sleep — and still sounds exactly like you."**

No competitor does proactive outreach; every CRM (MY DJ CRM, HoneyBook, Check Cherry) only reacts to inbound. Performers describe self-booking into venues as a "5%-response slog" they avoid ([Bandsintown](https://artists.bandsintown.com/support/blog/bandsintown-hacks-that-ive-used-hundreds-of-times-to-book-more-and-better-live-shows)), and the deepest 2026 craving is winning the speed-to-lead race without living in their inbox — ~50% of bookings go to the first responder ([WeddingPro](https://pros.weddingpro.com/blog/sales/still-waiting-to-hear-from-a-lead-heres-why/)). Wrap it in the emotional center of 2026 — burnout, "having the time to do IT ALL" ([Wedding Pro Survey](https://saradoesseo.com/wedding-marketing/wedding-pro-survey-2025/)) — and the promise becomes: **more time on your craft, less in your inbox — and your AI works hardest when your phone is quiet** (the seasonality fix). Sell the relief, prove it with the weekly report; never sell a gig count.

---

## 7. Open questions / risks

**Decisions you still own:**
1. **Surfaced-opportunity numbers (~10/30/60/wk).** These are inferences. Pick numbers the Hunt can *consistently* hit in a thin market (e.g. a solo magician in a small city) so the tier never under-delivers its own effort claim. Validate against real `VenuePitch` volumes before they touch copy.
2. **Money-path sequencing.** It's the highest-leverage build but **gated on Gate 1** (≥10 paying, ≥3 arms-length). Confirm you hold the line and don't build it early.
3. **Travel Mode as the Studio coverage gate.** Real and differentiated — but is your beachhead artist base touring/residency-oriented enough to make Studio's coverage step feel worth +$70 over Pro? If most early users are single-metro, Studio leans on roster/seats instead; watch which gate actually converts.
4. **Pro→Studio gap.** $79→$149 must feel justified by continuous cadence + Travel + autopilot + roster. If early Studio uptake is thin, that's the signal the gap is features-light, not a pricing problem.

**To validate before/just after launch:**
- **Token assumptions (8K/3K inbound, 12K/2K pitch).** Conservative estimates — re-run the margin math against real `LlmUsage` per-tenant data before any model-tiering decision.
- **DeepSeek pitch quality.** Run the eval harness; only if it writes mediocre pitches do you upgrade the deep-research pass to Sonnet (Pro/Studio, capped) — never a tier-named model.
- **Third-party comp prices** (babuger/tomba/getcone, etc.) drift fast and come from comparison blogs, not vendor pages — re-verify against vendor pricing before any figure touches `comparisons.ts` or customer copy (the `LAST_VERIFIED` discipline).

**Top risk:** an effort dial can still *feel* like a broken promise if the surfaced-opportunity count is set higher than the Hunt reliably delivers in a thin market. Honesty is the brand — set those counts conservatively and let the weekly report over-deliver, not under-deliver.

---

**Bottom line:** Ship Candidate A at $25/$79/$149. Gate on **cadence + coverage + research depth + autonomy + roster**; keep **inbound-handled, the money path, voice, and analytics** in every tier. Keep one internal model map (98% margin). Lead marketing with "it hunts while you sleep and still sounds like you." The only real build is the money path, and it's already scoped, gated, and sequenced.

**Key files:** `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/docs/ADR-003-scope-vs-price.md` · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/outreach/caps.ts` (flat shared caps to re-tier) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/billing/metering.ts` (keep 15/60/150 as-is) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/CLAUDE.md` (rule 10) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/agent/voice.ts` (voice + `bookingLinkUrl` bridge) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/reports/weekly.ts` (analytics substrate).


---

# Appendix A — Adjacent-service pricing research

I now have comprehensive, cited data across all four categories. Compiling the final markdown deliverable.

---

# Adjacent-service pricing & packaging research — for the Bright Ears effort-based ladder

Compiled 2026-06-16. Every external figure is cited. Where a number couldn't be pinned to a primary source it's labelled **[inference]**. Most prices below are from third-party comparison pages, not vendor pricing pages — treat them as directional, not gospel, and re-verify before they touch customer copy (this matches the `LAST_VERIFIED` discipline in `lib/marketing/comparisons.ts`).

---

## 1. AI SDR / outbound-prospecting tools (the closest analog to the Hunt)

These are the only mature category that does exactly what the Hunt does: proactively find prospects and draft outreach. Note the unit and the price gap — they sell to funded sales teams, not solo performers, so **borrow the mechanics, not the numbers.**

| Service | What they meter on | What's gated higher | Notable top-tier features | Source |
|---|---|---|---|---|
| **AiSDR** | **Emails sent / month** (~$0.90/email at entry). "Credits, not features, run out." | Pure send-volume tiers (~1,000 → 3,000+ sends); SSO, multi-domain, CRM, SLAs at Enterprise | Dedicated account manager, multi-domain warmup | [tomba.io](https://tomba.io/blog/aisdr-pricing), [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs) |
| **Artisan (Ava)** | **Per-lead contacted** (~$2.19/lead), annual contract; volume tiers ~$770 → $4,750+/mo | Volume bands; autopilot vs co-pilot autonomy offered across tiers | Higher contact volume, autopilot send | [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs), [landbase](https://www.landbase.com/blog/artisan-ai-pricing) |
| **11x (Alice)** | **Flat per-agent** enterprise subscription (~$5k–$10k+/mo), annual only | Custom features; implementation $5k–$15k | Multi-agent parallel campaigns | [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs) |
| **Clay** | **Credits** ($149/2k → $720/50k credits); 5–15 credits per enrichment workflow | Escalating credit pools; deeper waterfall enrichment + "Claygent" agent access unlock with tier | 50k+ credits, full waterfall enrichment | [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs) |
| **Apollo.io** | **Per-seat + credit overages** ($0.20/credit); $49 → $149/user/mo | Phone dialer, AI writing, lead scoring gated higher; 270M-contact DB in all tiers | Org-level lead scoring, dialer | [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs) |
| **Instantly** | **Modular** — Outreach, Lead Database, CRM sold *separately*; email-volume caps per tier | "Advanced features" + larger send volume; separate lead-DB access | Light Speed sending tier | [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs) |
| **Salesforce Agentforce SDR** | **Per-conversation ($2)** or **flex credits ($0.10/action)**; $500 = 100k credits | Requires base SF license; impl $50k–$150k | Per-conversation outcome billing | [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs) |

**The pattern that maps to the Hunt:** the dominant honest unit is **sends/month** (AiSDR) or **leads contacted** (Artisan) — i.e. *how much the agent does for you*, NOT leads-delivered. **Autonomy is already a recognized axis** (Artisan sells "co-pilot vs autopilot") — this is exactly Bright Ears' "approve every send → per-source auto-send" ladder, validated by the category. Credits are common but the Chargebee playbook (below) flags them as buyer-confusing.

---

## 2. Gig/booking marketplaces & vendor tools for performers

These charge performers on a **membership + success-fee** model. Worth knowing because ADR-003 already **rejected the success-fee** for Bright Ears (most-hated mechanic) — this table shows what we're deliberately *not* doing, and why it reads as a "tax."

| Service | What they meter on | What's gated / extra | Notable | Source |
|---|---|---|---|---|
| **GigSalad** | **Time-boxed membership** ($139/3mo, $229/6mo, $359/yr) **+ 2.5% booking fee** | Free tier exists; Pro unlocks more leads/visibility | Lower booking fee than The Bash | [help.gigsalad.com](https://help.gigsalad.com/article/148-membership-pricing), [help.gigsalad.com/fees](https://help.gigsalad.com/article/97-vendor-service-fees) |
| **The Bash** | **Annual membership** ($129–$219; promo $79 basic / $159 pro) **+ 5% booking fee ($20 min)** | "Pro" membership = more leads/placement | Two-part: subscription *and* per-booking cut | [sidehusl.com/thebash](https://sidehusl.com/thebash/), [itg.thebash.com](https://itg.thebash.com/top-questions) |
| **Bark (for pros)** | **Pay-per-lead credits** (~$2.35/credit; a lead = variable credits by job size/category); **credits now expire 3 months** | Elite Pro subscription = 5 free responses/mo + 20% off credits | Per-*raw*-lead (you pay to even respond, booked or not) | [help.bark.com](https://help.bark.com/hc/en-us/articles/13346288068892-What-is-a-credit-and-how-much-does-it-cost), [itqlick](https://www.itqlick.com/bark-com/pricing) |
| **Encore Musicians** | **Commission only — 20% of booking** (no membership, fee shown up front) | No tiers; pure success fee | Transparent split shown at quote time | [help.encoremusicians.com](https://help.encoremusicians.com/hc/en-us/articles/360000256533-The-Encore-Service-fee) |

**Maps to:** nothing in our model directly — and that's the point. ADR-003's per-lead math (~$1.32–1.67/lead handled vs **Bark's ~$28–47 per raw lead**, ~$2.35/credit × multiple credits) is reconfirmed here: Bark's expiring credits + pay-to-respond is the resented anti-pattern our flat subscription beats in marketing copy.

---

## 3. Creative-freelancer / event CRMs (where the v1.1 money-path features live)

This is the category whose **top tiers** Bright Ears should mine for "substantive higher-tier features" (quoting, contracts, invoicing). Crucially, two camps on *how* they gate — and the founder's instinct sits with the capacity-gaters.

| Service | What they meter on | What's gated higher | Notable top-tier features | Source |
|---|---|---|---|---|
| **Check Cherry** | **Bookings count, admin accounts, brands** — **ALL features in every plan** ($24–29 → $139/mo) | Volume of bookings, # admin seats, # brands (logo/email/color) | Contracts, invoices, payments, proposals **in entry tier** | [softwaresuggest](https://www.softwaresuggest.com/check-cherry), [capterra](https://www.capterra.com/p/229208/Check-Cherry/) |
| **HoneyBook** | **Capability + seats** — Starter ($29/mo annual) has **no automations, no scheduling**; Essentials ($49) adds them + 2 seats | Automations, Scheduler, SMS reminders, seats (2 → 10+) all capability-gated | Premium: 10+ seats, priority, multi-brand | [honeybook.com](https://www.honeybook.com/honeybook-vs-dubsado), [getcone](https://www.getcone.io/blog/dubsado-vs-honeybook) |
| **Dubsado** | **Capability + paid add-ons** — Starter ($16.67/mo annual) has **no automated workflows**; Premier ($33.33) adds them | Automations gated; **multiple brands + team members are paid add-ons (up to +$60/mo)** | Premier: scheduling, automations, public proposals | [getcone](https://www.getcone.io/blog/dubsado-vs-honeybook), [assembly](https://assembly.com/blog/dubsado-vs-honeybook) |

**The decisive split — and it backs the founder:**
- **Check Cherry = capacity-gated** (every feature in every tier; pay for *bookings/seats/brands*). This is the model ADR-003 chose and the niche norm cited there.
- **HoneyBook & Dubsado = capability-gated** (cheapest tier is deliberately crippled — no automations). ADR-003 explicitly calls HoneyBook "the resented anti-pattern." This research **independently confirms** it: their entry tiers literally strip automations/scheduling.
- **Top-tier feature shopping list for Bright Ears v1.1+:** contracts/e-sign, invoicing, payments, **multiple brands**, **team seats**, automations, scheduling. Check Cherry proves quoting/contracts/payments can live in *entry* tier and still differentiate on capacity — which fits "every tier = complete assistant."

---

## 4. "AI works harder at higher tiers" — effort/credit/compute patterns, and how to keep them honest

From the 2026 AI-agent pricing playbooks (Chargebee, Flexprice, Monetizely):

| Pattern | What it is | Honesty guidance | Source |
|---|---|---|---|
| **Meter on a tangible action, not backend ops** | N8N charges "workflows run," not hidden API calls | One customer action ≠ one billing unit — communicate it clearly | [chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) |
| **Outcome-based billing is a trap when you can't guarantee the outcome** | Intercom Fin: $0.99 per *resolved* issue | "Any AI workload consumed in the *attempt*… goes under-monetized… non-performance may lead to no revenue." You bet margin on guaranteed delivery | [chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) |
| **Credits confuse buyers** | Clay/Lovable burn-tables | Buyers must translate technical metrics into ROI themselves; "complex burn tables feel arbitrary" | [chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) |
| **Predictability guards** | Soft ceilings, usage alerts, included-usage floors | Usage alerts *before* overage; "soft ceilings signal flexibility without blank-check fear"; real-time usage viz prevents sticker shock | [chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) |
| **Hybrid (flat + usage tail)** | Fixed fee + metered overage | Keeps a price floor + predictability while capturing heavy users | [flexprice](https://flexprice.io/blog/hybrid-pricing-guide), [getmonetizely](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models) |
| **Living pricing** | Model costs drop ~10x/yr | "Locking price points in stone traps you between eroding margins and surprise churn" — review quarterly | [chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) |

This is the strongest external validation of the founder's whole thesis: **the playbook independently names outcome-metering (= "N leads delivered") as the trap to avoid**, for the exact reason the founder gave — you can't guarantee the outcome, so it reads as a broken promise and starves you when demand is low.

---

## TAKEAWAYS — how Bright Ears should structure the effort-based ladder

1. **The founder is right, and the AI-agent playbook proves it.** "N inbound leads/mo" is outcome-metering — Chargebee names it the trap ("non-performance may lead to no revenue"; effort spent in the *attempt* goes unmonetized). Re-axis the ladder onto **effort delivered**: cadence, geographic coverage, research depth, # of opportunities surfaced, autonomy. The mature analog (AiSDR) already meters on **sends/month** and Artisan on **leads contacted** — both are "how hard the agent works," not "leads we promise." ([chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/), [tomba](https://tomba.io/blog/aisdr-pricing), [babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs))

2. **Autonomy is a proven, sellable tier axis — lean into it.** Artisan explicitly sells "co-pilot vs autopilot." Bright Ears already ladders "approve-every-send (Starter) → per-source auto-send (Pro)." Make autonomy a *headline* axis, not a footnote — it's honest (more trust = more automation), margin-neutral, and category-validated. **Maps to the Hunt directly:** Starter = approve every venue pitch; higher tiers = auto-send to HOT/WARM after the artist's profile proves out. ([babuger](https://babuger.com/blog/ai-sdr-pricing-2026-what-every-platform-costs))

3. **For the Hunt, gate on COVERAGE and CADENCE, not pitch count.** The current caps (HOT 10/WARM 5/SEED 3, ≤18/day, shared across all plans per `lib/outreach/caps.ts`) leave the Hunt with no tier story. The honest, deliverable axes — none of which promise a result — are: **scan cadence** (once a day → every few hours), **geographic radius** (home city → metro → region → Travel Mode tour cities), and **research depth** (surface count + enrichment). AiSDR's send-volume tiers and Clay's escalating-enrichment tiers are the template. This finally gives the Hunt a reason to sit higher on the ladder.

4. **Keep the reactive (inbound) half capacity-gated, Check-Cherry style — never HoneyBook style.** Check Cherry puts *every feature* (contracts, invoices, payments) in *every* tier and gates only **bookings, admin seats, brands**; HoneyBook/Dubsado cripple their entry tier by removing automations and charge add-ons for brands/seats — the research confirms these are the *resented* models. Bright Ears' "every tier = complete assistant, gate capacity/autonomy/seats" is the right, niche-normal call. Keep inbound metered on a tangible **leads-handled** number (handled ≠ promised-delivered), which `lib/billing/metering.ts` already does. ([softwaresuggest](https://www.softwaresuggest.com/check-cherry), [getcone](https://www.getcone.io/blog/dubsado-vs-honeybook))

5. **Load higher tiers with SUBSTANTIVE back-office features, sourced from the event-CRM top-tier shopping list.** The category's premium features are: **contracts/e-sign, invoicing, payments, multiple brands, team seats, automations, analytics**. ADR-003's v1.1 money path (quote → contract-lite e-sign → deposit link) is exactly this — and Check Cherry proves these can differentiate even when present in lower tiers. Reserve **multiple brands** and **team seats** as clean Studio-tier gates (Dubsado/HoneyBook both gate these; they're real, not gimmicks). ([honeybook](https://www.honeybook.com/honeybook-vs-dubsado), [getcone](https://www.getcone.io/blog/dubsado-vs-honeybook))

6. **Resist credits — the playbook says buyers can't translate them, and the niche hates them most.** Clay/Lovable-style credit wallets force buyers to do ROI math; ADR-003 already found per-outcome credits (Bark's expiring lead-credits, The Knot's effective $500–2,000/booking) are the most hated mechanic in this niche. Stay on **flat subscription + plain-English allowances** ("leads handled," "venue pitches/day"). Bark's now-3-month-expiring credits ([help.bark.com](https://help.bark.com/hc/en-us/articles/13346288068892-What-is-a-credit-and-how-much-does-it-cost)) is the exact "feels like a tax" experience to keep marketing against.

7. **Predictability is the competitive wedge — formalize "pause + upgrade, never a surprise bill."** The playbook prescribes soft ceilings, pre-overage usage alerts, and real-time usage viz. `lib/billing/metering.ts` already pauses-and-prompts at cap (no overage billing) — that's the playbook's "soft ceiling" done right, and it's a marketing asset against Bark's pay-per-lead and AI SDRs' 1.5–3x overage fees. Add a **usage meter in-product** (cadence used, pitches sent, leads handled) so the effort is *visible* — that's how you keep an effort axis honest and felt. ([chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/))

8. **On "smarter model per tier" — do it as research depth, not an exposed model name, to protect margin.** The founder's margin worry is valid: per-tier model maps complicate unit economics. Cleaner: keep the per-purpose model map internal (CLAUDE.md rule 10) and let higher tiers buy **more effort with the same models** — deeper research passes, more enrichment, more candidates scored, more cadence. If premium ever justifies a stronger `draft`/Hunt-reasoning model, frame it to the buyer as "deeper research," meter the *effort* (passes/enrichment), and let the eval harness pick the model — the agent-pricing playbooks warn model costs swing ~10x/yr, so never hard-anchor a tier to a named model. ([chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/), [getmonetizely](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models))

---

**Two-halves cheat-sheet:**
- **Hunt (proactive):** gate on **cadence + geographic coverage + research depth/surface-count + autonomy** (Starter approve-each → higher auto-send HOT/WARM). Analogs: AiSDR (sends/mo), Artisan (leads contacted, co-pilot/autopilot), Clay (enrichment depth). Today's flat shared caps in `lib/outreach/caps.ts` are the thing to re-tier.
- **Inbound (reactive):** keep **leads-handled** capacity-gating + **seats/performers/brands** (Check Cherry model) and pile the **money-path features** (quote/contract/invoice — the Dubsado/HoneyBook top-tier list) on top, present across tiers per ADR-003. Today's `lib/billing/metering.ts` already does the honest pause-not-bill version.

**Caveat on figures:** the AI-SDR and CRM prices above come largely from third-party comparison blogs (babuger, tomba, getcone, sidehusl), not vendor pricing pages; ranges drift fast. Confirm against each vendor's own page before any of these touch `comparisons.ts` or pricing copy. Relevant internal files: `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/docs/ADR-003-scope-vs-price.md`, `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/outreach/caps.ts`, `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/billing/metering.ts`, `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/marketing/comparisons.ts`.


---

# Appendix B — Performer demand research

I have comprehensive, well-cited signal. Synthesizing the final ranked report now.

---

# What performers actually crave (demand / zeitgeist) — June 2026

**Note on method/sourcing:** WebSearch is US-only and Reddit's JSON/HTML is blocked to this environment, so I could not pull verbatim raw Reddit threads directly. Where I quote, the words are verbatim from reachable, dated 2025–2026 sources (DJ forums like Our DJ Talk, WeddingPro, the Wedding Pro Survey, DJ-CRM marketing copy that mirrors the exact pains it sells against, and industry blogs). Reddit-specific sentiment is summarized from search-snippet aggregations and **labelled as inference** where I could not open the thread itself. No sources are fabricated.

---

## The ranked list — top recurring wants/pains

### 1. "Be the first to reply, or you lose the gig" — speed-to-lead is the #1 obsession
This is the single loudest, most-cited business pain, and it maps directly to Bright Ears' core reactive product.

- **Evidence:** "Seven in 10 couples say vendor responsiveness is the most important factor they consider when booking" and "**Approximately 50% of couples choose the vendor that replies first**"; "**40% of couples report not hearing back from vendors within five days**." (WeddingPro) [pros.weddingpro.com](https://pros.weddingpro.com/blog/sales/still-waiting-to-hear-from-a-lead-heres-why/)
- **Evidence:** Industry advice to DJs is blunt — "Prospective clients are reaching out to several DJs at once, and if you take a day or more to respond, other wedding DJs will have the advantage… clients have complained that some DJs took too long to respond and were thankful to get quick replies." (Be a Wedding DJ) [beaweddingdj.com](https://beaweddingdj.com/wedding-dj-gigs/)
- **Evidence (the product mirror):** A DJ-specific CRM leads its homepage with "**Stop Losing DJ Gigs to Slow Replies**" and "**Be the First DJ to Respond — Automatically… Speed wins gigs. Let AI handle the first reply.**" (MY DJ CRM) [mydjcrm.com](https://mydjcrm.com/)
- **Performer type:** Wedding/mobile DJs and all event performers receiving inbound inquiries.
- **Feature it implies for us:** This is exactly the reactive engine (answer in minutes, in the owner's voice, approve-from-phone). It is the wedge — sell the verifiable "median response time" stat in the weekly report. Confirms ADR-003's repositioning ("answered in minutes").

### 2. "Stop making me chase — handle the follow-ups I always forget"
Follow-up is universally known to win bookings and universally neglected because it's tedious. Performers want it on autopilot.

- **Evidence:** "If you don't hear back after your initial response, a simple follow-up message… a day or two later… often makes the difference between winning or losing the gig" with a recommended 3/5/7-day cadence. (Be a Wedding DJ) [beaweddingdj.com](https://beaweddingdj.com/wedding-dj-gigs/)
- **Evidence:** Couples are "nearly **40% more likely to respond to Auto Follow-ups** than a manually sent vendor response." (WeddingPro) [pros.weddingpro.com](https://pros.weddingpro.com/blog/sales/still-waiting-to-hear-from-a-lead-heres-why/)
- **Evidence (product mirror):** DJ CRM pain list, verbatim: "Chasing leads in DMs," "Forgetting to follow up," "Writing the same emails over and over," "**Never Lose a Lead Again. Every inquiry tracked. Every follow-up handled.**" (MY DJ CRM) [mydjcrm.com](https://mydjcrm.com/)
- **Performer type:** DJs, bands, photographers (adjacent), all solo operators.
- **Feature it implies for us:** Our follow-up sequences until booked-or-dead — already in every tier per ADR-003. The pain quotes ("writing the same emails over and over") are gold for marketing copy.

### 3. "Ghosting after I've spent an hour on a proposal is killing me"
The flip side of follow-up: leads go silent, and the emotional/time cost is high. This is a 2025–2026 zeitgeist intensifier because inquiries are *down*.

- **Evidence:** "Ghosting [is a] nearly universal frustration across all categories." Couples "disappear after initial inquiries, after receiving proposals, or even after consultation calls." (Wedding Pro Survey 2025–26) [saradoesseo.com](https://saradoesseo.com/wedding-marketing/wedding-pro-survey-2025/)
- **Evidence:** "Couples may ghost after photographers have spent an hour on a custom proposal." (Fstoppers, adjacent) [fstoppers.com](https://fstoppers.com/opinion/why-so-many-photographers-are-burned-out-2025-702228)
- **Evidence:** 2026 booking confidence has collapsed — survey average booking level fell from **66% (2025) to 42% (2026)**; "budget mismatch" is the top non-conversion reason. [saradoesseo.com](https://saradoesseo.com/wedding-marketing/wedding-pro-survey-2025/)
- **Performer type:** All wedding/event vendors; acute for those who hand-craft quotes.
- **Feature it implies for us:** Automated, persistent, no-emotional-cost follow-up that the owner never has to feel awkward sending. Also strengthens the case for a **fast AI-drafted quote** (Stage 3 money path) so an hour of proposal effort isn't sunk on a ghost.

### 4. "I spend more time on admin than on my craft" — admin burnout
Performers increasingly frame inquiries/quotes/contracts/invoices as the thing eating their life, not the gig itself.

- **Evidence:** "The reality of running a wedding photography business often means more time on administrative tasks… than behind the lens, which is a recipe for burnout"; CRMs "handle inquiries, automated follow-ups, contracts, and invoices so [pros] stay in front of couples without manually chasing every email"; adopters report "**35% lower burnout**." (Fstoppers / Imagen, adjacent) [fstoppers.com](https://fstoppers.com/opinion/why-so-many-photographers-are-burned-out-2025-702228)
- **Evidence:** Survey's top emotional experiences for wedding pros: "burnout, inconsistent inquiries, and pricing anxiety." Top open-ended struggle quote: "**Having the time to do IT ALL.**" [saradoesseo.com](https://saradoesseo.com/wedding-marketing/wedding-pro-survey-2025/)
- **Evidence (product mirror):** DJ CRM targets "working DJs who want **less admin and more bookings**," mocking the status quo: "Still Running Your DJ Business Like This?" [mydjcrm.com](https://mydjcrm.com/)
- **Performer type:** Solo DJs, bands, all owner-operators.
- **Feature it implies for us:** The "AI back office" framing is exactly right. Lean into "more craft, less inbox" as a core promise. This is the emotional hook above the feature list.

### 5. "Help me get paid — deposits, retainers, and chasing the balance"
The money moment (deposit-to-close and collecting the balance) is a real, recurring friction point — and ADR-003 already names it the perception cliff.

- **Evidence (verbatim DJ forum):** "my contract says, $100.00 deposit is required to hold your date non-refundable" — redhotdj; "It's always a retainer, it's in the contract as nonrefundable." — nextgen1; the thread itself is titled "How do you handle deposit disputes?" (Our DJ Talk) [ourdjtalk.com](https://ourdjtalk.com/djchat/how-do-you-handle-deposit-disputes.38003/)
- **Evidence (product mirror):** DJ CRM sells "Lock In Gigs With Professional Contracts in Minutes," "**Get Paid Faster**" (invoices, deposits, payments), "send contracts in seconds, get them signed digitally." [mydjcrm.com](https://mydjcrm.com/)
- **Evidence:** Non-refundable deposits are the standard defense against "bargain DJs backing out for higher-paying gigs" and last-minute cancellations — an active 2025 industry concern. [financialcontent.com](https://markets.financialcontent.com/pennwell.industriallaser/article/prlog-2025-10-22-dj-expert-warns-couples-bargain-wedding-djs-are-backing-out-for-higher-paying-gigs-leaving-clients-scrambling)
- **Performer type:** DJs and bands taking deposits; anyone burned by a no-show booking.
- **Feature it implies for us:** Validates the v1.1 **money path** (quote → contract-lite e-sign → deposit via the artist's own link, zero custody). The deposit/contract feature is the #1 "substantive higher-tier feature" performers will pay more for — and the strongest answer to the founder's "higher tiers need real features, not gimmicks" worry.

### 6. "Booking myself into venues is a soul-crushing, low-response slog"
This is the demand signal that validates the **Hunt** (proactive gig-finding) — and it's underserved by every existing CRM, which only handles *inbound*.

- **Evidence:** "Standard booking emails have a **5% industry average response rate**"; "Booking a tour is a royal pain, with every venue having a different contact system and different requirements"; "cold calling in music rarely works." (search-snippet aggregation of musician booking discussions — *labelled inference on exact attribution; the 5% figure recurs across booking-tool marketing*) [bandsintown blog](https://artists.bandsintown.com/support/blog/bandsintown-hacks-that-ive-used-hundreds-of-times-to-book-more-and-better-live-shows)
- **Evidence:** For venue outreach, "generic messages are often ignored—applications that are clear and relevant usually perform better"; resorts, cruise ships and overseas venues "regularly recruit DJs for seasonal contracts and residency work." (DJ Agency) [djagency.co/dj-jobs](https://djagency.co/dj-jobs/)
- **Evidence:** DJs are explicitly advised to build "off-peak revenue through weekday corporate events" and proactively reach out — but it's manual, tedious, and most don't. (atouchofbusiness / Pioneer DJ) [blog.pioneerdj.com](https://blog.pioneerdj.com/dj-culture/a-djs-guide-to-the-world-of-corporate-and-private-events/)
- **Performer type:** Residency-seeking DJs, gigging bands, anyone with a slow season.
- **Feature it implies for us:** This is the **Hunt's** entire reason to exist and our biggest differentiator — every competitor (MY DJ CRM, HoneyBook, Check Cherry) only reacts to inbound. "It finds venues and drafts the personalized pitch in your voice" answers the exact "I hate cold-emailing and get 5% replies" pain. **Personalization is the explicit unlock** ("generic messages are ignored, relevant ones perform better") — the AI's voice-matching is the value, not just volume.

### 7. "Seasonality terrifies me — feast then famine"
Winter/off-peak income gaps are a recurring anxiety, and performers want a system that works *for* them when the phone is quiet.

- **Evidence:** "Build offers for off-peak months… to create steadier revenue"; "Hold cash reserves sized to cover key bills through a slow season." (atouchofbusiness) [atouchofbusiness.com](https://atouchofbusiness.com/startup-ideas/dj-business/)
- **Evidence:** "Every booking season brings anxiety about whether inquiries will come and convert." [saradoesseo.com](https://saradoesseo.com/wedding-marketing/wedding-pro-survey-2025/)
- **Performer type:** All event performers with seasonal demand.
- **Feature it implies for us:** The Hunt is the seasonality fix — it generates pipeline in the quiet months (this is also why ADR-003 likes deposit-chasing: balances come due in execution season when inquiries are quiet). Frame the Hunt as "your AI works hardest when your phone is quiet."

### 8. "Stop pricing me by 'number of leads' — give me a CRM that's actually built for performers, not generic"
Performers resent generic/over-featured tools (HoneyBook complexity) and per-lead pricing mechanics (Bark). They want something that speaks their language.

- **Evidence:** A whole micro-category now exists explicitly positioned as "built specifically for working DJs" vs. generic CRMs — MY DJ CRM, Lead Fuel CRM ("CRM for DJ Businesses"), promobile's "10 Ways Successful DJs Plan with CRM." [leadfuelcrm.com](https://leadfuelcrm.com/crm-dj) · [mydjcrm.com](https://mydjcrm.com/)
- **Evidence:** HoneyBook is repeatedly cited as the default but "easiest to learn" is the bar — implying others are *not* easy, and the broader survey flags admin overwhelm. [nurturepro.io](https://nurturepro.io/top-6-wedding-booking-software-guide-2025/)
- **Performer type:** DJs and bands who feel generic CRMs are bloated and not for them.
- **Feature it implies for us:** Directly validates the founder's pricing pivot — **gate on "how hard the AI works for you" (cadence, coverage, autonomy, substantive money-path features), not on a lead count that reads like a broken promise.** Per-lead framing is the *resented* anti-pattern (Bark). The "built for performers, white-label, your voice" positioning is the differentiator.

---

## The 5-bullet zeitgeist read — what makes a performer go "finally, someone gets it" in 2026

1. **"It replies before I even see the inquiry — and I still sound like me."** The deepest 2026 craving is winning the speed-to-lead race *without* sitting on the phone, because ~50% of bookings go to the first responder and performers know they're losing gigs to faster competitors. An AI that drafts (or, on higher autonomy, auto-sends) a personalized, voice-matched reply in minutes — that the owner approves from their phone — is the "finally" moment. This is Bright Ears' wedge; lead with it.

2. **"It hunts for gigs while I sleep, instead of me cold-emailing into the void."** No existing CRM does proactive outreach — they all wait for inbound. Performers describe self-booking into venues as a 5%-response slog they avoid. An agent that finds fitting venues and drafts a *relevant, personalized* pitch in their voice is genuinely novel and directly answers the most-hated part of the job. This is the unique story no competitor can tell.

3. **"It takes a stranger all the way to a signed, paid deposit."** The perception cliff and the willingness-to-pay-more both live at the close. Contracts + e-sign + deposit-collection is what the funded competitors (MY DJ CRM, HoneyBook, Check Cherry) charge premium for, and what performers will happily pay more for — because it's the difference between "a tool that chats" and "a tool that books and gets me paid." This is the right substantive higher-tier feature (validates ADR-003 Stage 3), far better than per-tier model swaps that complicate margin.

4. **"It gives me my craft back."** The emotional center of 2026 is burnout: "having the time to do IT ALL," more hours on admin than on the art, ghosting after hand-built proposals. The winning pitch isn't a feature list — it's "more time on your craft, less in your inbox," proven by a weekly report (median response time, gigs booked). Sell the relief, not the CRM.

5. **What they'll happily pay MORE for (ranked):** (a) the money path — contracts, e-sign, deposit collection (close + get-paid); (b) more aggressive Hunt — wider geographic coverage (home city → metro → region → travel/residency/cruise gigs), higher cadence, deeper research, more opportunities surfaced; (c) auto-send autonomy so they don't even have to tap Approve; (d) multi-performer/team routing for small agencies. They will NOT pay more for "more leads as a number" — that reads as a promise you can't keep and is the resented Bark mechanic. Price the *work the AI does and the outcomes it closes*, exactly as the founder's instinct says — and put per-gig math ("one saved $1,800 gig = years of subscription") next to every tier.

**Internal files referenced (absolute paths):** `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/CLAUDE.md`, `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/docs/ADR-003-scope-vs-price.md`. The demand signals above corroborate the ADR-003 tier recut (capacity/autonomy-gated, never capability-gated), validate the v1.1 money path as the top paid-upgrade lever, and support replacing the "N leads/mo" gate with a "how hard the AI works for you" axis (cadence + geographic coverage + autonomy + substantive money-path features).


---

# Appendix C — Effort-axis design

I now have all the figures I need. Let me compose the design.

---

# Bright Ears effort-based pricing axis — design

Compiled 2026-06-16. The job: turn "the AI works harder at higher tiers" from a slogan into concrete dials we can **meter, prove, and word honestly** — never implying a guaranteed gig count. Grounded in `CLAUDE.md` rule 10 (per-purpose model map, ≥70% margin), `lib/billing/metering.ts` (inbound leads-handled cap), `lib/outreach/caps.ts` (Hunt's flat shared pitch caps), and ADR-003 (capacity/autonomy-gated, never capability-gated). Verified-pricing figures cited inline.

---

## 1. The dials — which are honest+meaningful, and how to word them

There are two engines and they have different honest axes. The Hunt (proactive) is where the real new tier story lives; inbound (reactive) is already honestly metered.

### A. The HUNT (proactive) — six candidate dials

| Dial | What we turn | Honest + meaningful? | How to WORD it (no guaranteed-gig implication) | Meter (what we already log) |
|---|---|---|---|---|
| **Scan cadence** | How often the Hunt re-scans sources: daily → twice-daily → every few hours | **YES — best dial.** Pure effort, fully provable, zero outcome-promise. More scans = fresher venues, faster than competitors. | "We check for new openings **once a day** / **every few hours** / **continuously**." Never "more gigs." | Scan-run timestamps per tenant |
| **Geographic coverage** | Radius the Hunt searches: home city → metro → region/neighbouring cities → travel/residency/cruise | **YES — strong.** Tangible, the artist literally chooses where; maps to the real demand signal (seasonal residency / travel gigs). | "We hunt your **home city** / **whole metro** / **region + neighbouring cities** / **travel & residency markets**." Describes *where we look*, not *what we'll land*. | Geo scope field on tenant + venue rows already carry location |
| **Research depth / enrichment** | How many passes per venue, how much we enrich (contact, recent events, fit rationale) before surfacing | **YES.** This is the AiSDR/Clay "enrichment depth" axis. Honest because it's input effort. | "**Standard fit-check** vs **deep research** — we read recent event history and tailor the angle." | Enrichment pass count + tokens per VenuePitch (we log `LlmUsage`) |
| **# vetted opportunities surfaced/week** | The count of scored, ready-to-review venue cards we put in front of the artist | **YES — if worded as surfaced, not delivered.** This is the honest twin of "N leads." "We *surface* N" ≠ "you'll *book* N." | "Up to **N vetted opportunities a week**, ready for your one-tap approve." Always "surfaced/vetted," never "leads you'll win." | VenuePitch rows created/week |
| **Outbound send volume / day** | The daily pitch send cap (today flat HOT 10 / WARM 5 / SEED 3, ≤18/day, shared) | **YES, with care.** Effort the agent expends on your behalf. But keep it modest — deliverability discipline (ADR-004) caps it anyway. | "Up to **N personalized pitches a day**, sent from your own mailbox." | `DAILY_SEND_CAPS` in `lib/outreach/caps.ts` |
| **Autonomy (co-pilot → autopilot)** | Approve-every-send → per-source auto-send for proven HOT/WARM | **YES — headline axis.** Category-validated (Artisan sells "co-pilot vs autopilot"). Honest: more trust → more automation. Margin-neutral. | "**You approve every pitch** (Starter) → **auto-send to vetted hot venues, you just watch** (higher)." | Per-source auto-send flag |

**Dials to AVOID / handle carefully:**
- **"N leads delivered / gigs found"** — the trap. Chargebee's AI-pricing playbook names outcome-metering as the thing to avoid when you can't guarantee the outcome ([chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)). This is the whole reason we're re-axing. Never phrase any dial as a result.
- **Exposed model name per tier** — see §2; do it as "research depth," not "Starter gets DeepSeek, Studio gets Claude."

### B. INBOUND (reactive) — already honest, keep it

| Dial | Honest? | Wording |
|---|---|---|
| **Leads handled / mo** (today 15/60/150 in `metering.ts`) | **YES.** "Handled" ≠ "delivered." We process inquiries the artist *receives*; we don't promise to generate them. | "We handle up to **N inquiries a month** — reply, follow up, until booked-or-dead." Keep the pause-don't-bill behavior — it's the soft-ceiling the playbook prescribes. |
| **Performers / team seats / brands** | **YES.** Pure capacity (Check Cherry model). | "**1 performer** → **multi-performer routing + team seats**." |
| **Autonomy on replies** | **YES.** Same co-pilot→autopilot ladder as the Hunt. | "Approve every reply → auto-send routine replies." |

**The one-line rule for all copy:** every dial describes **what the AI does** (scans, researches, drafts, sends, handles), never **what you'll get** (gigs, bookings, revenue). "Surfaced," "vetted," "handled," "pitched" are safe verbs; "delivered," "won," "booked-for-you" are not.

---

## 2. Model-per-tier + margin — the founder's worry, answered directly

**Recommendation: do NOT tier the model name. Keep ONE per-purpose model map across all tiers, and tier the EFFORT (passes, enrichment, cadence, candidate count) instead. Where premium justifies a stronger model, swap it silently inside "deep research" and let the margin math (below) keep ≥70%.**

### Why — the unit economics

Verified June 2026 pricing (OpenRouter / DeepSeek):
- DeepSeek V4 Flash: **$0.14/M in, $0.28/M out** ([deepseek.ai](https://deepseek.ai/pricing), [cloudzero](https://www.cloudzero.com/blog/deepseek-pricing/))
- DeepSeek V4 Pro: **$0.435/M in, $0.87/M out** ([devtk.ai](https://devtk.ai/en/models/deepseek-v4/), matches CLAUDE.md)
- Claude Sonnet 4.6: **$3/M in, $15/M out** ([openrouter](https://openrouter.ai/anthropic/claude-sonnet-4.6))
- Claude Opus 4.5+: **$5/M in, $25/M out** (stable across 4.5–4.8) ([openrouter](https://openrouter.ai/anthropic/claude-opus-4.5))

**Per-unit token assumptions** (conservative; we log real numbers via `LlmUsage`):
- One inbound lead fully handled (parse + triage + draft + ~2 follow-ups) ≈ **8K in / 3K out** tokens.
- One Hunt pitch (research + score + draft) ≈ **12K in / 2K out** tokens (deep research ≈ 2–3× the input).

**Cost per unit by model:**

| Unit | DeepSeek (Flash triage + Pro draft, blended) | Claude Sonnet 4.6 | Claude Opus 4.5 |
|---|---|---|---|
| **1 inbound lead** (8K in / 3K out) | ≈ **$0.006** (<1¢, matches CLAUDE.md) | 8K×$3 + 3K×$15 = $0.024 + $0.045 = **$0.069** | $0.040 + $0.075 = **$0.115** |
| **1 Hunt pitch** (12K in / 2K out) | ≈ **$0.007** | $0.036 + $0.030 = **$0.066** | $0.060 + $0.050 = **$0.110** |
| **1 deep-research pitch** (30K in / 3K out) | ≈ **$0.016** | $0.090 + $0.045 = **$0.135** | $0.150 + $0.075 = **$0.225** |

### What this does to margin per tier

Take a worst-case heavy month (artist maxes both allowances) and compute LLM COGS, then gross margin = (price − COGS) / price. (Ignoring Stripe ~3% and email — both tiny; LLM is the dominant variable cost.)

**Scenario 1 — all DeepSeek (the recommendation):**

| Tier | Price | Leads/mo | Pitches/mo (~18/day×22 working ≈ 400 cap, realistic ~150) | LLM COGS (heavy) | Gross margin |
|---|---|---|---|---|---|
| Starter | $25 | 15 | ~60 | 15×$0.006 + 60×$0.007 = $0.09 + $0.42 = **$0.51** | **98%** |
| Pro | $79 | 60 | ~150 | 60×$0.006 + 150×$0.007 = $0.36 + $1.05 = **$1.41** | **98%** |
| Studio | $149 | 150 | ~300 | 150×$0.006 + 300×$0.007 = $0.90 + $2.10 = **$3.00** | **98%** |

DeepSeek leaves us with ~98% gross margin even maxed out. There is enormous headroom.

**Scenario 2 — Studio runs deep research + Hunt drafting on Claude Sonnet 4.6:**

| Tier | Price | Heavy COGS if premium model used for Hunt research+draft | Gross margin |
|---|---|---|---|
| Studio | $149 | 150 leads (DeepSeek) $0.90 + 300 deep-research pitches × $0.135 = $40.5 → **$41.40** | **72%** |

Even the *aggressive* version — putting Claude Sonnet on every one of 300 deep-research pitches at the Studio cap — lands at **72%, still above the 70% floor**, but it eats most of the headroom and is fragile (one heavy user, or a token-count surprise, breaches it). **Opus would break it**: 300 × $0.225 = $67.50 → 55% margin. **Verdict: never put Opus in the production pitch path; Sonnet only if evals prove DeepSeek can't write a good enough pitch, and only on the deep-research pass, capped.**

### The clean recommendation

1. **Keep the per-purpose model map internal and model-agnostic** (CLAUDE.md rule 10). The buyer never sees a model name — that's the rule that protects you when model costs swing ~10× a year ([chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)).
2. **Tier EFFORT, not the model.** Higher tiers buy *more passes, deeper enrichment, more cadence, more candidates* — all on the same cheap models. This is what AiSDR (sends/mo) and Clay (enrichment depth) do. 98% margin, trivially ≥70%.
3. **If — and only if — the eval harness shows DeepSeek writes mediocre pitches**, upgrade the `draft`/Hunt-research model to Sonnet *for the deep-research pass on Pro/Studio only*, frame it to the buyer as "deeper research," and the math above shows you still clear 70%. Let evals pick the model; never hard-anchor a tier to a named model.
4. **Hard guardrail:** the existing `LlmUsage` per-tenant margin alert (rule 8, <70% trips it) already protects you. Add a per-tier soft cap on deep-research passes so a single heavy Studio user can't drag the cohort under 70%.

---

## 3. Three candidate tier structures

All three keep prices at **$25 / $79 / $149** (ADR-003 locked: lowering signals toy, raising breaks "same price as GigBuilder, but it answers for you"), keep **every capability in every tier**, keep the **14-day free-Pro trial, no card**, and re-axis the Hunt (today's flat shared caps in `lib/outreach/caps.ts`) onto effort dials.

---

### Candidate A — "Cadence + Coverage ladder" (recommended)

The Hunt's two most tangible dials (how often, how far) carry the ladder; autonomy and the money-path features layer on top.

| | **Starter — $25** | **Pro — $79** | **Studio — $149** |
|---|---|---|---|
| Tagline | "Never the last to reply." | "Your AI hunts while you sleep." | "A back office for your whole roster." |
| **Inbound leads handled/mo** | 15 | 60 | 150 |
| **Hunt scan cadence** | Once a day | Every few hours | Continuous (near-real-time on HOT) |
| **Hunt coverage** | Home city | Whole metro | Region + neighbouring cities + **Travel/residency mode** |
| **Vetted opportunities surfaced/wk** | up to ~10 | up to ~30 | up to ~60 |
| **Research depth** | Standard fit-check | Deep research on HOT/WARM | Deep research on all + recent-event tailoring |
| **Pitches sent/day** | up to 6 | up to 12 | up to 18 |
| **Autonomy** | Approve every send (both engines) | Per-source **auto-send** on proven HOT/WARM | Full autopilot + auto-routing |
| **Performers / seats** | 1 performer | 1 performer | Multi-performer + team seats + multiple brands |
| **Money path (v1.1)** | ✓ quote→e-sign→deposit link | ✓ | ✓ |
| Heavy-month LLM COGS | $0.51 | $1.41 | $3.00 |
| Gross margin | 98% | 98% | 98% |

**Why it's the recommendation:** cadence and coverage are the *most provable, least promise-y* dials — the artist literally sees "checked every 3 hours, searched your whole region" in the weekly report. They map 1:1 to the demand signals (speed-to-lead, seasonal/travel residency gigs) and to the mature analogs (AiSDR send-cadence tiers, Clay enrichment depth). The per-day pitch caps stop being flat-and-shared (the thing with no tier story in `lib/outreach/caps.ts`) and become a clean ladder. Margin is untouched.

---

### Candidate B — "Autonomy-forward ladder"

Make autonomy the headline (Artisan's proven co-pilot→autopilot axis), with cadence/coverage as supporting detail.

| | **Starter — $25** | **Pro — $79** | **Studio — $149** |
|---|---|---|---|
| Tagline | "You approve, it does the rest." | "Set it to autopilot." | "Runs your roster on autopilot." |
| Inbound leads/mo | 15 | 60 | 150 |
| **Headline: Autonomy** | **Co-pilot** — approve every reply *and* every pitch | **Autopilot on outbound** — auto-send vetted HOT/WARM pitches; approve inbound | **Full autopilot** — auto-send inbound routine replies + outbound, exceptions only |
| Hunt cadence | Daily | Every few hours | Continuous |
| Hunt coverage | Home city | Metro | Region + Travel |
| Surfaced/wk | ~10 | ~30 | ~60 |
| Performers/seats | 1 | 1 | Multi + team + brands |
| Money path | ✓ | ✓ | ✓ |
| Gross margin | 98% | 98% | 98% |

**Trade-off:** autonomy is the most *differentiated* axis (no inbound CRM offers it) and category-validated. But selling "Starter makes you approve everything" risks making the entry tier feel like withheld convenience rather than a complete product — adjacent to the HoneyBook "crippled entry tier" anti-pattern ADR-003 warns against. Autonomy is better as a *strong secondary* dial (as in A) than the primary gate.

---

### Candidate C — "Reach ladder" (coverage-led, simplest to explain)

One dominant dial — geographic reach — for maximum buyer clarity. Everything else rides along.

| | **Starter — $25** | **Pro — $79** | **Studio — $149** |
|---|---|---|---|
| Tagline | "Owns your city." | "Owns your region." | "Goes where the gigs are." |
| **Headline: Coverage** | Home city | Metro + region | Region + **Travel/residency/cruise markets** |
| Inbound leads/mo | 15 | 60 | 150 |
| Cadence | Daily | Every few hours | Continuous |
| Surfaced/wk | ~10 | ~30 | ~60 |
| Autonomy | Approve all | Auto-send HOT/WARM | Full autopilot |
| Performers | 1 | 1 | Multi + team |
| Money path | ✓ | ✓ | ✓ |
| Gross margin | 98% | 98% | 98% |

**Trade-off:** dead simple to explain and the coverage dial maps perfectly to the seasonality/travel demand signal. But a single dial leaves the middle tier thin (Pro = "region" is a small step from Starter "city"), and it underuses autonomy and the money path as differentiators. Good marketing framing, weaker as the actual gate structure.

---

## 4. Recommendation — Candidate A, with B's autonomy framing in the copy

**Ship Candidate A.** Reasons:

1. **It gives the Hunt a real tier story for the first time.** Today `lib/outreach/caps.ts` is flat and shared across plans — the Hunt can't justify sitting higher on the ladder. Cadence + coverage + surface-count turn it into three honest, laddered dials. This is the core thing the founder asked for.
2. **Every dial is provable and promise-free.** "Checked every few hours, searched your whole region, surfaced 30 vetted opportunities" all show up verbatim in the weekly report — effort *felt*, not a gig count promised. Passes the Chargebee honesty test ([chargebee](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)).
3. **It matches both research bodies.** Cadence/coverage/depth = AiSDR send-volume + Clay enrichment-depth (adjacent pricing). Travel/residency coverage + the money path = the top-ranked "pay more for" items in the demand research.
4. **Autonomy and the money path are real, substantive higher-tier weight** — not gimmicks — exactly answering the founder's "higher tiers need real features" worry. Borrow B's autonomy *wording* ("you just tap Approve → set it to autopilot") in the Pro/Studio marketing copy without making autonomy the primary gate (which risks the crippled-entry-tier feel).
5. **Margin is a non-issue on the recommended model strategy** — 98% gross margin maxed out, vs the 70% floor. Tiering effort (not model name) is what keeps it there.

### Concrete next steps in code
- **`lib/outreach/caps.ts`**: replace the flat `DAILY_PITCH_CAPS` / `DAILY_SEND_CAPS` records with a `Record<PlanTier, Record<VenueTemperature, number>>` so per-day pitch room ladders by tier (Starter ≤6 / Pro ≤12 / Studio ≤18). Add a `SCAN_CADENCE` and `GEO_SCOPE` map keyed by `PlanTier`.
- **`lib/billing/metering.ts`**: inbound caps (15/60/150) stay exactly as-is — already honest.
- **Add a per-tenant usage meter surface** (cadence used, pitches sent, leads handled, opportunities surfaced) so the effort is *visible* — the playbook's "make the soft ceiling and the effort felt" prescription, and the thing that keeps an effort axis honest.
- **Model map stays internal** (`lib/llm`); if evals later justify Sonnet on the deep-research pass for Pro/Studio, gate it by a `researchDepth` effort flag, not a tier-named model, and keep the deep-research pass count capped so the cohort stays ≥70%.

---

**Sources:** [chargebee AI-pricing playbook](https://www.chargebee.com/blog/pricing-ai-agents-playbook/) · [OpenRouter — Claude Sonnet 4.6 ($3/$15)](https://openrouter.ai/anthropic/claude-sonnet-4.6) · [OpenRouter — Claude Opus 4.5 ($5/$25)](https://openrouter.ai/anthropic/claude-opus-4.5) · [DeepSeek pricing — V4 Flash $0.14/$0.28](https://deepseek.ai/pricing) · [CloudZero — DeepSeek V4 pricing](https://www.cloudzero.com/blog/deepseek-pricing/) · [devtk.ai — DeepSeek V4 Pro $0.435/$0.87](https://devtk.ai/en/models/deepseek-v4/). Internal: `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/CLAUDE.md` (rule 10, pricing), `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/billing/metering.ts`, `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/outreach/caps.ts`, `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/docs/ADR-003-scope-vs-price.md`.

**Caveat:** per-unit token counts (8K/3K inbound, 12K/2K pitch) are conservative estimates — `LlmUsage` logs the real numbers; re-run the margin math against actual tenant data before any model-tiering decision. Third-party-sourced model prices drift; re-verify against vendor pages before they touch customer copy (the `LAST_VERIFIED` discipline in `comparisons.ts`).


---

# Appendix D — Feature-ladder design

I have everything I need. Travel Mode (`TravelWindow`), the profile/EPK system, `bookingLinkUrl`, voice profile, multi-performer (`Performer`/`Member`), and the venue Hunt are all built. Now I'll write the prioritized feature ladder.

# Bright Ears — the SUBSTANTIVE feature ladder

**One rule above all (ADR-003 + the adjacent-pricing playbook agree):** Bright Ears is **capacity/autonomy-gated, never capability-gated**. Every paying tier is the *complete* assistant. So "which tier does feature X live in?" almost always answers **"available to all — it's a capacity/autonomy/seat dial, not a paywall on the feature itself."** The few true Studio-only gates below are the *resource* kind (extra performers, extra brands, extra seats) that competitors gate too (Dubsado, HoneyBook) — those are real, not gimmicks. Capability paywalls (HoneyBook stripping automations from its entry tier) are the explicitly named anti-pattern; we don't copy them.

Two things determine "what justifies a higher tier" here:
1. **More of the agent's effort** (cadence, geographic coverage, autonomy, research depth) — the honest re-axis off "N leads."
2. **More back-office *resource*** (performers, brands, seats) — the Check-Cherry capacity gates.

The **money path** (quote → e-sign → deposit link) is the highest-leverage *new capability* — but per ADR-003 it ships **to all tiers**, so it's a churn/retention and willingness-to-pay-MORE-overall lever, not a between-tier gate. I keep that distinction sharp below because conflating them would re-create the HoneyBook anti-pattern.

---

## The 4 MUST-HAVES (highest leverage — build/expose these first)

These are the features that most move someone *up* the ladder, ranked by leverage. Two are between-tier gates; two are all-tier capabilities that raise the whole product's price ceiling and crush churn.

### ★1. The Money Path — quote → contract-lite e-sign → deposit via the artist's OWN link
- **Tier:** **available to all** (ADR-003 locks this — ships to every tier). It is the single biggest reason someone pays Bright Ears *at all* vs a $25 toy, and the #1 retention control point.
- **Demand:** strongest, most-cited paid-upgrade signal. "It takes a stranger all the way to a signed, paid deposit" is the perception cliff; the funded competitors (Mikla's $249 tier, HoneyBook, Check Cherry) all charge premium for exactly this; performers report ghosting "after an hour on a custom proposal" and active deposit-dispute pain ("$100 deposit is required to hold your date non-refundable"). Retention physics: money/back-office control points show the highest net retention in vertical SMB; single-trick AI tools churn 50–70%.
- **Build:** **L** (~2.5–4 weeks per ADR-003). Net-new. Bounded scope is already designed: AI quote pre-filled from the existing `Package` rate card + parsed lead → contract-lite e-sign (typed-name + checkbox + SHA-256 hash + IP/timestamp; ESIGN/UETA-sufficient) → deposit via the DJ's own payment link (**zero custody** — Stripe Connect is unavailable to a Thailand-based platform, this is a hard constraint, not a choice).
- **Roadmap fit:** **exact** — Stage 3, gated on Gate 1 pass (≥10 paying, ≥3 arms-length). Its own success gate: ≥30% of active customers send a deposit request within 30 days. Do **not** build before Gate 1.
- **Gate vs all:** all-tier capability. *Leverage comes from raising the whole price ceiling and stickiness, not from fencing it into Studio.*
- **Built today:** the cheap interim already exists — `Business.bookingLinkUrl`, carried in closing replies + day-2/5/9 nudges (`lib/agent/voice.ts`, `generate-for-lead.ts`). That's the bridge until the real builder ships.

### ★2. Hunt coverage + cadence (the proactive engine's tier story) — re-tier the shared caps
- **Tier:** **the gate itself.** This is the cleanest honest answer to the founder's whole problem. Today the Hunt is *flat across all plans* (`lib/outreach/caps.ts`: HOT 10/WARM 5/SEED 3, ≤18/day, shared) and daily scans run once at 05:00 UTC — so the Hunt currently has **zero tier story.** Give it one on axes that promise *effort, never a result*:
  - **Scan cadence:** Starter = once daily → Pro = a few times daily → Studio = ~3-hourly. (ROADMAP 10.8 already lists "cadence tiers daily / ~3-hourly wired to plans" as planned — this is sanctioned, partly-specced, not net-new thinking.)
  - **Geographic coverage:** Starter = home city → Pro = metro/region → Studio = **Travel Mode** tour-city hunting (already built: `TravelWindow`, `app/actions/travel.ts`). Travel Mode is a *perfect* premium gate — it's real, differentiated ("hunts gigs in the cities you tour to, for the dates you're there"), and already in marketing copy.
  - **Research depth / surface count:** higher tiers surface more scored opportunities per scan and richer enrichment.
- **Demand:** "Booking myself into venues is a soul-crushing 5%-response slog" — the Hunt's reason to exist, and the one thing no competitor does. Also the seasonality fix ("your AI works hardest when your phone is quiet"). Adjacent validation: AiSDR meters on sends/mo, Clay on enrichment depth, Artisan on leads-contacted — all "how hard the agent works," none "leads delivered."
- **Build:** **M.** Cadence-by-plan = scheduling change to the discovery cron + a plan lookup (the caps module is already pure and plan-agnostic; you're adding a plan dimension). Coverage tiers = gating the metro/region query battery and Travel Mode by plan. The engine, temperature model, and Travel Mode all exist (Phase 10.1–10.5).
- **Roadmap fit:** **strong** — 10.8 is the home; partly pre-committed.
- **Gate vs all:** **between-tier gate** (cadence + radius + Travel Mode). Keep the *per-day pitch caps* gated by profile quality (not tier) as today, so quality discipline survives — only cadence/coverage/depth move up the ladder.

### ★3. Auto-send autonomy ladder (co-pilot → autopilot) — already the spine, make it the headline
- **Tier:** **the gate.** Starter = approve every send; Pro = per-source auto-send autopilot; Studio inherits + adds (e.g. auto-send to HOT/WARM venues after the profile proves out). This is **already the founder-confirmed gate** and largely built (reactive auto-send is the Pro line; venue-pitch approve/auto flows exist in `lib/agent/venue-pitch.ts`).
- **Demand:** "It replies before I even see the inquiry — and I still sound like me" / "so I don't even have to tap Approve." Adjacent validation is unusually clean: **Artisan explicitly sells "co-pilot vs autopilot"** as a tier axis. It's honest (more trust → more automation), **margin-neutral** (directly addresses the founder's margin worry — no model swap needed), and category-proven.
- **Build:** **S–M.** Mostly *exposing and sharpening* what exists into a clear three-rung autonomy story across both halves (reactive replies AND venue pitches), plus per-source granularity on higher tiers.
- **Roadmap fit:** core (Phase 3/4 reactive; 10.5 proactive). Net-new work is small.
- **Gate vs all:** **between-tier gate.** Lead with it — it's the most defensible, lowest-cost tier differentiator you have.

### ★4. Analytics & insights — the weekly report grown into a real dashboard
- **Tier:** **available to all** as the basic weekly report (already built, `lib/reports/weekly.ts`: median first-reply, leads in, spam filtered, booked); **deeper insights as a Studio lean** (multi-performer leaderboards, venue conversion rates, Hunt ROI, source breakdown).
- **Demand:** "more time on craft, less in my inbox — *proven* by a weekly report." The report is the **honesty mechanism** that makes an effort-based ladder *felt*: it's how you prove the agent worked without ever promising N leads. The pricing playbook prescribes real-time usage visibility to keep an effort axis honest. Owners want proof, not promises.
- **Build:** **S** (weekly report exists) → **M** for an in-product dashboard + usage meter (cadence used, pitches sent, leads handled) and multi-performer/venue-conversion cuts.
- **Roadmap fit:** weekly report ✅ built; the dashboard/usage-meter is an audit-flagged "OPTIONAL polish" item (at-cap banner, usage surfacing).
- **Gate vs all:** basic = all tiers; advanced cuts = Studio lean. Don't over-gate — visibility is trust.

---

## The full ladder (every candidate, prioritized within each group)

### Group A — between-tier GATES (the honest axes that move someone up)

| Feature | Tier placement | Demand evidence | Build | Built vs new |
|---|---|---|---|---|
| **Auto-send autonomy (co-pilot→autopilot)** ★3 | Starter approve-all → Pro per-source autopilot → Studio HOT/WARM venue auto-send | "so I don't even tap Approve"; Artisan sells co-pilot/autopilot as a tier axis | S–M | **Mostly built**; expose + per-source granularity |
| **Hunt cadence** ★2 | daily → few-times-daily → ~3-hourly | seasonality fear; AiSDR meters sends/mo | M | Engine built; cadence-by-plan is new (ROADMAP 10.8 pre-committed) |
| **Hunt geographic coverage + Travel Mode** ★2 | home city → metro/region → Travel Mode tour cities | "5%-response cold-email slog"; residency/cruise/tour demand | M | Travel Mode **built** (`TravelWindow`); plan-gating is new |
| **Hunt research depth / surface count** ★2 | more scored opps + richer enrichment higher up | "generic messages ignored, relevant ones perform" → depth = personalization | M | Scoring built; depth-by-plan new |
| **Inbound leads handled** | 15 → 60 → 150/mo | Check-Cherry capacity model; "leads handled ≠ promised" | — (built) | **Built** (`lib/billing/metering.ts`) — keep, it's the honest capacity dial |
| **Multi-performer roster** | Studio gate | small agencies route per performer | S–M | **Mostly built** (`Performer` model, availability routing); needs roster UI/limits |
| **Team seats** | Studio gate | Dubsado/HoneyBook gate seats — real, niche-normal | M | `Member` model exists; seat limits/invites new |
| **Multiple brands / sub-accounts** | Studio gate (or add-on) | Dubsado/HoneyBook both gate multi-brand — clean, real Studio gate | M | Net-new; white-label EPK (`/epk/[slug]`) is the substrate |

**On "smarter model per tier" (priority model):** evaluated and **recommend AGAINST exposing it as a tier feature.** The founder's margin worry is correct and the agent-pricing playbook backs it (model costs swing ~10x/yr; never hard-anchor a tier to a named model). Instead, let higher tiers buy **more effort with the same models** — deeper research passes, more enrichment, more candidates scored. If premium ever justifies stronger reasoning, frame it to the buyer as **"deeper research,"** meter the *effort*, and let the eval harness pick the model (CLAUDE.md rule 10 keeps the per-purpose model map internal). **Do not** put a model name on a pricing card. Build: N/A (it's a non-feature). This is a deliberate "don't build the gimmick" call.

### Group B — all-tier CAPABILITIES (raise the whole ceiling + crush churn; not between-tier gates)

| Feature | Tier placement | Demand evidence | Build | Built vs new |
|---|---|---|---|---|
| **Money Path: quote → e-sign → deposit link** ★1 | **all tiers** (ADR-003) | strongest paid-upgrade signal; ghosting-after-proposal; deposit disputes; retention physics | L (~3wk) | **Net-new**; `bookingLinkUrl` is the interim bridge ✅ |
| **Analytics & insights** ★4 | basic all-tier; deep cuts Studio-lean | "prove it with a report"; usage visibility keeps effort honest | S→M | Weekly report **built**; dashboard new |
| **Client/lead CRM** | all tiers | "writing the same emails over and over," "never lose a lead again" | S | **Largely built** — pipeline by status, lead detail, thread, sequences exist. This is *already shipped*, just not branded "CRM." Don't over-claim; it's a lead pipeline, not a full client-management suite (which is a fenced non-goal). |
| **Deeper personalization / voice training** | all tiers; richer on higher (more samples, per-segment tone) | "I still sound like me" is the whole white-label promise | S–M | **Built** (`lib/agent/voice.ts`, voice samples, tone chips). Enhancement = more samples + per-channel/per-event-type voice. Genuinely wanted, low risk. |
| **Review / referral automation** | all tiers, post-BOOKED | wedding-pro survey: reviews/referrals are the cheap-acquisition lever; ghosting makes word-of-mouth precious | M | Net-new; BOOKED status + sequence engine are the substrate. Solid, but **after** the money path. |
| **Calendar / availability sync (external)** | all tiers | "real availability" honesty; double-booking dread | M–L | **Internal calendar built** (`Gig` CRUD, conflict logic). *External* Google/iCal sync is net-new and OAuth-touching — **defer.** Note: ADR-003's email-spine rule keeps OAuth out of the reactive path; external calendar sync reintroduces it, so weigh carefully. |
| **Integrations (Zapier, etc.)** | all tiers / Studio-lean | the literal r/mobileDJ spec quote: "none of them integrate with Zapier" | M | Net-new. Real demand, but a **later** lever — bolt-on-via-forwarding is the current integration story and it works. |

---

## Honest "built vs net-new" summary

- **Already shipped (don't re-sell as new, just expose/sharpen):** lead pipeline/CRM, voice profiles, internal calendar + availability conflict logic, follow-up sequences, weekly report, the entire Hunt engine + temperature model, **Travel Mode**, multi-performer model, auto-send plumbing, `bookingLinkUrl` interim close.
- **Net-new and worth building, in order:** (1) **Money Path** [L, gated on Gate 1], (2) **Hunt cadence/coverage tiering** [M, gives the Hunt its missing tier story], (3) **autonomy ladder polish + per-source** [S–M], (4) **analytics dashboard + usage meter** [S–M], then review/referral automation [M], multi-brand/seats for Studio [M], and *later* external calendar sync + Zapier.

## The single sharpest takeaway for the founder
You don't need a pile of new features to justify higher tiers — you need to **re-axis what you already built.** The honest ladder is: **autonomy (co-pilot→autopilot) + Hunt cadence + Hunt coverage/Travel Mode + roster/seats** as the *gates*, and the **Money Path + richer voice + analytics** as *all-tier capabilities* that lift the whole price ceiling and kill churn. The only true L-effort build is the Money Path, and it's already scoped, gated, and sequenced. Resist a per-tier model swap — sell "deeper research" (effort), not a model name, and your margin math stays clean.

**Key internal files:** `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/docs/ADR-003-scope-vs-price.md` · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/ROADMAP.md` (Phase 10.8 = cadence tiers; Phase 9 Gate 1) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/outreach/caps.ts` (the flat shared caps to re-tier) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/billing/metering.ts` (lead capacity dial) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/app/actions/travel.ts` + `prisma/schema.prisma` `TravelWindow` (Travel Mode, built) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/agent/voice.ts` (voice + `bookingLinkUrl` interim close) · `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/reports/weekly.ts` (analytics substrate).