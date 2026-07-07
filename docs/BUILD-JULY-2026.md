# BUILD LOOP — July 2026: Audit fixes + Product Leap (A→Z)

**Founder mandate (2026-07-07):** execute the July-7 audit's recommendation *from A to Z* autonomously. He reviews once completely finished; interrupt him ONLY for secrets/credentials or truly blocked decisions. Chrome browsing on his session is authorized for web setup (Render dashboard, UptimeRobot, staging walkthroughs). **Explicit scope confirmation: this product is for EVERY freelance artist — musicians, DJs, bands, singers, magicians, actors, dancers, etc. Not DJ-only. The Hunt's matching must speak every performer kind.**

**Source of truth for findings:** `docs/PRODUCT-AUDIT-JULY-2026.md` (all file:line refs, post-verification). This doc is the build queue + living state. Mark `[x]` only when the acceptance passes locally; keep a STATE note current so any fresh session can resume.

---

## STATE (update every session)

- Status: **IN PROGRESS — started 2026-07-07**
- Current phase: **P1 + P2 COMPLETE** · next: P3 (coverage rotation — the sold-cities truth fix)
- Founder gates collected so far: (none yet)
- Last green gate run: 2026-07-07 — tsc 0 · lint 0 errors (4 benign warnings) · 426/426 tests · build OK
- Note: `lib/notify.ts` (P4.1's dual-channel helper) was built early as part of P2 — P4.1 becomes wiring-only.

---

## Ground rules

1. **Gates green every batch:** `npx tsc --noEmit` · `npm run lint` · `npm test` · `npx next build`. Commit per completed item (small, clear messages, end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`). **All work on branch `build/july-2026`** — push that branch after each green batch; NEVER push `main` directly (harness policy + founder review model). At the finale, open a PR — the founder's review = the merge; staging deploys on his merge.
2. **Never touch** `../brightears` or `../brightears26`. Never run destructive DB ops. Additive migrations only, named properly (no `" 2.sql"` dupes).
3. **Copy law:** subscribe-to-activate; no "no card"/trial language; no outcome promises (process promise only); no emoji anywhere in UI/emails; "inquiries" vocabulary user-facing; all-performer-kinds framing (never DJ-only). Design law = `docs/DESIGN.md` v2.1 (ink canvas, cyan interface / magenta-orange celebration voices, mono kickers, reduced-motion safety).
4. **Never-do guardrails (from research, permanent):** no credits/per-lead metering; no auto-renew traps (pausing stays trivial); no volume blasts (caps stay); disclosure-on-challenge stays hardcoded; never quote below floor; never imply the art is AI-made; never sit between artist and client; never silently expand autonomy; no digests on empty days.
5. **Founder-gate protocol:** when an item needs a credential/account/legal call — add it to FOUNDER GATES below with exact steps + link, skip, continue with the next item. Batch-ping him at the end (or immediately only if >30% of remaining work is blocked).
6. **Secrets never pass through the transcript.** Founder places keys in Render/.env.local himself; Chrome may be used on his logged-in dashboards without reading secret values aloud.
7. Engine changes get tests. New UI states get the responsive + reduced-motion treatment by default. LLM prompt changes respect grounding rules (no fabrication; regenerate-once-then-fail-loudly).

## OUT OF SCOPE (do not build in this loop)

Phase-8 cutover items (domain/DNS, Clerk production instance, Postmark approval, Stripe LIVE keys/webhook, CASA) · Telegram/WhatsApp bot (10.7 — next loop after founder review) · lawyer pass on legal pages (founder) · full money path quote→e-sign→deposit (Gate-1-locked per ADR-003) · i18n · native app · EU/UK targeting.

---

## P0 — Housekeeping

- [x] 0.1 Commit currently-untracked `.claude/skills/*` (gstack port, provenance README) and `docs/PRODUCT-AUDIT-JULY-2026.md` + this doc. Verify repo clean. *(8ec3657)*
- [x] 0.2 Fix the 3 existing eslint errors (control-room-nav rAF seed, wizard tz via useSyncExternalStore, test directive placement). *(4c29910)*

## P1 — Day-one activation (audit §onboarding, launch-blocker #1)

- [x] 1.1 `getSetupStatus` keyed on profile essentials (genres+headline+feeFloor) + voice — drop `packageCount` requirement; update `onboarding-banner.tsx` copy; test. *(e1946b5; voice-complete already honors the 1.5 skip-default: samples OR greeting/signoff)*
- [x] 1.2 Required **home city** field in wizard step 1 writing `serviceCities[0]` (extras preserved); Control Room stays the multi-city editor. *(4b5f33d)*
- [x] 1.3 **Scan on activation** via `lib/discovery/activation.ts` (next/server `after`, force, scan-guards intact): checkout completion, paused→live re-activation, first-city-ever save. Webhook tests cover all three; renewals/plan-switches never re-burn budget. Pricing FAQ "right away" is now TRUE — no reword needed. *(4b5f33d)*
- [x] 1.4 **One activation checklist** (components/activation-checklist.tsx) replaces the banner pile; OnboardingBanner deleted; AtCapBanner now subscribed-only. *(091b46e)*
- [x] 1.5 Voice step skippable with professional-default voice (skip never clobbers saved samples; defaults "Hi [name]," / "Best regards"); strength meter nags later. *(a2e02f9)*
- [x] 1.6 Hunting-license meter (live 8-item display twin of strength.ts) in wizard step 2 + license-gated step-5 finale copy. *(bdf7fe9)*
- [x] 1.7 State-aware Hunt empty state (unsubscribed / no city / profile incomplete / all-set-scan-queued) with real quiet links to the exact Control Room section. *(73471bf)*
- [x] 1.8 Post-checkout banner renders from actual plan state ("finalizing…" until webhook lands). *(7a23c76)*
- [x] 1.9 Placeholder tenant name never prefills stage-name fields (wizard + Control Room; detector in pure `lib/business-name.ts`). *(12013f5)*
- [x] 1.10 Resume honors skip-default voice + jumps to step 5 once a gig or lead proves the user passed the calendar. *(a2e02f9)*

## P2 — Gmail forwarding unblock (launch-blocker #2)

- [x] 2.1 Gmail forwarding-confirmation intercepted before parse/triage (exact-sender, spoof-guard tested); link+code stored on Business (migration `forwarding_confirmation`); live approval card in step 5 via the verify poll; owner pinged via new `lib/notify.ts` (push+email); walkthrough copy fixed. Outlook needs no equivalent (settings-confirmed, no email). *(789433d)*

## P3 — Coverage truth (launch-blocker #3)

- [ ] 3.1 Round-robin scan targets by `discoveryScanCount` across all plan-capped home cities; **reserve one slot for a live travel window** (travel outranks 2nd home city while a window is live). Tests: 3-city Pro, 25-city Studio, 2-home+travel. (`lib/discovery/scan.ts:160-173`)
- [ ] 3.2 Travel finds get full geo credit ("found for your trip" reason) + contact-discovery pass. (`lib/venues/score.ts:166`)
- [ ] 3.3 `splitCities` max honors the largest homeCityCap (25); truncate notice reflects the plan. (`app/actions/travel.ts:191`)

## P4 — Notify by default (launch-blocker #5)

- [ ] 4.1 `notifyBusiness()` helper: web push + **Postmark email fallback to ownerEmail** (deep link, throttled/deduped). Wire: reply-ready, they-wrote-back (ENGAGED), at-cap transition, auto-send failure. Tests.
- [ ] 4.2 Push-enable prompt at the moment of first value (first draft ready / first approval) — not buried in settings.
- [ ] 4.3 Draft-aging re-ping via the 30-min sequences cron: PENDING drafts older than ~4h re-notify once; "waiting Nh" age chip in the pipeline column.
- [ ] 4.4 Auto-send background failures: `reportError` + owner notification (draft still lands as PENDING). (`lib/inbound/pipeline.ts:193`)

## P5 — Billing edges (launch-blocker #6)

- [ ] 5.1 `subscription.updated` out-of-order guard (skip pause when `sub.id !== business.stripeSubscriptionId`; re-retrieve sub for live statuses). Tests incl. the abandoned-then-retried checkout scenario. (`lib/billing/webhook.ts:112-118`)
- [ ] 5.2 `startCheckout` already-subscribed guard → portal redirect instead of second subscription. (`app/actions/billing.ts:29`)
- [ ] 5.3 Stripe portal deep-link flows (`flow_data: subscription_update_confirm`) so at-cap "Upgrade" is genuinely one tap; portal configuration scripted in `stripe-setup.ts` (idempotent), incl. webhook-endpoint creation + printed cutover checklist (for later live run).
- [ ] 5.4 Plan ladder visible to subscribed users in the billing card (current tier marked, effort-axis framing).
- [ ] 5.5 Carry chosen plan pricing → onboarding → checkout (query param; terminal wizard step opens checkout for that plan).
- [ ] 5.6 TRIAL plan features fail closed (leadCap 0 / autoSend false / homeCityCap 1) + settings meter shows "subscribe to activate". (`lib/billing/plan-features.ts:32`)
- [ ] 5.7 At-cap push: transition-triggered only, copy branches subscribed vs not; add the cap-hit **sales email** ("N answered, M waiting — upgrade").

## P6 — Honesty + marketing sweep (launch-blockers #4, #7 + copy recs)

- [ ] 6.1 **Studio recut:** strip multi-performer/team-seats claims from pricing, comparisons.ts (all 6 spots), settings PLAN_CARDS, `scripts/stripe-setup.ts` catalog, llms.txt — re-anchor on enforced dials (150 inquiries, all cities, autonomy). (Roster ships in P13, claims return then.)
- [ ] 6.2 **llms.txt rewrite:** Hunt-led, every-performer-kind framing, "designed to" hedges, kill the fabricated median stat; hedge the 3 unhedged comparisons.ts metaDescriptions (337/416/540).
- [ ] 6.3 Delete `/design/a|b|c` routes (their job is done; they carry banned copy + emoji).
- [ ] 6.4 Publish an honest `/roadmap` page (shipped / building / on the roadmap incl. quote→e-sign→deposit) — or reword the 3 /compare citations; add to sitemap + link from compare.
- [ ] 6.5 Compare pages: add "Finds gigs for you (the Hunt)" row to all 5 vs-tables; kill the stale reactive-only "exactly one job" line on `/compare/dj-event-planner`.
- [ ] 6.6 Meta descriptions ≤~155 chars, find→draft→approve hook first (pricing worst at 353 chars).
- [ ] 6.7 Cite-or-soften recurring stats ("1 in 3 vendors never reply", "3–5 vendors per inquiry", "Bark $28–47") on /story, ROI calculator, /tools/templates.
- [ ] 6.8 ROI calculator recommends the tier matching the visitor's inputs (stop hardcoding $79).
- [ ] 6.9 Purge retired tagline "your gigs, answered and booked" (root layout default title, manifest.json description); branded 404 page with nav home.
- [ ] 6.10 "Sign in" link in marketing nav + mobile menu; "Get started" lands on sign-UP flow (not sign-in).
- [ ] 6.11 Sitemap: add 6 `/compare/*` pages, drop noindexed legal + auth-gated `/onboarding`.
- [ ] 6.12 OG/Twitter/canonical metadata site-wide (`metadataBase`, per-page og titles/descriptions) + one branded 1200×630 `og.png` (design per DESIGN.md, render via headless screenshot). Home page gets Organization + SoftwareApplication JSON-LD ($25/$79/$149 offers); fix /story Organization schema (url/logo currently point at the agency site, logo 404s).
- [ ] 6.13 **Env-gated indexing:** while `APP_URL` is the onrender.com staging host, serve `X-Robots-Tag: noindex` / robots disallow (flips automatically at cutover). Prevents staging becoming the canonical "Bright Ears".
- [ ] 6.14 Vocabulary: "inquiries" user-facing everywhere (billing card, cap banner, weekly email); weekly-report emoji removed; wizard ✓/⚙ glyphs → SVG/text; schema.prisma TRIAL comment updated to subscribe-to-activate.
- [ ] 6.15 Control Room: read-only "Follow-up cadence" card (day 2/5/9 + hard-stops) + per-plan effort-dials display ("how hard the AI works", current plan highlighted).

## P7 — Ops hardening (launch-blocker #8)

- [ ] 7.1 Fail closed in prod: missing Postmark token → throw unless `EMAIL_TRANSPORT=dev` explicit; missing SERPER_API_KEY → throw unless `DISCOVERY_PROVIDER=stub` explicit. (`lib/outbound/send.ts:34`, `lib/discovery/provider.ts:155`)
- [ ] 7.2 `reportError` wired into draft/sequence/discovery/billing catch paths (distinct kind strings, dedup respected). (`lib/sequences/engine.ts:128` etc.)
- [ ] 7.3 Cron wrapper honest: `res.ok` check + exit 1, `Authorization: Bearer` header (secret out of URL), timeout. Update `scripts/render-crons.py` AND reconfigure the live Render cron jobs (Render API if key available, else Chrome into dashboard). Also switch Postmark inbound webhook to header auth if reachable; else founder gate.
- [ ] 7.4 `/api/health` exposes cron freshness (lastSequenceTickAt, lastDiscoveryScanAt, weekly) + DB ping; Render healthCheckPath → `/api/health`; external uptime monitor on it (UptimeRobot via Chrome; founder gate if account creation blocked).
- [ ] 7.5 Boot-time env assert in `instrumentation.ts` register(): one loud log line per missing prod integration.
- [ ] 7.6 Security headers in `next.config.ts` (HSTS, nosniff, frame-ancestors, referrer-policy, permissions-policy).
- [ ] 7.7 Weekly-report cron per-tenant error isolation (sent+failed counts).
- [ ] 7.8 Time-budgeted resumable cron loops (order tenants by lastScanAt asc, ~60s budget, next tick resumes) — the 100-tenant fix.
- [ ] 7.9 CI: GitHub Action running tsc/vitest/eslint on push to main (deploy still Render-auto; CI is the tripwire).
- [ ] 7.10 Backup verify + one restore drill into a scratch DB (Render API/Chrome); write the runbook into DEPLOYMENT.md.
- [ ] 7.11 Nightly Stripe reconciliation sweep (list active subs, diff vs Business.plan/subscriptionId, self-heal + report).
- [ ] 7.12 Daily ops heartbeat email (leads in, drafts, sends, cron ticks, spend, margins) to OPS_ALERT_EMAIL.

## P8 — The agent acts (Theme A)

- [ ] 8.1 **Nightly auto-draft**: after each scan, draft top-scoring contactable venues up to existing HOT/WARM/SEED caps (isAgentPaused + license + jurisdiction + suppression respected; drafting ≠ sending — safe on all tiers). Costs metered via LlmUsage.
- [ ] 8.2 **Morning digest** (push + email, ONLY when there's something): "3 pitches ready to approve · 2 venues found" deep-linking to the queue.
- [ ] 8.3 **Reply capture:** pitch sends set `Reply-To` to the tenant parse address; pipeline recognizes venue replies (match on venue/pitch), status → REPLIED/ENGAGED, notifies owner, drafts a response in the artist's voice, and **instruments reply-rate** (the 10.9 gate finally measurable). Fixtures + tests.
- [ ] 8.4 One polite **HOT follow-up** ~6 days after send: approval-gated, STANDARD jurisdictions only, stops on reply/suppression, counts against caps. Scheduler in the daily cron.
- [ ] 8.5 **Autopilot follow-up sequences** (reactive) actually send on Pro/Studio for owner-trusted sources through `sendDraftReply` (same compliance path); Starter stays approve-each. Honest copy already sells this — make it true.
- [ ] 8.6 **Weekly report v2:** Hunt numbers (cities scanned, venues found, pitches sent, replies, booked) + big-number scannable format, no emoji, "N drafts waiting" action line.
- [ ] 8.7 **Receipts strip** on dashboard home: "While you were away — scanned 2 cities, found 3 venues, drafted 2 pitches", each deep-linking.
- [ ] 8.8 Feed hygiene: re-score all non-suppressed venues each scan (pure function, free), stale-HOT auto-arc (opening decided → WARM/archive), monthly query-template rotation.
- [ ] 8.9 Skip reasons tune matching (cheap rules: 2+ WRONG_VIBE on a kind → downweight; repeated TOO_FAR in a city → radius note) + visible acknowledgment ("Got it — fewer hotel lobbies").

## P9 — The 30-second phone habit (Theme B)

- [ ] 9.1 16px form controls at base breakpoint (kills iOS focus-zoom) across wizard/settings/drafts (~6 shared style constants).
- [ ] 9.2 44px min tap targets + full-width mobile Approve on venue-pitch-review + hunt-feed (copy draft-review's pattern).
- [ ] 9.3 **Bottom tab bar** below lg: Today / Hunt / Calendar / Control room, count badges, safe-area-inset padding.
- [ ] 9.4 **"Today" approval-queue-first** mobile home: pending lead drafts + pending pitches stacked, count-badged, above Hunt/pipeline.
- [ ] 9.5 Agenda-list calendar below `sm` (grouped by day; grid stays at sm+); step-4 date rows stack on mobile.
- [ ] 9.6 PWA finish: 180px apple-touch-icon, maskable 192/512 icons, manifest description update (+ screenshots for the rich install sheet); custom A2HS prompt right after first approval.
- [ ] 9.7 Trim HeroCollage below `sm` (demo widget arrives a screen sooner); vinyl-spin gets prefers-reduced-motion kill.
- [ ] 9.8 GigSalad (no-email leads) reply kit: "Copy reply" + "Open on GigSalad" replaces Approve when clientEmail is null.

## P10 — Trust machinery (Theme C)

- [ ] 10.1 Evidence chips on Hunt cards (genre match, distance, "hosts live music weekly", source link) — extend existing fit reasons with provenance links.
- [ ] 10.2 "Not my kind of venue" one-tap → visible tuning ack, feeds P8.9 rules.
- [ ] 10.3 **Autonomy graduation prompts** in the queue ("You approved 10 follow-ups untouched — auto-send these? [Yes] [Keep reviewing]") writing through the same Control Room setting (one-writer invariant).
- [ ] 10.4 **"Sending soon" 15-min cancel buffer** on all autonomous sends (auto-send replies, autopilot follow-ups): visible holding state + Hold button; queue section lists upcoming sends.
- [ ] 10.5 Contact-confidence gating: only auto-actions to high-confidence addresses; low-confidence → "verify before sending" flag on the card.
- [ ] 10.6 Spam folder with one-tap rescue ("Not spam → draft reply") behind the existing spam-filtered pill; spamReason shown.
- [ ] 10.7 Per-artist speed stopwatch ("your median first reply: N min") on dashboard + weekly report (honest: only when data exists).
- [ ] 10.8 Mid-conversation draft mode (third task mode: continue the thread, don't re-introduce). (`lib/agent/drafter.ts:130`)
- [ ] 10.9 HTML-only inbound bodies stripped to text once in processInbound. (`lib/inbound/parsers/fallback.ts:39`)
- [ ] 10.10 Atomic claim in `sendDraftReply` (updateMany PENDING→SENDING) closing the reactive double-send window. (`lib/agent/send-reply.ts:41`)
- [ ] 10.11 Auto-send source list matches reality: classify form-system senders as WEBSITE_FORM; drop never-occurring options from the card. (`components/auto-send-card.tsx:21`)

## P11 — Money loop, pre-Gate-1 slice (Theme D)

- [ ] 11.1 Fee capture on "Mark booked" (optional field, prefilled from quote) → Gig.value; booked VALUE in weekly report + Results surface.
- [ ] 11.2 Drafted booking-confirmation email on booked (carries bookingLinkUrl + quote PDF; owner approves like any draft).
- [ ] 11.3 Gig-brief PDF artifact on booking (date, venue, set times, requests, load-in, contact — from the thread; grounded, no invention).
- [ ] 11.4 Monthly ROI receipt email: answered X, pitched Y, won Z gigs worth <currency>N vs subscription cost (honest, only with real data; no projections).

## P12 — Every-artist engine (Theme E — founder-elevated: ALL kinds)

- [ ] 12.1 **Per-performerKind query packs** for the Serper battery (all enum kinds: DJ, band, singer, magician, dancer, actor/entertainer, photo booth, etc.) + venue-type expansion (corporate planners, theaters, event/private-event spaces, hotels, cruise/resort entertainment, wedding venues).
- [ ] 12.2 KIND_AFFINITY expanded so non-music kinds score their real buyers at full credit; tests per kind; pitch templates stay kind-aware (PERFORMER_KIND_COPY exists — reuse).
- [ ] 12.3 Pitch-quality spot-eval for 3 non-music kinds (extend the 16-scenario suite minimally) — grounding + white-label hold.
- [ ] 12.4 Residency play kit v1: venue staff-notes field (names met, visits), trial-night converter framing in WARM pitches (profit-framed, "easy life and a profit"), 180-day re-touch surfaced as a "warm again" card (data already stored).
- [ ] 12.5 EPK booker-first reorder: playable media above the fold, one live video slot, 50–100 word bio, 3 photos, sticky "Check availability" CTA → inquiry form that feeds the tenant's own inbound pipeline (the loop closes on itself).
- [ ] 12.6 EPK freshness monitor: weekly link-rot check on EPK/media links; nag via notifyBusiness when something 404s or media is missing ("no live video" = bookers' #1 deal-breaker).
- [ ] 12.7 "Usually responds fast" EPK badge — shown only when the stopwatch has real data (honest).
- [ ] 12.8 Right-contact improvements (bounded): prefer events/booking pages, detect promoter-vs-venue contacts, store role labels; NO scraping beyond current provenance rules.
- [ ] 12.9 Draw-proof block in pitches where data exists (recent gigs count from calendar, notable venues, review quote) — grounded only, never invented.

## P13 — Studio minimal roster (restores the recut claims honestly)

- [ ] 13.1 Performer CRUD in Control Room (add/edit/deactivate performer; kind + name).
- [ ] 13.2 Gigs taggable to a performer (calendar assignment UI exists per Phase-3 build — verify + surface); availability engine already multi-performer.
- [ ] 13.3 Inbound draft availability uses per-performer free/partial logic visibly ("DJ Nok is free; Mai has a wedding").
- [ ] 13.4 THEN restore Studio multi-performer claims across pricing/comparisons/settings/llms.txt/Stripe catalog — claims and code ship in the same commit. plan-features gains `rosterCap` (Starter 1 / Pro 1 / Studio N) enforced at save.

## P14 — Security mediums (pre-cutover hardening)

- [ ] 14.1 http(s)-only scheme allowlist on all artist-supplied URLs (zod refine). (`app/actions/profile.ts:54`)
- [ ] 14.2 Rate-limit + cache public EPK page + press-kit PDF (IP+slug; Cache-Control + small in-process cache).
- [ ] 14.3 Rate-limit IP from trusted right-most XFF hop. (`lib/rate-limit.ts:37`)
- [ ] 14.4 SSRF guard resolves DNS and re-checks IPs against private ranges. (`lib/pdf/images.ts:29`)
- [ ] 14.5 Fail-closed posture independent of NODE_ENV (require secrets whenever public APP_URL set). (`lib/auth-secret.ts:12`)

## P15 — Finale

- [ ] 15.1 Full gates + `npx next build`; fix all drift.
- [ ] 15.2 Multi-agent adversarial code review (workflow) over the entire loop diff; fix confirmed findings.
- [ ] 15.3 Staging E2E via Chrome: fresh signup → onboarding (all steps incl. home city) → subscribe (Stripe test card) → first scan fires → auto-drafted pitch appears → approve → verify send gates → inbound fixture → reply-ready email lands → mobile (375px) pass on Today/Hunt/approve.
- [ ] 15.4 Lighthouse re-run on staging (expect Clerk-dev + CDN caveats; record numbers).
- [ ] 15.5 Sync docs: ROADMAP checkboxes, CLAUDE.md (Studio/roster, notifications, agent-acts reality), PRODUCT-BRIEF drift (trial→subscribe-to-activate §7, dark design §8, all-artists positioning), DEPLOYMENT.md runbook.
- [ ] 15.6 Update the audit artifact (same URL) into a "what changed" build report; write founder handoff summary + FOUNDER GATES batch list; update memory.

---

## FOUNDER GATES (collect here; batch-ping at the end unless hard-blocked)

*(none yet)*

## DECISIONS LOG

- 2026-07-07: Founder confirmed ALL freelance-artist kinds (musicians, magicians, actors, dancers…) — not DJ-only. Marketing may still lead DJ-first; engine + copy must be kind-complete.
- 2026-07-07: Studio strategy = recut copy NOW (P6.1), build minimal roster later in this loop (P13), claims return with the code.
- 2026-07-07: Auto-draft nightly = YES (draft-only is tier-safe); autonomous SENDS stay behind autonomy settings + new 15-min cancel buffer.
- 2026-07-07: Reply-To reply capture = YES (white-label preserved: Reply-To is the artist's own parse address, From stays the artist's Gmail).
- 2026-07-07: Direct pushes to `main` denied by harness policy → all work lives on `build/july-2026`; PR at finale = founder's review moment; staging E2E (15.3) runs against a local dev server pre-merge, staging re-verify happens post-merge.
