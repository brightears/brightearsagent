# Bright Ears — Decision-Ready Memo (2026-06-16)

*Synthesized from the Stripe audit, no-trial coherence audit, and what-next strategy review. All findings verified against code on `main` (staging, TEST Stripe keys).*

---

## 1. Stripe — must-fix before any real money flows

Ranked by blast radius. Money is not live yet, so **none of these has cost you a dollar — but every one is a live trap the moment you flip to live keys.** Fix all four HIGH/MED before that switch.

| # | Severity | The hole | One-line fix |
|---|----------|----------|--------------|
| **S1** | **HIGH** | `applySubscriptionState` is a file-level `"use server"` export with **no auth and no tenant check** — anyone who derives the action ID can POST `{businessId, plan:"STUDIO"}` and grant *any* tenant a free paid plan (or sabotage a competitor). It's also dead code. | **Delete the function.** The webhook does its own update; nothing imports it. |
| **S2** | **HIGH** | `checkout.session.completed` activates a paid plan on the *presence of a subscription id alone* — never checks `payment_status`/`status`. An authorize-then-fail / abandoned-3DS flow leaves a never-charged tenant running the full agent. | Activate only when `session.status==="complete"` **and** `payment_status` is `paid` or `no_payment_required` (keep the latter — it's the 100%-off promo path). |
| **S3** | **HIGH** | Subscription events resolve the tenant *only* by `stripeSubscriptionId`. On re-subscribe or out-of-order delivery the id matches no row → `if (!business) break;` silently drops the event. Stripe won't retry (you returned 2xx). Permanent desync: downgrade sticks, or cancel never pauses the agent. | Resolve by `subscription.metadata.businessId` (already set at `billing.ts:46`) and/or `stripeCustomerId`; treat current status as source of truth. |
| **S4** | **MED** | `past_due` is treated identically to `active` — full paid agent runs for the entire dunning window, indefinitely if Stripe dunning isn't set to cancel. No `invoice.payment_failed` handler. | Add `invoice.payment_failed` (or pause `past_due` after N days) + confirm Stripe Dashboard dunning eventually cancels/marks unpaid. |
| **S5** | **MED** | Idempotency record is written **unconditionally**, even when a handler no-op'd on a missing tenant — so a dropped event (S3) can never self-heal via retry *or* replay. | Only record `ProcessedStripeEvent` when the handler actually applied; or return non-2xx on `!business` for subscription events. (Fixing S3 properly largely closes this.) |
| **S6** | **LOW** | Unmappable `lookup_key` → handler `break`s silently; a paying customer on an off-catalog price (e.g. an annual price you mint in the Dashboard) stays `TRIAL`/paused. Paid, got nothing, no log. | Log/alert on unmapped key with price+event id; don't silently drop a paid signup. |
| **S7** | **LOW** | Margin guardrail values a `TRIAL`/`past_due` tenant at phantom $25–79 revenue, so a money-losing free-rider (created by S2/S3/S4) can stay above the 70% floor. Serper cost also uncounted. | Value non-active / TRIAL-without-live-sub at **$0** in `computeMargins`; land the deferred Serper cost ledger. |

**Note for your workflow:** S6 is *more* likely for you specifically because you mint promo coupons and prices directly in the Stripe Dashboard. A typo'd or missing `lookup_key` will silently strand a paying artist. The promo-code path itself is safe (`no_payment_required` is handled if you do the S2 fix).

**Verdict:** S1–S3 are non-negotiable before live keys. S1 is a one-line delete — do it today regardless. S2 and S3 are the two that quietly hand out free agents.

---

## 2. No-trial coherence — fix NOW vs fold into the copy reframe

The backend is honest ("subscribe to activate"). The **front door and the onboarding flow still lie about a 14-day free trial.** Split by whether it's a *behavioral/trust break* (fix now) or *marketing string* (batch into the copy pass).

### FIX NOW (broken in-app behavior + legal exposure — not just words)

- **🚩 ONBOARDING ACTIVATION DEAD-END (the worst one).** The wizard's "first lead caught" screen says *"your agent is already drafting a reply… your 14-day free trial of full Pro is live,"* then routes to `/dashboard` — but the tenant is paused, so **no draft ever appears** and there is **no subscribe/activate step anywhere in onboarding.** A new user does all the setup work, is told it's live and free, and drops into a dead app. This is the single highest-churn moment you could ship. → Add a terminal **"Your assistant is ready but paused — choose a plan / enter your invite code to switch it on"** step routing to `startCheckout`. (`components/onboarding-wizard.tsx:856-868, 1003-1006`)
- **False "Trial ended" alarm on first dashboard view.** `trialEndsAt` is null for every new tenant → `trialActive` always false → dashboard and settings render *"Your free trial has ended"* and the header reads *"Trial ended"* to someone who never had a trial. Reads as a regression, not an invitation. → Base UI purely on `subscribed`; unsubscribed = "Subscribe to switch your agent on." (`app/dashboard/page.tsx`, `components/at-cap-banner.tsx`, `app/dashboard/settings/page.tsx:186-229,274-275`)
- **Terms of Service misrepresentation (legal, not copy).** ToS still promises a binding *"14-day free trial… no payment card required"* the product doesn't deliver, and re-introduces the founder-forbidden "no card." A binding doc describing behavior the backend refuses = consumer-protection exposure. → Rewrite the Billing section to subscribe-to-activate; strip all "no card." Higher priority than the rest of the copy. (`app/(marketing)/terms/page.tsx:120-158`)

### FOLD INTO THE COPY REFRAME (stale strings; one pass fixes most)

- **`lib/marketing/guarantee.ts` `RISK_REVERSAL`** — the single source feeding many pages. Fix this one file, many surfaces correct themselves.
- **`lib/marketing/comparisons.ts`** — `trial` field + ~16 inline mentions feeding `/compare` + slugs.
- **Pricing page** FAQ "Is there a free trial?" → currently answers "Yes." Must become "No / subscribe-to-activate." (`app/(marketing)/pricing/page.tsx`)
- **Homepage hero + meta + `TRUST_LINE`**, and **`public/llms.txt`** (also strip "no card" — it's seeding wrong claims into LLM answers).
- **Tool funnels + demo widgets**, **compare index + story page**, **/design A/B/C variants** (strip "no card"; or delete the variant routes if throwaway).
- **Vestigial code + comments:** kill `trialDaysLeft`/`trialActive`/`trialEndsAt` plumbing; fix the `plan-features.ts` TRIAL comment (and consider setting TRIAL's `leadCap:0/autoSend:false` to *fail safe*); reconcile internal docs (`PRODUCT-BRIEF.md` is named canonical and still asserts the trial). Delete orphan `* 2.tsx` / `* 2/` duplicates before they ship.

**Rule going forward:** the copy reframe and the onboarding-activation fix are *the same change-set*. Don't ship one without the other — a coherent subscribe-to-activate story has to hold from landing page → onboarding → first drafted reply.

---

## 3. What's next — top 5 in order

| # | Item | Blocks launch? |
|---|------|----------------|
| **1** | **Finish the pricing-copy reframe + onboarding-activation step + kill vestigial trial logic** — as ONE change-set. The front door currently sells a trial the backend refuses. | **BLOCKS LAUNCH** |
| **2** | **Close the cheap launch gates:** secrets rotation (Render key was in chat), Clerk prod instance, Stripe live + production webhook, uptime monitor + a real backup-*restore* drill. Plus the Stripe S1–S3 fixes from §1. | **BLOCKS LAUNCH** |
| **3** | **In-app analytics / proof surface** — promote the email-only `weekly.ts` into a dashboard "results" view (response time, leads handled, pitches sent, opportunities surfaced, gigs booked). | Polish — but it's your anti-churn moat |
| **4** | **Launch invite-only beta; instrument the two bets:** the stranger-test (self-activate, no help) and venue reply-rate (the conversion thesis). Lawyer-review the legal pages in parallel; start Gmail CASA the day conversion looks real (long lead time). | The point of everything above |
| **5** | **Hold the line on build order:** pitch-eval harness → cadence cron → team seats, each only when beta demands it. Money path (quote→e-sign→deposit) stays Gate-1-fenced. Only put *enforced* dials (coverage/autonomy/leads) in launch copy — not cadence/seats, which aren't built. | Polish / future |

---

## 4. My recommendation — the immediate next 2–3 build steps

You've told me you want **team seats + the copy reframe**. Here's where they actually slot, and what must bracket them:

**STEP 0 (today, 10 minutes, before anything): Delete `applySubscriptionState`.** One-line removal of an unauthenticated privilege-escalation Server Action. No reason to carry it another day, even on staging. While you're in `app/api/webhooks/stripe/route.ts`, do the S2 payment-status gate and the S3 metadata-based tenant lookup — they're small and they're the difference between "billing works" and "billing hands out free agents."

**STEP 1 (the real next build): The copy reframe — but scoped as the full coherence change-set, not just strings.** This is correctly your priority. Do it as one PR:
1. `RISK_REVERSAL` + the ~13 marketing files + ToS + `llms.txt` (strip "no card" everywhere).
2. The **onboarding activation step** — the paused-agent handoff with a "choose a plan / enter invite code" CTA. *This is the part most likely to be skipped and it's the highest-leverage piece* — without it the honest copy still dead-ends a new user.
3. Kill `trialDaysLeft`/`trialActive`/`trialEndsAt`, fix the false "Trial ended" dashboard/settings states, fix the `plan-features.ts` comment, delete the `* 2` orphans.

Ship nothing here half-done: honest landing page + lying onboarding is no better than today.

**STEP 2 (right after, NOT before): Team seats — but only a *minimal* version, and only if you intend to put "Studio = team" in launch copy.** Reasoning: seats serve your *smallest, last-to-arrive* segment (touring/roster/agency). Your beachhead is solo performers in one city — almost none need seats in 90 days. So:
- If launch pricing copy will claim "team seats" for Studio → build the **minimal real invite + seat-count-by-plan enforcement** so you don't repeat the exact mistake you're fixing in Step 1 (selling a dial nothing enforces). The `Member` model + owner-Member-on-signin already exist; you need invite flow + per-plan seat cap + a management UI.
- If you can **soften the copy to "multi-performer routing"** (which the schema already supports) → defer full seats entirely until a real Studio prospect asks, and spend that time on the **in-app proof surface (§3 #3)** instead, which protects retention across *all* tiers, not just your smallest one.

**My honest steer:** soften the Studio copy, defer full seats, and make your "Step 2" the **proof surface**, not seats. Seats are effort against the wrong gate; the analytics dashboard is what keeps effort-based pricing from feeling like a broken promise across your entire beachhead. Build seats when a paying Studio prospect names the need — not before.

**The bracket to hold:** copy+onboarding coherence (with the Stripe S1–S3 fixes underneath) → then either minimal-real-seats *or* proof-surface → then beta. The money path stays fenced behind Gate 1 no matter how tempting. The discipline that could fail you here is pulling polished features forward before a single arms-length dollar proves anyone will pay.


---

# Appendix A — Verified Stripe findings (raw)

```json
[
  {
    "severity": "high",
    "area": "Server Action / auth — privilege escalation (free plan)",
    "location": "app/actions/billing.ts:83-101 (file-level \"use server\" at line 1)",
    "issue": "`applySubscriptionState(businessId, {plan, ...})` is an exported async function in a file whose first line is `\"use server\"`, so Next.js exposes it as a publicly reachable Server Action endpoint. It does NO auth and NO tenant check — it takes an arbitrary `businessId` and `plan` straight from the caller and runs `db.business.update({ where: { id: businessId }, data: { plan, ... } })`. The repo's own Next docs (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md:31) state: \"Server Functions are reachable via direct POST requests... Always verify authentication and authorization inside every Server Function.\" Unlike `startCheckout`/`openBillingPortal`, this one never calls `getCurrentBusiness()`. It is also dead code (the webhook uses its own inline `db.business.update`; nothing imports this function).",
    "impact": "An unauthenticated attacker who discovers/derives the action id can POST `{businessId, plan:\"STUDIO\"}` and grant any tenant (their own or anyone else's) a paid plan with zero Stripe payment, flipping isAgentPaused→false and unlocking the full agent (drafting, auto-send, venue pitches, 25-city scan) for free. Also lets one tenant downgrade/sabotage another (cross-tenant write by id). Direct revenue loss + tenant-isolation breach.",
    "fix": "Delete `applySubscriptionState` entirely (it is unused — the webhook does its own update). If a shared helper is wanted, move it to a NON-\"use server\" module (e.g. lib/billing/apply.ts) so it can never be invoked as a server action, and call it only from the signature-verified webhook.",
    "verdict": "CONFIRMED",
    "verdict_reason": "Every claim verified against the real code at /Users/norbert/Documents/Projects/Bright Ears/brightears-app.\n\n1. FILE-LEVEL \"use server\": app/actions/billing.ts:1 is `\"use server\";`. Confirmed Next 16.2.9 (App Router). Every exported async function in this file is compiled into a Server Action / Server Function that is POST-reachable.\n\n2. NO AUTH, NO TENANT CHECK, ARBITRARY ID: applySubscriptionState (app/actions/billing.ts:83-101) takes `businessId: string` and `data.plan: PlanTier` straight from the caller and runs `db.business.update({ where: { id: businessId }, data: { plan: data.plan, ... } })` (lines 91-100). It never calls getCurrentBusiness(). By contrast the other three exports in the same file each gate on the tenant: startCheckout (line 22), openBillingPortal (line 55), billingState (line 71) all call `getCurrentBusiness()`. So the finding's \"unlike startCheckout/openBillingPortal, this one never calls getCurrentBusiness()\" is exactly correct.\n\n3. PRIVILEGE-ESCALATION PATH IS CONSTRUCTIBLE: PlanTier enum (app/generated/prisma/enums.ts:29-32) is TRIAL/STARTER/PRO/STUDIO. isAgentPaused (lib/billing/metering.ts:54-55) is `return plan === \"TRIAL\";`. A POST of {businessId, plan:\"STUDIO\"} sets plan to STUDIO → isAgentPaused becomes false → full paid agent unlocked with zero Stripe payment. Because businessId is an arbitrary parameter, an attacker can also write to ANY tenant (e.g. set a competitor to TRIAL to sabotage) — a cross-tenant write, confirming the tenant-isolation breach.\n\n4. DEAD CODE: `grep -rn applySubscriptionState` over the repo (excluding node_modules) returns ONLY the definition at billing.ts:83 — zero importers/callers. The Stripe webhook (app/api/webhooks/stripe/route.ts) does its own inline db.business.update at lines 56, 76, 79, 93 and never references applySubscriptionState. Webhook security claims also hold up: signature verified via stripe().webhooks.constructEventAsync (line 26, fail-closed/400 on bad sig), idempotency via ProcessedStripeEvent (lines 36-37, 104-106). So the webhook genuinely does NOT need this helper.\n\n5. CITED DOCS ACCURATE: node_modules/next/.../07-mutating-data.md contains verbatim: \"Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function.\" (Cited line ~31; matched at the WARNING block.)\n\nMITIGATING NUANCE (does not refute): practical exploitation requires obtaining the Next-generated Server Action ID. Because this function is wired into no client component or form, its action ID is not embedded in any shipped client bundle, raising the bar to discover it. However, Next registers/dispatches actions by deterministically-derived ID server-side regardless of UI wiring, and the repo's own Next docs mandate auth on every Server Function precisely because UI-independence cannot be relied on as a security boundary. Verdict is CONFIRMED rather than PLAUSIBLE because the vulnerable, auth-free, exported, arbitrary-id-writing Server Action provably exists and the privilege-escalation/cross-tenant-write logic is fully constructible; the action-ID obscurity is defense-by-accident, not a guard.\n\nPROPOSED FIX IS CORRECT: the function is unused, so deleting it is safe; or move shared logic to a non-\"use server\" module (e.g. lib/billing/apply.ts) and call it only from the signature-verified webhook. (Minor doc nit unrelated to the finding: the billingState comment at lines 65-69 still describes a \"14-day no-card free trial\" — a known-stale copy state per CLAUDE.md, not a security issue.)"
  },
  {
    "severity": "high",
    "area": "Webhook lifecycle — unpaid sub treated as active (free agent)",
    "location": "app/api/webhooks/stripe/route.ts:40-65 (checkout.session.completed) and 68-85 (subscription.updated)",
    "issue": "checkout.session.completed sets `plan` to a paid tier and `stripeSubscriptionId` purely on the presence of a subscription id — it never inspects `session.payment_status` or `session.status`. For `mode:\"subscription\"`, if the first payment does not succeed the subscription is created in status `incomplete` and the session can complete with `payment_status:\"unpaid\"`. The subscription.updated handler only acts on `active`/`past_due` (→ keep plan) or `canceled`/`unpaid` (→ pause); it has NO branch for `incomplete` or `incomplete_expired`. So a subscription that is created but never successfully charged leaves the tenant on a paid plan, and when Stripe later transitions it to `incomplete_expired`, no handler fires to pause them.",
    "impact": "A user can start checkout with a card that authorizes but fails to charge (or a 3DS/SCA flow that is abandoned after the sub object is created) and end up on STARTER/PRO/STUDIO running the full agent without ever paying. Stays paid until/unless a customer.subscription.deleted arrives — which is not guaranteed for incomplete_expired in all configs. Revenue leak + free compute.",
    "fix": "In checkout.session.completed, only activate when the money is good: require `session.status === \"complete\"` AND `session.payment_status` is `paid` or `no_payment_required` (the latter is the 100%-off promo path — keep it). And add an `incomplete_expired`/`incomplete` branch to subscription.updated (and rely on subscription.deleted) that pauses (plan→TRIAL, stripeSubscriptionId→null) so a never-charged sub cannot linger as paid.",
    "verdict": "CONFIRMED",
    "verdict_reason": "Every code-level claim in the finding is factually correct against /Users/norbert/Documents/Projects/Bright Ears/brightears-app/app/api/webhooks/stripe/route.ts and verified against the installed Stripe SDK (v22.2.0, OpenAPI v2277).\n\n1) checkout.session.completed (route.ts:40-66) activates a paid plan purely on the presence of a subscription id. Line 43 breaks only on missing businessId or mode!==\"subscription\"; line 49 breaks only if !subscriptionId; lines 56-64 then write plan=<paid tier> + stripeSubscriptionId. It never reads session.payment_status or session.status — and never inspects the retrieved sub.status either, so it activates even when the subscription is \"incomplete\".\n\n2) customer.subscription.updated (route.ts:68-85) has exactly two branches: active||past_due → keep/sync plan (73-77); canceled||unpaid → pause to TRIAL, null the sub id (78-82). There is NO branch for \"incomplete\" or \"incomplete_expired\" — they fall through and do nothing.\n\n3) The Stripe lifecycle the finding relies on is confirmed verbatim by the SDK's own docs (node_modules/stripe/cjs/resources/Subscriptions.d.ts:250-252): a charge_automatically subscription \"moves into `incomplete` if the initial payment attempt fails... If the first invoice is not paid within 23 hours, the subscription transitions to `incomplete_expired`. This is a terminal status.\" Subscription.Status enum includes 'incomplete' and 'incomplete_expired' (Subscriptions.d.ts:461). Checkout Session payment_status can be 'unpaid' (Sessions.d.ts:605) and session.status is one of 'complete'|'expired'|'open' (Sessions.d.ts:686) — so the proposed fix references real fields.\n\n4) No mitigating handler exists: the webhook handles ONLY checkout.session.completed, customer.subscription.updated, and customer.subscription.deleted (route.ts:39-99) — no invoice.payment_failed, no async_payment_failed. incomplete_expired is a terminal status that voids the open invoice and does NOT reliably emit customer.subscription.deleted, so the deleted-handler (87-98) does not save it.\n\n5) Impact gate confirmed: lib/billing/metering.ts:54-56 isAgentPaused = plan === \"TRIAL\". Once the webhook writes a paid tier, the agent (drafting + venue pitches + discovery scan) is fully active. So a never-charged subscription leaves the tenant running the full agent for free until/unless a deletion event arrives — which is not guaranteed for incomplete_expired.\n\nIdempotency/signature are sound and unrelated (constructEventAsync at route.ts:26, processedStripeEvent dedupe at 36-37/104-106) — the defect is purely the missing payment-status gate and missing incomplete branch.\n\nThe proposed fix is correct and SDK-accurate, including preserving the 100%-off promo path via payment_status==='no_payment_required' (Sessions.d.ts:605 confirms this value). Marked CONFIRMED rather than PLAUSIBLE because the code has zero defense on the activation path regardless of Stripe sequencing; the only reason it isn't trivially one-click reproducible is that subscription-mode checkout normally defers checkout.session.completed until first payment succeeds, so the unpaid/incomplete window depends on a 3DS/SCA-abandoned or authorize-then-fail-to-settle flow — a real, documented edge, not a hypothetical."
  },
  {
    "severity": "high",
    "area": "Webhook event ordering — re-subscribe / new-sub events silently dropped",
    "location": "app/api/webhooks/stripe/route.ts:70 and 89 (findUnique on stripeSubscriptionId) vs 56-64 (checkout sets the id)",
    "issue": "customer.subscription.updated and .deleted resolve the tenant ONLY by `db.business.findUnique({ where: { stripeSubscriptionId: sub.id } })`. That id is first written by checkout.session.completed. Stripe does NOT guarantee event delivery order, and customer.subscription.created/updated frequently arrives before checkout.session.completed. When a tenant re-subscribes after a cancel (cancel set stripeSubscriptionId=null at line 81/95), the NEW subscription's updated/deleted events carry an id that matches no business row, so `if (!business) break;` silently drops them. A downgrade/upgrade or an immediate cancel that lands before checkout.completed is therefore lost.",
    "impact": "Plan changes and cancellations made through the billing portal (or fast lifecycle transitions on a fresh sub) can be silently ignored: a downgrade keeps the higher tier, or a cancel fails to pause the agent (keeps running free). Because these dropped events are still recorded in ProcessedStripeEvent and return 2xx, Stripe will NOT retry them — the desync is permanent.",
    "fix": "Map subscription events by the durable identifiers, not just stripeSubscriptionId: read `subscription.metadata.businessId` (already set in subscription_data.metadata at checkout, billing.ts:46) and/or look up by `stripeCustomerId`, and upsert from there. Treat the subscription's current status+lookup_key as the source of truth so an out-of-order or post-cancel event still reconciles the right tenant.",
    "verdict": "CONFIRMED",
    "verdict_reason": "The finding is substantively correct and a failing path is constructible. Verified against the real code:\n\nCITED CODE ACCURATE. app/api/webhooks/stripe/route.ts:70 and :89 resolve the tenant ONLY via `const business = await db.business.findUnique({ where: { stripeSubscriptionId: sub.id } }); if (!business) break;` (lines 70-71 for `.updated`, 89-90 for `.deleted`). The id is first written exclusively by `checkout.session.completed` (line 61: `stripeSubscriptionId: subscriptionId`). Cancel/delete null it out (line 81 and line 95: `stripeSubscriptionId: null`). There is NO `customer.subscription.created` handler, so checkout.session.completed is the sole writer of a non-null id.\n\nDURABLE IDENTIFIERS EXIST (fix is viable). The finding's citation \"billing.ts:46\" is mislabeled — the file is app/actions/billing.ts (not lib/billing.ts) — but line 46 is exactly `subscription_data: { metadata: { businessId: business.id } }`, so `subscription.metadata.businessId` genuinely rides on every subscription event. stripeCustomerId is also durably linkable (prisma/schema.prisma:90 `@unique`; set at checkout via customer/customer_email).\n\nPERMANENCE CONFIRMED. route.ts:104-106 records every event in ProcessedStripeEvent and returns 2xx (line 108) after the switch completes without throwing — a dropped event (`!business` -> `break`) still falls through to the recorder and returns 200, so Stripe never retries. No cron/portal reconciler exists; scripts/verify-billing.ts is a hardcoded manual dev script (slug \"norbert\", process.exit), not a scheduled sync. So a dropped event is a permanent desync.\n\nCONSTRUCTIBLE PATH (re-subscribe). 1) Tenant subscribes then cancels -> stripeSubscriptionId=null, plan=TRIAL. 2) Re-subscribes -> new sub_NEW. 3) Stripe (which does not guarantee event ordering) delivers a customer.subscription.updated/.deleted for sub_NEW before the re-subscribe checkout.session.completed writes sub_NEW -> findUnique returns null -> break -> recorded -> never retried. If the dropped event was a downgrade, the higher tier sticks; if it was a cancel, plan stays paid and isAgentPaused is false for any paid plan (lib/billing/metering.ts:54-56 `return plan === \"TRIAL\"`), so the agent keeps drafting/pitching/scanning for free. An immediate-cancel-before-checkout race on a fresh sub is similarly lossy because the later checkout.session.completed re-creates the row at the paid plan and no further .deleted arrives.\n\nSCOPE CAVEAT (does not refute). The most common out-of-order case — an early `.updated` on initial signup carrying only a plan — is benign because checkout.session.completed re-applies the correct plan. And the race window is narrow (seconds of out-of-order delivery). But the cancel/downgrade-during-race and re-subscribe paths are real, portal-reachable, and fully constructible, and the impact (silent tier desync / agent running unpaid, with no retry) is exactly as described. The proposed fix (resolve by subscription.metadata.businessId and/or stripeCustomerId, treat current status+lookup_key as source of truth) is sound and supported by identifiers the code already sets."
  },
  {
    "severity": "med",
    "area": "No-trial coherence — misleading 'Trial ended' UI for brand-new tenants",
    "location": "app/actions/billing.ts:70-80 (billingState), app/dashboard/settings/page.tsx:223-229 & 275, app/dashboard/page.tsx:218",
    "issue": "New tenants are created with plan=TRIAL and trialEndsAt=null (lib/tenant.ts:42; trialEndsAt is now vestigial). `trialDaysLeft` returns 0 when trialEndsAt is null, so `trialActive = (plan===\"TRIAL\" && daysLeft>0)` is ALWAYS false for every unsubscribed tenant. The settings/dashboard UI then falls through to the `!trialActive && !subscribed` branch which renders \"Your free trial has ended — your setup is saved...\" and the status label `planLabel()` returns \"Trial ended\".",
    "impact": "Every just-signed-up user who has never had a trial is told their \"free trial has ended,\" and the header reads \"Trial ended.\" Confusing and contradicts the founder's no-trial model; it implies they missed something. (Distinct from the known marketing-copy staleness — this is the in-app dashboard state derived from now-dead trial logic.)",
    "fix": "Drop trialActive/trialDaysLeft from billingState and the dashboard, and base the UI purely on `subscribed`. Show unsubscribed tenants a neutral \"Subscribe to switch your agent on\" state (not \"trial ended\"). Remove the vestigial trialEndsAt/trialDaysLeft plumbing through meterState callers while you're at it.",
    "verdict": "CONFIRMED",
    "verdict_reason": "Failing path is fully constructible end-to-end against the real code. (1) New tenants are created with plan=TRIAL and no trialEndsAt (defaults null) at lib/tenant.ts:42 (\"trialEndsAt is unused now\"). (2) trialDaysLeft returns 0 when trialEndsAt is null — lib/billing/metering.ts:64 `if (plan !== \"TRIAL\" || !trialEndsAt) return 0;`. (3) Therefore trialActive (`business.plan === \"TRIAL\" && daysLeft > 0`) is ALWAYS false for any unsubscribed tenant — app/actions/billing.ts:78 and app/dashboard/page.tsx:218. (4) With subscribed=false and trialActive=false, every \"trial ended\" branch fires:\n\n  - Settings BillingCard body (app/dashboard/settings/page.tsx:223-229) renders line 225: \"Your free trial has ended — your setup is saved and new inquiries are still being collected.\"\n  - Settings header pill via planLabel (settings/page.tsx:272-276) returns \"Trial ended\" at line 275, shown in the StatPill at line 363.\n  - Settings at-cap notice (settings/page.tsx:179-200): a new tenant has overCap=true because meterState sets overCap = isAgentPaused(plan) (metering.ts:82) and isAgentPaused(\"TRIAL\")=true (metering.ts:55); the subscribed/trialActive checks both fail → line 194 \"Trial ended\" notice.\n  - Dashboard AtCapBanner (app/dashboard/page.tsx:245) receives overCap=true, subscribed=false, trialActive=false; components/at-cap-banner.tsx computes trialEnded = !subscribed = true (line 43) and renders the \"Trial ended\" Kicker (line 48) and \"Your free trial has ended...\" body (line 53).\n\nEnvironmental gating checks out: the settings BillingCard branch is behind state.enabled (settings/page.tsx:202), which is stripeEnabled = !!process.env.STRIPE_SECRET_KEY (lib/billing/stripe.ts:4). Staging runs TEST Stripe keys (key is set), so stripeEnabled=true and the misleading copy renders; the dashboard AtCapBanner doesn't even check enabled, so it fires unconditionally for paused tenants. This is genuinely distinct from the known stale marketing copy (\"14-day free trial\"/\"Start free\") — it is in-app dashboard/settings state derived from now-dead trial logic, telling brand-new users who never had a trial that their \"free trial has ended.\" Severity med is fair. Proposed fix (base UI purely on `subscribed`, show a neutral \"Subscribe to switch your agent on\" state, and remove the vestigial trialActive/trialDaysLeft/trialEndsAt plumbing through billingState and the meterState callers) is sound and matches the actual code shape — note that the same dead-trial copy also exists in a third place not cited in the finding's location list: app/dashboard/settings/page.tsx:194 and components/at-cap-banner.tsx:43-53, which should be fixed together."
  },
  {
    "severity": "med",
    "area": "Webhook idempotency — dedup recorded even when a handler no-ops on a missing tenant",
    "location": "app/api/webhooks/stripe/route.ts:36-37, 70-71, 104-106",
    "issue": "ProcessedStripeEvent is checked before side effects (good) and recorded after the switch (good for true idempotency), BUT the record is written unconditionally for EVERY signature-valid event, including events where `if (!business) break;` made the handler a no-op (e.g. an out-of-order event whose stripeSubscriptionId isn't on any row yet — see the ordering finding). Because the event id is now banked and a 2xx is returned, Stripe will never redeliver it, and the dedup guard will also reject any future redelivery.",
    "impact": "Compounds the ordering bug: a meaningful subscription.updated/deleted that arrived before its tenant mapping existed is permanently swallowed — both Stripe's retry and your own dedup actively prevent recovery. The plan/subscription state can stay wrong forever with no self-healing.",
    "fix": "Only record ProcessedStripeEvent when the event was actually applied (or restructure so the tenant lookup can't miss — see the metadata/customer-id fix). Alternatively, return a non-2xx (or don't record) on `!business` for subscription events so Stripe retries until checkout.completed has populated the mapping.",
    "verdict": "CONFIRMED",
    "verdict_reason": "All cited code facts are accurate in /Users/norbert/Documents/Projects/Bright Ears/brightears-app/app/api/webhooks/stripe/route.ts. The dedup guard is checked before side effects (line 36-37) and the ProcessedStripeEvent record is written UNCONDITIONALLY after the switch (lines 104-106: `await db.processedStripeEvent.create(...)` is reached on every signature-valid path, including ones where a handler no-op'd). The `customer.subscription.updated` (line 70-71) and `customer.subscription.deleted` (line 89-90) handlers both look up the tenant via `findUnique({ where: { stripeSubscriptionId: sub.id } })` and `if (!business) break;` — a true no-op that still falls through to the recorder. A 2xx is then returned (line 108), so Stripe will not redeliver, and a later redelivery of the same event.id would hit the dedup guard at line 37 and be rejected. So the \"record + 2xx + dedup = permanent swallow, no self-healing\" mechanism is mechanically exact.\\n\\nThe ordering premise it depends on is also real: `stripeSubscriptionId` is set to a non-null value ONLY by the `checkout.session.completed` handler (line 61) — confirmed by grep across the repo; `customer.subscription.created` is not in the switch at all, and app/actions/billing.ts only sets it via the webhook-invoked helper. The updated/deleted handlers therefore strictly require checkout to have run first (or the mapping not to have been nulled). Stripe does not guarantee webhook event ordering, so out-of-order delivery is a documented, realistic condition, and there is NO automated reconciliation/self-healing job (only the manual scripts/verify-billing.ts and the webhook itself call subscriptions.retrieve).\\n\\nConstructible permanent-loss path: a tenant cancels (subscription.deleted or canceled subscription.updated sets stripeSubscriptionId:null at lines 81/95), then the same subscription is reactivated in Stripe; the reactivation `customer.subscription.updated` arrives, findUnique returns null, the handler no-ops, the event is banked, 2xx returned — the tenant stays permanently on plan=TRIAL (isAgentPaused true, agent off) with no retry and no recovery. The lost-delete variant (a subscription.deleted swallowed out-of-order while the mapping isn't yet/anymore present) leaves an active mapping that never downgrades. The impact is exactly as stated: state can stay wrong forever, and both Stripe's retry and the local dedup actively prevent recovery.\\n\\nOne calibration note (does not change the verdict): the finding's framing that a generic at-signup out-of-order subscription.updated is \\\"permanently swallowed\\\" overstates that specific case — at initial checkout the trailing authoritative `checkout.session.completed` (line 56-64) still writes plan + stripeSubscriptionId, so first-signup state self-heals. The genuinely-permanent failures require the mapping to be absent/nulled at the time the meaningful event arrives (post-cancel resurrection, or a lost delete), which the code makes fully reachable. Proposed fix (only record ProcessedStripeEvent when the handler actually applied, or return non-2xx / skip recording on `!business` for subscription events, or look up by metadata.businessId/customer id instead of stripeSubscriptionId — note subscription_data.metadata.businessId IS already set at app/actions/billing.ts:46 but unused in the webhook) is sound."
  },
  {
    "severity": "med",
    "area": "Webhook — past_due subscription runs the full paid agent indefinitely",
    "location": "app/api/webhooks/stripe/route.ts:73 (`sub.status === \"active\" || sub.status === \"past_due\"`)",
    "issue": "`past_due` is treated identically to `active` and the plan is left/refreshed to the paid tier. There is no invoice.payment_failed handling and no time bound on how long past_due is tolerated; whether past_due ever becomes `unpaid`/`canceled` depends entirely on the Stripe Dashboard dunning/smart-retry settings (if retries are configured to leave the sub past_due or to do nothing, it never escalates). Margin code also keeps charging full LLM/Serper spend with no offsetting revenue.",
    "impact": "A renewal that silently fails leaves the agent fully operational (drafting, auto-send, paid-tier scans) for the entire dunning window — potentially indefinitely if dunning isn't configured to cancel — i.e. service delivered with no successful payment. Combined with margin.ts not counting Serper cost, real margin can go negative while the 70% alert stays green.",
    "fix": "Decide an explicit grace policy: either keep a short past_due grace then pause, or pause immediately on payment failure. Add an `invoice.payment_failed` handler (or treat past_due as paused after N days) and confirm the Stripe Dashboard dunning is set to eventually cancel/mark unpaid so the existing unpaid/deleted pause branches actually fire.",
    "verdict": "CONFIRMED",
    "verdict_reason": "All claims verified against the real code; the failing path is fully constructible.\n\n1) Cited line is verbatim correct. app/api/webhooks/stripe/route.ts:73 reads `if (sub.status === \"active\" || sub.status === \"past_due\") {` and inside that branch (lines 74-77) it refreshes `plan` to the paid tier via planForLookupKey — `past_due` is treated identically to `active`. The pause branches only fire on `canceled`/`unpaid` (line 78) or `customer.subscription.deleted` (line 87).\n\n2) No invoice.payment_failed handler exists. A repo-wide grep for `payment_failed` / `invoice.` returns zero hits in handler code (only an unrelated marketing-copy string and the line-73 match). The webhook `switch` (lines 39-99) only handles checkout.session.completed, customer.subscription.updated, and customer.subscription.deleted. There is no time bound on past_due — nothing tracks how long it has been in that state.\n\n3) The agent gates on `business.plan`, never on live Stripe status, so a past_due tenant runs the full paid agent. Because line 73-77 leaves `plan` at STARTER/PRO/STUDIO (not TRIAL), `isAgentPaused(plan)` returns false (lib/billing/metering.ts:54-56 returns true only for `plan === \"TRIAL\"`). Every downstream gate consumes that paid plan: discovery scan (lib/discovery/scan.ts:105 `if (isAgentPaused(business.plan))` and :161 homeCityCap by plan), inbound drafting (lib/inbound/pipeline.ts:162 `meterState(business.id, business.plan, ...)`), and auto-send (lib/inbound/auto-send.ts:35 `if (!planFeatures(plan).autoSend) return false`). So during the entire dunning window the agent keeps drafting, auto-sending (Pro+), and running paid-tier scans with no successful renewal payment. Whether past_due ever escalates to unpaid/canceled (the only states that pause) depends entirely on Stripe Dashboard dunning config, exactly as claimed.\n\n4) Margin amplification is real and self-documented. lib/billing/margin.ts:32-41 (the D3-NF scope comment) and the cost loop (lines 52-59) sum only `LlmUsage` token cost; Serper discovery API cost is explicitly excluded (\"It does NOT include the paid Serper discovery API ... can erode real gross margin without tripping this 70% alert\"). So a past_due tenant running paid-tier scans accrues uncounted Serper spend plus full LLM spend against zero collected revenue, while the 70% margin alert can stay green.\n\nSeverity assessment matches \"med\": signature verification (constructEventAsync, line 26) and idempotency (processedStripeEvent dedupe, lines 36-37, 104-106) are sound, so this is not an auth/replay hole — it is a deliberate-but-unbounded grace policy with no payment_failed handling and no offsetting margin accounting, exactly as the finding states. The proposed fix (explicit grace policy + invoice.payment_failed handler / past_due-after-N-days pause + confirm dunning cancels) is appropriate."
  },
  {
    "severity": "low",
    "area": "Webhook checkout handler — plan not refreshed when lookup_key is unmappable",
    "location": "app/api/webhooks/stripe/route.ts:52-54 (`const plan = planForLookupKey(lookupKey); if (!plan) break;`) and stripe.ts:31-35",
    "issue": "If a Stripe price's lookup_key doesn't match one of the three hardcoded keys (e.g. founder adds a new annual/regional price, or a price was created in the Dashboard without the exact lookup_key from scripts/stripe-setup.ts), planForLookupKey returns null and the handler `break`s — it has already retrieved the subscription and a real payment occurred, but Business.plan and stripeSubscriptionId are NEVER written. The event is then recorded as processed (line 104), so no retry.",
    "impact": "A paying customer on a price the map doesn't recognize stays on plan=TRIAL (agent paused) despite an active paid subscription — they paid and got nothing, with no self-healing. Silent because there is no log/alert on the unmapped-key path.",
    "fix": "On an unmappable lookup_key, do not silently break: log/alert with the price id and event id, and either fail (non-2xx, don't record) so it can be retried after the map is fixed, or persist stripeSubscriptionId/customerId anyway so a later reconciliation can set the plan. At minimum surface it instead of dropping a paid signup.",
    "verdict": "CONFIRMED",
    "verdict_reason": "The failing path is constructible exactly as described. Verified against the real code:\n\n1. app/api/webhooks/stripe/route.ts:51-54 — on checkout.session.completed the handler retrieves the subscription, reads `sub.items.data[0]?.price?.lookup_key`, calls `planForLookupKey(lookupKey)`, and `if (!plan) break;`. The `break` is silent — there is no log or alert on this path (confirmed by reading the file; the only logging-free exits are the early `break`s).\n\n2. lib/billing/stripe.ts:31-35 — `planForLookupKey` returns null for any key not exactly equal to one of the three hardcoded values in PLAN_LOOKUP_KEYS (brightears_starter_monthly / pro / studio). A null/typo'd/new lookup_key yields null.\n\n3. The DB write that persists plan/stripeSubscriptionId/stripeCustomerId is at route.ts:56-64 and is only reached when `plan` is truthy. On the null path Business.plan stays \"TRIAL\" (= agent paused, per CLAUDE.md `isAgentPaused = plan === \"TRIAL\"`) and stripeSubscriptionId/stripeCustomerId are NEVER written, even though `stripe().subscriptions.retrieve` succeeded and a real subscription/payment exists.\n\n4. route.ts:104-106 records `processedStripeEvent` after the switch completes without throwing — this runs regardless of which `break` was taken. So the event is marked processed and the dedup guard at route.ts:36-37 will suppress any redelivery/replay. No Stripe retry, no self-healing.\n\n5. No reconciliation/invoice handler exists. grep across app/lib/scripts shows only the three webhook cases (checkout.session.completed, customer.subscription.updated, customer.subscription.deleted) plus app/actions/billing.ts checkout — there is no invoice.paid/invoice.payment_succeeded handler. scripts/verify-billing.ts is a manual script and keys off business.stripeSubscriptionId (verify-billing.ts:24), which on this path is never written, so it cannot even locate the orphaned subscription.\n\nReachability nuance (supports the severity:low rating, does not refute): the app's own checkout (app/actions/billing.ts:24-33 `startCheckout`) always selects a price via PLAN_LOOKUP_KEYS and passes that price.id, so subscriptions created through the in-app UI always carry a recognized lookup_key. A Stripe PROMOTION CODE (allow_promotion_codes:true, billing.ts:43) only discounts the same line item — it does NOT change the price or its lookup_key — so promo codes alone cannot trigger this. The path requires an off-catalog price: the founder creating a new price in the Stripe Dashboard (annual/regional/promo) without the exact lookup_key, or with a typo, or with no lookup_key, then a customer subscribing to it (e.g. via a Dashboard-created payment link). Given the founder is explicitly minting things directly in the Stripe Dashboard today, this is a realistic operational scenario rather than purely theoretical. Impact as stated holds: a paying customer stays plan=TRIAL (agent paused) with no log, no alert, and no retry — paid and got nothing, silently."
  },
  {
    "severity": "low",
    "area": "Margin alert blind spot already flagged but unbounded for free riders",
    "location": "lib/billing/margin.ts:13-18, 43-72 (PLAN_PRICES_USD.TRIAL = 25)",
    "issue": "computeMargins values a TRIAL tenant's revenue at $25 (Starter) even though an unsubscribed/paused tenant pays $0. Normally a paused agent spends ~nothing, but if any of the above bugs leave a TRIAL or past_due tenant actually running (free-plan escalation, incomplete sub, dropped cancel), this row computes margin against a phantom $25 and can stay above the 70% floor while real revenue is $0. The doc-noted Serper omission (D3-NF) compounds it.",
    "impact": "The 70%-margin guardrail (CLAUDE.md rule 8) can fail to flag a genuinely money-losing tenant created by the lifecycle gaps above, because the denominator assumes revenue that isn't being collected.",
    "fix": "Value paused/unsubscribed (TRIAL with no live stripeSubscriptionId) and non-active subscription states at $0 revenue in PLAN_PRICES_USD/computeMargins so any LLM spend on a non-paying tenant trips the alert; and land the deferred Serper cost ledger so margin reflects true cost.",
    "verdict": "CONFIRMED",
    "verdict_reason": "CONFIRMED via the past_due lifecycle path, which is directly constructible from the actual code (no other bug required). Facts check out: lib/billing/margin.ts:13-18 has PLAN_PRICES_USD.TRIAL=25, and computeMargins (margin.ts:60-61) sets planUsd=PLAN_PRICES_USD[b.plan] with the only $0 branch being planUsd>0 (never true for any tier). The Serper omission the finding cites is real and self-documented at margin.ts:35-41.\n\nThe denominator-is-phantom-revenue failing path: app/api/webhooks/stripe/route.ts:73-77 handles customer.subscription.updated by treating \"active\" OR \"past_due\" identically — it KEEPS the business on its paid plan (STARTER/PRO/STUDIO) and only flips to TRIAL on \"canceled\"/\"unpaid\" (lines 78-83) or subscription.deleted (87-98). The Business model (prisma/schema.prisma:88-91) stores only plan + stripe ids, NO subscription-status field. Every agent gate keys solely on plan via isAgentPaused(plan){return plan===\"TRIAL\"} (metering.ts:54-56): the discovery scan (scan.ts:105), venue-pitch actions (venues.ts:77,296), and inbound/sequence drafting through meterState (metering.ts:82, used in inbound/pipeline.ts:162 and sequences/engine.ts:55). So a past_due tenant on PRO is NOT paused — it keeps drafting, sending pitches, and scanning, burning real LLM (and Serper) — while Stripe has collected $0 for that period. computeMargins then values that tenant at the full $79, so e.g. $20 LLM yields (79-20)/79=75%, above MARGIN_FLOOR_PCT=70 (margin.ts:30,69), and the nightly guardrail (app/api/cron/margin-guardrail/route.ts:14-15) never emails. The guardrail's denominator assumes revenue that isn't being collected — exactly the claimed defect.\n\nCaveat on the finding's TRIAL framing: a clean unsubscribed TRIAL tenant genuinely spends ~nothing because all three gates skip it (the finding concedes this), so the pure-TRIAL variant needs one of the \"above lifecycle bugs\" to leak through and is conditional. But the past_due variant needs no additional bug and is real on its own, so the finding's core claim — the 70% guardrail can stay green against $0 real revenue for a running non-paying tenant — holds. Proposed fix is sound: value past_due / TRIAL-without-live-stripeSubscriptionId at $0 in computeMargins, and land the deferred Serper ledger. Severity low is fair given past_due is transient and test-keys/staging only today."
  }
]
```

# Appendix B — No-trial coherence findings (raw)

```json
[
  {
    "severity": "high",
    "area": "A: Onboarding/activation FLOW",
    "location": "components/onboarding-wizard.tsx:856-868 (and copy at :861)",
    "issue": "The 'First lead caught' celebration screen tells the user 'your agent is already drafting a reply in your voice — go watch it answer. Your 14-day free trial of full Pro is live.' But a new tenant is plan=TRIAL = isAgentPaused, so the inbound pipeline (lib/inbound/pipeline.ts:161-168) sees meter.overCap=true and pushes a 'Lead cap reached' notice WITHOUT ever drafting. The promised reply never appears.",
    "impact": "New user finishes onboarding believing the agent is live and answering, clicks 'Take me to my pipeline', and finds NO draft — a broken core promise on the very first lead, with zero explanation. This is the activation dead-end.",
    "fix": "Replace the 'trial is live / agent already drafting' copy with the true state: forwarding works, but the agent is paused until you subscribe — and add a 'Subscribe to switch it on' / 'Choose a plan' CTA (mirror the correct string already used in app/actions/venues.ts:60 'Your agent is paused — subscribe to switch it on' and link to /dashboard/settings#billing)."
  },
  {
    "severity": "high",
    "area": "A: Onboarding/activation FLOW",
    "location": "components/onboarding-wizard.tsx:1003-1006, app/onboarding/page.tsx:10, app/onboarding/page.tsx (whole STEPS flow, components/onboarding-wizard.tsx:40-46)",
    "issue": "The wizard header promises 'your 14-day free trial of full Pro starts answering every inquiry in your voice', and the 5 STEPS end at 'Connect leads' routing straight to /dashboard (onboarding-wizard.tsx:864/897) with NO 'subscribe to activate' step or prompt anywhere. A fully onboarded but unsubscribed tenant lands in a paused app with no guidance to subscribe.",
    "impact": "The single most important UX gap: a new user completes setup expecting a working/free agent, but everything (reactive drafting, venue pitches, discovery scan — all gate on isAgentPaused) is silently off, and onboarding never tells them to subscribe. They drop into a dead app and likely churn.",
    "fix": "Add a final 'Activate your agent' step (or a prominent post-setup prompt) that explains the agent is paused until they subscribe and surfaces the plan picker / checkout. Rewrite the header promise to match no-trial reality. Founder note: selected artists activate free via a private Stripe promotion code at checkout (allow_promotion_codes is already true in startCheckout)."
  },
  {
    "severity": "high",
    "area": "A: Dashboard billing state (false 'Trial ended')",
    "location": "app/dashboard/page.tsx:217-251 + components/at-cap-banner.tsx:34-79 + lib/billing/metering.ts:59-67 + lib/tenant.ts:40-42",
    "issue": "createBusinessForUser leaves trialEndsAt null, so trialDaysLeft()=0 → trialActive=false for every never-subscribed tenant. meterState marks them overCap (isAgentPaused). AtCapBanner therefore computes trialEnded = !subscribed = true and renders 'Trial ended — Your free trial has ended … the Hunt has stopped …'. A brand-new user who never had a trial is told their trial has ENDED.",
    "impact": "First-ever dashboard view shows a false 'Trial ended' alarm and 'Choose a plan to switch your agent back on' — confusing and wrong (nothing was ever on). It does at least surface a Choose-a-plan CTA, but framed as a regression rather than initial activation.",
    "fix": "Distinguish never-subscribed-yet (no trial, never activated) from cancelled-after-paid. The unsubscribed/paused state should read as 'Subscribe to switch your agent on', not 'Trial ended'. Either drop the trialActive concept entirely or base the banner on a real never-activated signal (e.g. stripeSubscriptionId never set AND no prior plan)."
  },
  {
    "severity": "high",
    "area": "A: Control Room billing card (false 'Trial ended' + dead trial branch)",
    "location": "app/dashboard/settings/page.tsx:186-198, 213-229, 274-275",
    "issue": "BillingCard branches on state.trialActive, which is permanently false for never-subscribed tenants (trialEndsAt null). The trialActive branches (lines 186-191, 214-222 'You're on the free trial — N days left of full Pro. The agent is replying … right now') are unreachable/dead, and the live path falls to 'Your free trial has ended …' (225-227) and planLabel returns 'Trial ended' (275) for a user who never subscribed.",
    "impact": "The billing card tells a brand-new unsubscribed owner their 'free trial has ended' and the header status reads 'Trial ended' — false, and it buries the real message (you must subscribe to start). The 'days left / agent replying right now' copy can never display.",
    "fix": "Remove the trialActive branches; replace 'Your free trial has ended' with a no-trial activation message ('Your agent is paused — choose a plan to switch it on; your setup and leads are saved'). Fix planLabel: unsubscribed → 'Not subscribed' / 'Paused', not 'Trial ended'."
  },
  {
    "severity": "high",
    "area": "B: Marketing copy — legal/Terms (binding misrepresentation)",
    "location": "app/(marketing)/terms/page.tsx:120-127, 140-146, 154-158",
    "issue": "Terms of Service still states 'New accounts start with a 14-day free trial of full Pro features — no payment card required. If you do not choose a plan before the trial ends, the agent simply pauses' and 'Because we offer a no-card free trial …'. There is no trial; the agent is paused from signup. Also re-introduces 'no payment card required' / 'no-card', which the founder explicitly forbids in all copy.",
    "impact": "A binding legal document promises a product behavior (free 14-day trial, agent works during it) that the backend no longer delivers — a consumer-protection / misrepresentation exposure, not mere marketing fluff. Higher stakes than other copy.",
    "fix": "Rewrite the Billing section to describe subscribe-to-activate (no auto trial, agent paused until subscribed, cancel anytime, no money-back). Remove all 'no card'/'no payment card required'. Treat as higher priority than the rest of the copy reframe given it is the ToS."
  },
  {
    "severity": "med",
    "area": "B: Marketing copy — risk-reversal single source of truth",
    "location": "lib/marketing/guarantee.ts:31-34 (RISK_REVERSAL.short, .full)",
    "issue": "RISK_REVERSAL.short = '14-day free trial. Cancel anytime.' and .full = 'Start with 14 days of full Pro — free…'. This is the single source consumed across pages/JSON-LD, so the stale trial claim propagates everywhere it's used.",
    "impact": "Every surface importing RISK_REVERSAL advertises a free trial that no longer exists; fixing this one file corrects many downstream mentions. capLine is still true.",
    "fix": "Rewrite .short/.full to the no-trial subscribe-to-activate framing as part of the pricing copy reframe; keep capLine. The header comment already flags this as pending."
  },
  {
    "severity": "med",
    "area": "B: Marketing copy — pricing page",
    "location": "app/(marketing)/pricing/page.tsx:15, 90, 133-134, 204, 270, 381",
    "issue": "Multiple '14-day free trial' claims; FAQ 'Is there a free trial?' answers 'Yes — 14 days of full Pro, free … the agent immediately starts replying in your voice and hunting venues' (133-134), and 'When the trial ends … the agent simply pauses'. All false now (agent is paused from the start, no trial).",
    "impact": "The dedicated pricing/FAQ page actively promises a free trial and immediate agent activation that the product no longer provides — a direct expectation mismatch at the point of purchase decision.",
    "fix": "Reframe to subscribe-to-activate in the pricing copy pass; the FAQ 'Is there a free trial?' answer must change from 'Yes' to the no-trial explanation."
  },
  {
    "severity": "med",
    "area": "B: Marketing copy — homepage & metadata",
    "location": "app/(marketing)/page.tsx:30, 33 (TRUST_LINE), public/llms.txt:3,16,32",
    "issue": "Homepage hero/meta description and TRUST_LINE = '14-day free trial · setup in minutes'; llms.txt advertises '14-day free trial, no card' and 'self-serve signup, 14-day trial, no card' to LLM crawlers. Stale, and llms.txt re-states 'no card' (founder-forbidden).",
    "impact": "Primary landing surface and the machine-readable AI summary both promise a non-existent free trial; llms.txt will seed wrong claims into LLM answers about the product.",
    "fix": "Update homepage hero/meta + TRUST_LINE and rewrite llms.txt to subscribe-to-activate; strip 'no card' from llms.txt."
  },
  {
    "severity": "med",
    "area": "B: Marketing copy — comparisons single source",
    "location": "lib/marketing/comparisons.ts:19-21, 222, 242, 319, 399, 403, 492, 527, 613, 648, 736, 771, 865, 891, 900, 1003, 1007 (trial field + ~16 inline mentions)",
    "issue": "The comparisons data module defines trial: '14-day free trial — cancel anytime' and repeats '14-day free trial' across every competitor comparison's body, the 'us' note cells, and ctaSub lines. All consumed by /compare and /compare/[slug].",
    "impact": "Every competitor comparison page and slug page advertises the dead free trial; high volume of mentions but all flow from this one data file.",
    "fix": "Reframe the trial field and all inline '14-day free trial' strings to subscribe-to-activate in the copy pass."
  },
  {
    "severity": "med",
    "area": "B: Marketing copy — tools & demo widgets",
    "location": "app/(marketing)/tools/inquiry-reply-generator/page.tsx:127, app/(marketing)/tools/lead-roi-calculator/page.tsx:137, app/(marketing)/tools/templates/page.tsx:694,726, components/lead-roi-calculator.tsx:277, components/demo-widget.tsx (CTA region)",
    "issue": "Lead-gen tool pages and their shared widgets repeat 'Start with a 14-day free trial' / '14-day free trial' in their conversion CTAs.",
    "impact": "Tool funnels (a key acquisition channel) promise the non-existent trial at the conversion point.",
    "fix": "Update all tool-page and widget CTA subcopy in the copy reframe."
  },
  {
    "severity": "med",
    "area": "B: Marketing copy — compare & story pages",
    "location": "app/(marketing)/compare/page.tsx:318, app/(marketing)/story/page.tsx:333",
    "issue": "compare index ('14-day free trial — cancel anytime. It hunts venues …') and story page ('start with a 14-day free trial') carry stale inline trial copy not driven by the comparisons data file.",
    "impact": "Additional marketing surfaces promising the dead trial.",
    "fix": "Update inline copy in the copy reframe pass."
  },
  {
    "severity": "low",
    "area": "B: Marketing copy — design variants & 'no card' lines",
    "location": "app/(marketing)/design/a/page.tsx:190, app/(marketing)/design/b/page.tsx:309, app/(marketing)/design/c/page.tsx:239 (each '14-day free trial, no card · setup in minutes')",
    "issue": "The /design A/B/C variant pages all show '14-day free trial, no card · setup in minutes' — stale trial AND the founder-forbidden 'no card'. These appear to be design-exploration routes (the app is mid-redesign) but are live routes.",
    "impact": "If reachable/indexed, they advertise the dead trial and violate the 'no card' copy rule; lower priority if they are throwaway design routes.",
    "fix": "Fold into the copy reframe, or delete the /design variant routes if they are no longer needed."
  },
  {
    "severity": "low",
    "area": "A: Dead code / vestigial trial scaffolding",
    "location": "lib/billing/metering.ts:59-67 (trialDaysLeft), app/actions/billing.ts:7,66-79 (trialDaysLeft/trialActive in billingState), components/at-cap-banner.tsx:25-26,38 (trialActive prop), app/dashboard/page.tsx:19,218,250",
    "issue": "trialDaysLeft / trialActive / the trialEndsAt parameter threaded through meterState are now vestigial: trialActive is always false (trialEndsAt never set), and meterState ignores trialEndsAt (void trialEndsAt). The trialActive=true branches in settings BillingCard and the AtCapBanner short-circuit are dead.",
    "impact": "Dead branches and a misleading 'trialActive' concept keep the false 'trial' mental model alive in code, inviting future bugs and making the no-trial state confusing to reason about.",
    "fix": "Remove trialDaysLeft/trialActive and the trialEndsAt parameter from billingState/meterState/AtCapBanner/dashboard once the UI copy is corrected; the comments at lib/billing/metering.ts:42-50, lib/tenant.ts:17-26, app/actions/venues.ts:53-60 already document the intended end state."
  },
  {
    "severity": "low",
    "area": "A: Stale doc comments / model labels",
    "location": "prisma/schema.prisma:29 ('TRIAL // 14 days, full capability, no card'), lib/billing/plan-features.ts:10,31 ('full Pro during the 14-day trial'), app/actions/billing.ts:66-69 (billingState doc still says '14-day no-card free trial FINAL'), app/dashboard/page.tsx:212-215 & components/at-cap-banner.tsx:1-10 comments",
    "issue": "Code comments and the PlanTier enum doc still describe TRIAL as a '14 days, no card' trial and reference the superseded 2026-06-14 decision, contradicting the current isAgentPaused = plan==='TRIAL' (subscribe-to-activate) model.",
    "impact": "Misleading inline documentation; a future maintainer could re-introduce time-based-trial logic based on these comments.",
    "fix": "Update comments to 'TRIAL = free / not subscribed → agent paused' per the 2026-06-16 decision; align with CLAUDE.md and lib/tenant.ts."
  },
  {
    "severity": "low",
    "area": "A: Repo hygiene — orphan duplicate files",
    "location": "components/at-cap-banner 2.tsx, components/in-play 2.tsx, components/legal-page 2.tsx",
    "issue": "Three editor-created duplicate files (' 2.tsx') exist and are NOT imported anywhere. 'at-cap-banner 2.tsx' differs from the real one only at line 71 (href '/dashboard/settings' vs the live '#billing' anchor) — i.e. a stale fork carrying the same trial-ended copy.",
    "impact": "Dead/confusing duplicates that drift from the real components; not user-visible but pollute grep results and risk someone editing the wrong file.",
    "fix": "Delete the three ' 2.tsx' orphan files."
  },
  {
    "severity": "low",
    "area": "B: Internal docs referencing live trial",
    "location": "docs/PRICING-STRATEGY-JUNE-2026.md:24,471, docs/PRODUCT-BRIEF.md:38,43, ROADMAP.md:114, docs/AUDIT-FINDINGS.md:25,143,567",
    "issue": "Internal strategy/spec docs still assert 'keep the 14-day free-Pro trial, no card' as current policy, contradicting CLAUDE.md's 2026-06-16 no-trial decision. PRODUCT-BRIEF.md is named canonical, so this is a live contradiction in the source of truth.",
    "impact": "Future agents reading PRODUCT-BRIEF/PRICING-STRATEGY as canonical will re-derive the wrong trial policy; not user-facing but a coherence hazard for the team/agents.",
    "fix": "Reconcile these docs with the no-trial decision (or add a clear superseded-by banner pointing to CLAUDE.md / the 2026-06-16 decision)."
  }
]
```

# Appendix C — What-next strategy (full)

# Bright Ears — "What's Next, and What Are We Missing?"

*Strategy review, 2026-06-16. Grounded in the actual code on `main` (mid-pricing-rework, staging w/ test keys), not the docs' aspirations. Brutally honest, prioritized by leverage and launch-risk.*

---

## The one-paragraph read

You are **closer to launch than the doc trail suggests, and further from "perfect" than the founder thinks** — because the dangerous gaps aren't unbuilt features, they're *internal contradictions left half-resolved by the pricing rework*. The backend now enforces "no trial, subscribe-to-activate." The **entire public site and the in-app onboarding still promise a "14-day free trial / Start free."** That single mismatch is both a conversion-killer and a legal/trust liability, and it sits across ~15 files. Meanwhile the genuinely product-defining build — the **money path (quote→e-sign→deposit)** — is correctly Gate-1-fenced and should *stay* fenced. The highest-leverage work right now is not new capability; it's **closing the loop you already half-built**: make the subscribe-to-activate story coherent end-to-end (copy + onboarding + the paused-agent moment), then harden the launch gates. Team Seats is real Studio scope but it is **not** what's blocking you.

---

## Audit findings against the recent changes (what's actually true in the code)

| Claim | Reality in code | Verdict |
|---|---|---|
| No auto free trial; `isAgentPaused = plan==="TRIAL"` | ✅ Correct in `lib/billing/metering.ts`; `lib/tenant.ts` provisions `plan:"TRIAL"`; scan + pitch + draft all gate on the same `isAgentPaused` | Solid, consistent at the gate |
| `plan-features.ts` is the SSOT | ✅ Real. `autoSend` enforced in `lib/inbound/auto-send.ts`; `homeCityCap` enforced in `lib/discovery/scan.ts` (slice) and at save | Solid — this is good engineering |
| Subscribe-to-activate flow exists | ✅ `app/actions/billing.ts` has `startCheckout` (with `allow_promotion_codes:true`) + `openBillingPortal`; settings page renders plan cards; webhook syncs plan | **Built and wired** |
| Marketing copy still says "14-day free trial" | ⚠️ Confirmed — `lib/marketing/guarantee.ts` `RISK_REVERSAL` strings still say "14-day free trial," surfaced on `/pricing`, `/terms`, **and the in-app settings page** + onboarding wizard | **The #1 live contradiction** |
| `trialEndsAt` vestigial | ⚠️ Mostly — but `billingState()` in `billing.ts` still computes `trialDaysLeft`/`trialActive`, and settings copy literally says *"keep it running after your trial ends"* | Stale logic + stale UX |
| `plan-features.ts` TRIAL comment | ⚠️ Says `TRIAL: {leadCap:60, autoSend:true} // full Pro during the 14-day trial` — the *values* are now dead (TRIAL is paused, never drafts) but the comment claims the opposite | Misleading; harmless functionally, dangerous for the next engineer |

**Plus housekeeping:** accidental duplicate files (`components/at-cap-banner 2.tsx`, `docs/AUDIT-FINDINGS 2.md`, `app/api/oauth/google 2/`) are in the tree — these will ship if not removed. (Flagged as a background task.)

---

## Prioritized "what next"

### TIER 0 — Coherence debt from the pricing rework (do before anything else; cheap, high-leverage)

**1. The pricing-copy reframe — finish it, don't just queue it. [BLOCKS LAUNCH] — Effort: M**
*What:* Rewrite `RISK_REVERSAL` in `guarantee.ts` and purge "14-day free trial / Start free → free trial" from the ~13 marketing files + onboarding wizard + settings. Re-axis pricing to the effort ladder already specified in `PRICING-STRATEGY-JUNE-2026.md` (cadence/coverage/depth/autonomy/roster), and make the public CTA honest for an invite-only, subscribe-to-activate product (e.g. "See plans" / "Start — first month free with an invite code," never an advertised universal trial).
*Why it matters:* Right now a stranger who lands on the site is promised a free trial that **does not exist** — they sign up, finish onboarding, and the agent **does nothing** (paused) until they pull out a card. That is the single worst first-run experience you could ship, and "we advertised free, delivered paywall" is exactly the kind of claim FTC §5 / UK DMCC / AU ACL flag. This is the capstone the whole rework was building toward; everything else is downstream of it.

**2. Make `trialEndsAt`/`trialDaysLeft` truly dead + fix the SSOT comment. [does not block, but do it with #1] — Effort: S**
*What:* Delete `trialDaysLeft`/`trialActive` from `billingState()`, drop the "after your trial ends" settings copy, fix the `TRIAL` comment in `plan-features.ts` to say "free/not-subscribed → paused" (and consider whether TRIAL's `leadCap:60/autoSend:true` values should be 0/false to *fail safe* if a code path ever reads features before checking `isAgentPaused`).
*Why:* Vestigial-but-live trial logic is how the contradiction crept in. Kill it at the root so the next agent can't resurrect it.

**3. The subscribe-to-activate onboarding moment — design the "paused agent" handoff. [BLOCKS LAUNCH] — Effort: M**
*What:* Today onboarding (`/onboarding`) ends at "forwarding verified" with no subscription step, and the agent is silently paused. Add an explicit **activation step**: the wizard's terminal state must be "Your assistant is ready but paused — enter your invite code / choose a plan to switch it on," routing to `startCheckout`. Surface the same in the dashboard `at-cap-banner` family (which already exists — extend it to a "paused, not over-cap" state).
*Why:* This is the literal product loop now. With no trial, **subscription IS activation.** If the user can finish setup and not understand why nothing happens, you lose them at the worst possible moment — after they've done all the work. The promo-code path needs to feel like a gift, not a paywall.

---

### TIER 1 — Launch-readiness gates (these gate a *real* launch, not the beta)

**4. Stripe LIVE-mode + production webhook. [BLOCKS LAUNCH] — Effort: S–M**
*What:* Re-run `scripts/stripe-setup.ts` in live mode (recreates prices by `lookup_key` — already designed to survive this), register the dashboard webhook → real `whsec_`, swap to live keys, mint the first real 100%-off promo coupon. Verify a live $25 checkout + the comped-code path end-to-end.
*Why:* You cannot take a single beta dollar (or comp a single artist correctly) on test keys. The code is ready; this is config + one real test.
*Note:* invite-only beta via promo codes can technically run on **test keys** if you never charge — but the moment month 2 bills, you need live. Decide deliberately.

**5. Clerk production instance. [BLOCKS LAUNCH] — Effort: S**
*What:* Production Clerk app + allowed origins on the staging/cutover domain. Code path (`lib/tenant.ts`) already branches on `CLERK_SECRET_KEY` and provisions the owner Member on first sign-in.
*Why:* Dev instance = the Lighthouse a11y/perf noise AND not a real auth posture. Cheap, known, just-do-it.

**6. Secrets rotation. [BLOCKS LAUNCH] — Effort: S**
*What:* Rotate everything that passed through chat (Render API key explicitly flagged in ROADMAP; re-check OpenRouter, Stripe, Postmark, CRON/INBOUND/OPTOUT secrets).
*Why:* Pre-launch is the only cheap time to do this. A leaked Render key = someone can nuke or read your infra. **This could quietly kill you.**

**7. Legal review of the populated legal pages. [BLOCKS LAUNCH] — Effort: S (your time) / external (lawyer)**
*What:* The audit populated `/terms /privacy /dpa` etc. with entity/reg/email. A human lawyer must read them before real customers — especially the cancellation/billing terms now that there's no money-back and no trial.
*Why:* You're the legal sender on outbound; you're taking subscription money; the copy makes claims. One afternoon of a lawyer's time vs. an unbounded liability.

**8. Gmail CASA review. [does NOT block beta; blocks scale] — Effort: external/L**
*What:* The proactive Hunt sends from artists' own Gmail via `gmail.send` OAuth (shipped, 10.5). CASA verification is deferred to public launch / ~100 test users.
*Why:* Correctly deferred. But it has a **long external lead time** — start it the moment beta validates conversion (gate 10.9), or it becomes the thing blocking your public launch for weeks. Flag now so it's not a surprise.

**9. 7-day green soak + uptime monitor + backup-restore drill. [BLOCKS LAUNCH] — Effort: S**
*What:* Finish the Phase 7 leftovers: external UptimeRobot (2-min signup), confirm DB backups actually exist (was empty at hour 0), do one **restore** drill (an untested backup is not a backup).
*Why:* Solo founder + production data + paying customers = a restore you've never tested is a coin flip on your worst day.

---

### TIER 2 — The product loop's still-soft spots (high leverage for *retention*, not launch)

**10. Analytics / weekly-report as the in-app "proof surface." — Effort: M — does not block launch, but it's your anti-churn moat**
*What:* `lib/reports/weekly.ts` exists but only as an **email**. There is **no in-app analytics/usage dashboard** (`app/dashboard/` has calendar/leads/packages/profile/settings — no "results" view). Build the meter the pricing-strategy doc itself calls for: cadence used, pitches sent, leads handled, opportunities surfaced, median response time, gigs booked.
*Why:* This is **the entire honesty mechanism of the effort-based pricing.** You're selling "how hard the AI works"; the only way that doesn't feel like a broken promise is to *show the work*. ADR-003's retention physics: single-trick AI tools churn 50–70%; the proof surface is what converts effort into felt value. Highest-leverage non-launch item.

**11. Cadence cron infrastructure (per-tier scan frequency). — Effort: M — does NOT block launch**
*What:* Discovery cron runs **once daily for everyone** (`app/api/cron/discovery`). The effort ladder *sells* "daily / every-few-hours / continuous" per tier (ROADMAP 10.8). Today that dial is **copy without code** — if pricing copy promises Pro "every few hours," that's a new promise-you-don't-keep.
*Why:* Either (a) build the per-tier cadence before the copy claims it, or (b) **don't put cadence in the launch pricing copy** and gate on coverage/autonomy/roster (all of which ARE enforced). The trap to avoid is repeating the exact mistake you're fixing in #1 — selling a dial nothing enforces. **Recommendation: launch beta gating on coverage + autonomy + leads (all real today); add cadence to the ladder only when the cron lands.**

**12. Eval harness for venue pitches. — Effort: M — does not block beta, blocks confident scale**
*What:* The *draft* eval is solid (16 scenarios, judge, model selection → ADR-002). The *venue pitch* path has only `scripts/test-venue-pitch.ts` — no eval suite, no per-language scenarios (ROADMAP 10.8). Pitches are the proactive product's whole bet (gate 10.9 = conversion).
*Why:* You're about to send strangers' outreach from artists' real mailboxes. A mediocre or fabricating pitch burns the artist's domain reputation and your conversion bet simultaneously. Before auto-send scales past hand-watched beta, the pitch path needs the same eval discipline the draft path has. (You already caught one live fabrication in 10.3 — that's the warning shot.)

**13. The "still-unbuilt dials" honesty pass. — Effort: S (audit) — does not block, prevents future #1s**
*What:* Walk every dial the pricing copy will claim (cadence, coverage, depth, surfaced-opportunity counts, auto-send, seats) and label each: *enforced in code* vs *aspirational*. Only enforced dials may appear in launch copy.
*Why:* The "surfaced ~10/30/60 opportunities/wk" numbers in the strategy doc are **inferences nobody has validated against real `VenuePitch` volume.** In a thin market (solo magician, small city) the Hunt may not hit 10/wk — and then your effort claim under-delivers, which is the one thing your honesty-brand can't afford.

---

### TIER 3 — Queued / fenced (right calls; keep them fenced)

**14. Team Seats (Studio). — Effort: M — does NOT block launch**
*What:* `Member` model exists (with `clerkUserId`, `isOwner`), and owner-Member is created on first sign-in. **Missing:** invite flow, seat-count enforcement by plan, role/permissions, member management UI. It's a stub, not a feature.
*Why it's not urgent:* Studio is your smallest, last-to-arrive segment (touring/roster/small-agency). Your beachhead is **solo performers, one city** — almost none will need seats in the first 90 days. Building it now is effort against the wrong gate. Ship it when a real Studio prospect asks, or right after Gate 1. Don't let it sit ahead of #1–#3 just because it's "queued."
*Caveat:* if you put "team seats" in launch pricing copy (Studio), the same trap as #11 applies — either build a minimal real invite or soften the copy to "multi-performer routing" (which the schema *does* support) until seats ship.

**15. The v1.1 money path (quote→e-sign→deposit). — Effort: L (~3wk) — correctly Gate-1-gated. DO NOT BUILD YET.**
*What/Why:* This is the single most important *future* build — it's the perception cliff, the retention control point, the reason this isn't a $25 toy. ADR-003 fences it behind Gate 1 (≥10 paying, ≥3 arms-length) for good reason: building a 3-week money path before you've proven 10 people will pay for chapter one is how solo founders die. The `Business.bookingLinkUrl` bridge is the right interim. **Hold the line.** The discipline here is correct; the risk is the founder's "not until it's perfect" instinct pulling this forward pre-validation.

---

## What's being overlooked (the candid part)

1. **"Perfect before launch" is the actual top risk to the business.** Solo founder, pre-revenue, a fully-built product on staging, and the stated bar is "perfect." The kill condition in your own brief is Gate 1 — *you cannot reach Gate 1 without launching.* Every week of polish past "coherent + legal + secure" is a week of zero signal on the one question that matters: **will anyone pay an arms-length dollar?** The invite-only beta via promo codes is the perfect low-risk way to get that signal *now*. Ship the beta the moment Tier 0 + the cheap Tier 1 gates close.

2. **You've never had a real human run the loop end-to-end.** Every "verified" in ROADMAP is the founder/agent on the dev tenant. The "stranger test" (signup→onboard→first drafted reply <20min, no help) is still unchecked, and it's now *harder* because activation requires subscribing. The first time a real artist does this, you'll learn more than from any audit. Make that the beta's job-one.

3. **Conversion is the unproven bet, and you've instrumented it but not tested it.** Gate 10.9 (≥30% of beta artists get a real venue conversation in 14 days) is the whole proactive thesis. Reactive (answer inbounds) is commoditizing (The Knot's unified inbox + roadmap automation). The Hunt is your moat **only if venues actually reply.** Nothing in the code proves they will. The beta must measure venue reply-rate from day one — that number decides whether this is a business or a feature.

4. **Single-founder bus factor on infra.** Render key in chat, untested restore, no Sentry decision, self-pinged uptime. None individually fatal; collectively, one bad night with paying customers and no tested recovery path. The Tier-1 gates address this — don't skip the boring ones.

5. **The duplicate " 2" files will ship if ignored** — a small tell that the rework moved fast. Clean before launch (flagged).

---

## TOP 5 — do these next, in this order

1. **Finish the pricing-copy reframe + kill vestigial trial logic (Tier 0 #1+#2+#3 as one coherent change-set).**
   *Reasoning:* This is the live contradiction. Today the site sells a free trial the backend refuses to honor, and onboarding dead-ends at a silently-paused agent. It's a conversion-killer, a trust-killer, and a legal exposure — and it's the capstone the entire rework was for. Nothing else is worth doing while the front door lies about the product. Do copy + onboarding-activation + dead-trial-logic together so the subscribe-to-activate story is coherent from landing page to first drafted reply.

2. **Close the cheap launch gates: secrets rotation, Clerk prod, Stripe live + webhook, uptime + backup-restore drill (Tier 1 #4–#6, #9).**
   *Reasoning:* These are low-effort, known, and any one of them missed can quietly kill you (leaked key, untested backup, dev auth). They're the difference between "deployed" and "safe to put a stranger and their money on." Batch them; none is hard, all are non-negotiable for a real beta.

3. **Build the in-app analytics / proof surface (Tier 2 #10).**
   *Reasoning:* Your new pricing sells *effort*, and effort that isn't *shown* feels like nothing — that's how single-trick AI tools churn 50–70%. The weekly report exists as email; promote it into a dashboard "results" view (response time, leads handled, pitches sent, opportunities surfaced, gigs booked). This is your highest-leverage retention investment and it makes the founder's honest story *visible*, not just claimed.

4. **Launch the invite-only beta and instrument the two bets (stranger-test + venue reply-rate).**
   *Reasoning:* You can't reach Gate 1 from staging. The beta is cheap (promo codes, hand-picked artists, you watching every send) and it's the only way to learn whether (a) a real human can self-activate and (b) venues actually reply — the conversion bet the whole proactive thesis rests on. Get the lawyer review (Tier 1 #7) done in parallel so you're clean when real artists arrive. Start Gmail CASA (#8) the day conversion looks real, given its lead time.

5. **Decide the dials-honesty line, then build only what beta proves you need — in this order: pitch-eval harness → cadence cron → team seats; money path stays fenced until Gate 1.**
   *Reasoning:* Resist building ahead of signal. Audit which dials are real (#13) and keep launch copy to enforced ones (coverage/autonomy/leads). If beta validates conversion, the pitch-eval harness (#12) protects the bet at scale; cadence (#11) and seats (#14) follow demand; the money path (#15) — your biggest future lever — waits behind Gate 1 exactly as ADR-003 says. The founder discipline that could fail here is pulling the money path forward before 10 people pay. Don't.

---

**Key files referenced (all absolute):**
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/marketing/guarantee.ts` — the stale `RISK_REVERSAL` strings (root of the copy contradiction)
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/billing/metering.ts` — `isAgentPaused` (the real gate) + vestigial `trialDaysLeft`
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/billing/plan-features.ts` — SSOT; misleading TRIAL comment + dead 60/true values
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/app/actions/billing.ts` — `startCheckout`/`openBillingPortal` (built) + stale `billingState` trial logic
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/app/dashboard/settings/page.tsx` — plan cards + "after your trial ends" stale copy
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/components/onboarding-wizard.tsx` — no subscribe/activate terminal step
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/app/api/cron/discovery/route.ts` + `lib/discovery/scan.ts` — daily-for-all cadence (no per-tier dial yet)
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/lib/reports/weekly.ts` — email-only; no in-app analytics surface
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/prisma/schema.prisma` (Member model, ~line 157) — seat stub, no invite/enforcement
- `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/docs/PRICING-STRATEGY-JUNE-2026.md` — the effort-ladder spec to implement in copy
- Duplicate files to delete: `components/at-cap-banner 2.tsx`, `docs/AUDIT-FINDINGS 2.md`, `app/api/oauth/google 2/`