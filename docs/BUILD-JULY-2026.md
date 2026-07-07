# BUILD LOOP — July 2026: Audit fixes + Product Leap (A→Z)

**Founder mandate (2026-07-07):** execute the July-7 audit's recommendation *from A to Z* autonomously. He reviews once completely finished; interrupt him ONLY for secrets/credentials or truly blocked decisions. Chrome browsing on his session is authorized for web setup (Render dashboard, UptimeRobot, staging walkthroughs). **Explicit scope confirmation: this product is for EVERY freelance artist — musicians, DJs, bands, singers, magicians, actors, dancers, etc. Not DJ-only. The Hunt's matching must speak every performer kind.**

**Source of truth for findings:** `docs/PRODUCT-AUDIT-JULY-2026.md` (all file:line refs, post-verification). This doc is the build queue + living state. Mark `[x]` only when the acceptance passes locally; keep a STATE note current so any fresh session can resume.

---

## STATE (update every session)

- Status: **IN PROGRESS — started 2026-07-07**
- Current phase: **P14 DONE** (all 5 security mediums) — next: P15 FINALE (review → staging E2E → docs sync → handoff report)
- LESSON (applied): gate on vitest's real exit code — a grep pipe swallowed 3 failures once (fixed in the follow-up commit)
- Parked for the RENDER/EXTERNAL Chrome pass (or FOUNDER GATE): 7.3 live cron commands · 7.4 healthCheckPath + UptimeRobot ("cronsHealthy":true keyword) · 7.10 backup drill · new Render env vars: STRIPE_PORTAL_CONFIG=bpc_1TqTj2G4fFsdyHFSLLhpadYl · NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://relative-bluejay-63.accounts.dev/sign-up
- Render env var to set when P7 touches Render: `STRIPE_PORTAL_CONFIG=bpc_1TqTj2G4fFsdyHFSLLhpadYl` (test mode; setup script prints the live one at cutover)
- Founder gates collected so far: (none yet)
- Last green gate run: 2026-07-07 — tsc 0 · lint 0 errors (4 benign warnings) · 530/530 tests · build OK · live draft eval 19/19
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

- [x] 3.1 Round-robin rotation by `discoveryScanCount` within plan cap + reserved travel slot (multi-window rotation, travel-takes-all when no home). 5 new tests incl. the starved multi-city travel case. *(bd94995)*
- [x] 3.2 Travel finds score full geo ("found for your trip") at ingest, re-ingest AND contact re-score — starvation out of the contact pass fixed via ranking. *(bd94995)*
- [x] 3.3 `splitCities` sanity bound raised to 100 (> Studio's 25 cap); trim notice now sees everything typed. *(bd94995)*

## P4 — Notify by default (launch-blocker #5)

- [x] 4.1 `notifyBusiness()` wired: reply-ready, they-wrote-back (was silent), at-cap TRANSITION-only w/ state-branched copy (covers 5.7's sales email), auto-send success (pushOnly) / blocked (dual) / failure (dual + reportError). *(36732aa)*
- [x] 4.2 PushPrompt at the first-value moment (ready draft on lead detail); dismiss honored forever; shared plumbing in lib/push-client.ts. *(36732aa)*
- [x] 4.3 One aging nudge per draft at ~4h (agingPingAt migration; stamp-first, paused tenants silent) + "waiting Nh" chips on drafted cards. *(36732aa)*
- [x] 4.4 Auto-send failures: reportError(kind:auto-send) + owner action ping. *(36732aa)*

## P5 — Billing edges (launch-blocker #6)

- [x] 5.1 `updated` out-of-order guard + re-retrieve (orphan can't pause a paying tenant; stale active can't resurrect a dead plan). Regression tests for both. *(e3a3189)*
- [x] 5.2 startCheckout routes subscribed tenants to openPlanChange — double-subscribe impossible; recursion-guarded. *(211cae0)*
- [x] 5.3 openPlanChange deep-links subscription_update_confirm (proration shown, one confirm); stripe-setup.ts upserts portal config (RAN in test mode — STRIPE_PORTAL_CONFIG in .env.local) + optional --with-webhook endpoint registration + founder checklist print. *(211cae0)*
- [x] 5.4 Plan ladder for subscribers (current marked, Upgrade/Switch one-tap); blurbs recut to enforced claims, "inquiries" vocabulary. *(351222a)*
- [x] 5.5 ?plan= rides pricing → sign-up → wizard; step-5 finale opens checkout for exactly that plan. *(351222a)*
- [x] 5.6 TRIAL fails closed (0 / false / 1); stale mirror-PRO rationale removed; contract tests updated. *(25a3290)*
- [x] 5.7 Done in P4.1 (transition-only, state-branched copy, dual-channel sales email). *(36732aa)*

## P6 — Honesty + marketing sweep (launch-blockers #4, #7 + copy recs)

- [x] 6.1 Studio recut everywhere (pricing card+FAQ, comparisons ×8, llms.txt; settings PLAN_CARDS in 351222a; Stripe catalog in 211cae0). *(c16379f)*
- [x] 6.2 llms.txt rewritten Hunt-first / all-kinds / hedged; fabricated stat killed. *(c16379f)*
- [x] 6.3 /design routes deleted. *(e908981)*
- [x] 6.4 Honest /roadmap page published (shipped/building/roadmap + non-goals line), in sitemap. Compare-hub link check rides with 6.5. *(e908981)*
- [x] 6.5 Hunt row = row one on all 5 tables (competitor-accurate notes); DJEP framing fixed. *(c16379f)*
- [x] 6.6 Six compare metaDescriptions + pricing meta rewritten ≤155, hedged, hook-first. *(c16379f)*
- [x] 6.7 Stats attributed to couples' own accounts + ROI footnote; Bark number pinned to verified-pricing convention. *(c16379f)*
- [x] 6.8 ROI bridge recommends the input-fitting tier and carries ?plan= into the funnel. *(c16379f)*
- [x] 6.9 Tagline purged (root title + manifest); branded 404. *(e908981)*
- [x] 6.10 Sign in links added; /onboarding redirects unauthenticated → Clerk sign-UP (NEXT_PUBLIC_CLERK_SIGN_UP_URL in .env.local; add to Render in P7). *(e908981)*
- [x] 6.11 Sitemap inversion fixed (+/roadmap). *(e908981)*
- [x] 6.12 metadataBase + canonical './' + OG defaults; app/opengraph-image.tsx (next/og ImageResponse — better than a static og.png: no asset to 404); pageMeta() per-page og titles on 9 key pages + compare/[slug]; home Organization+SoftwareApplication JSON-LD; story schema env-driven. *(4c8a527)*
- [x] 6.13 Staging noindex: robots.ts disallow-all + root-metadata robots flag, both keyed on onrender.com in APP_URL. *(e908981)*
- [x] 6.14 Vocab + glyph sweep complete (billing card 351222a; glyphs/schema e908981; at-cap banner, weekly email, dashboard welcome 18b8b74). *(18b8b74)*
- [x] 6.15 Cadence section in the Control Room: real stepsDays rhythm card + per-plan dials table with the tenant's plan marked. *(18b8b74)*

## P7 — Ops hardening (launch-blocker #8)

- [x] 7.1 Postmark + Serper fail closed in prod (explicit opt-outs preserved). *(ffaa7f4)*
- [x] 7.2 reportError in sequence-step, sequence-redraft, draft-generation, discovery-scan, weekly-report, auto-send (P4) catches. *(ffaa7f4)*
- [x] 7.3 Wrapper fixed in scripts/render-crons.py (header auth, res.ok, 120s abort, exit 1). LIVE cron reconfigure + Postmark webhook header → Render/external pass. *(ffaa7f4)*
- [x] 7.4 OpsStamp heartbeats in all four crons + /api/health cronsHealthy (keyword-monitorable; Render restart check unaffected). healthCheckPath + UptimeRobot → Render/external pass. *(ffaa7f4, abf85b4)*
- [x] 7.5 17-var prod env contract logged at boot (node runtime only; use-time guards still fail closed). *(ffaa7f4)*
- [x] 7.6 Five baseline headers; CSP deliberately deferred (Clerk + inline JSON-LD need a curated policy). *(ffaa7f4)*
- [x] 7.7 Weekly reports per-tenant isolated; route returns {sent, failed}. *(ffaa7f4)*
- [x] 7.8 Discovery: LRU-first under a 240s wall budget (cut-off tenants lead tomorrow); sequences: 200/tick most-overdue-first. *(abf85b4)*
- [x] 7.9 .github/workflows/ci.yml — tsc + lint + vitest on push/PR. *(ffaa7f4)*
- [ ] 7.10 Backup verify + one restore drill into a scratch DB (Render API/Chrome); write the runbook into DEPLOYMENT.md.
- [x] 7.11 reconcileStripe() both directions (pause dead/missing subs, re-attach missed-webhook live subs via metadata) on the nightly tick. *(abf85b4)*
- [x] 7.12 Nightly proof-of-life digest (counts + margins + reconcile + stale-cron warnings), sent every night by design. *(abf85b4)*

## P8 — The agent acts (Theme A)

- [x] 8.1 autoDraftPitches on the discovery cron: HOT-first fit-ranked, identical guard ladder via extracted lib/venues/draft-pitch.ts, caps-before-LLM-spend, per-temperature cap stops, 5 tests. *(26adbfd)*
- [x] 8.2 'Your agent worked overnight' dual-channel digest, only when pitches were drafted or venues found. *(26adbfd)*
- [x] 8.3 Reply capture live: Reply-To = parse address; first venue reply → ENGAGED Lead (VENUE_OUTREACH, Lead.venueId) in the existing close pipeline; later replies ride normal reply-match; venue REPLIED/IN_CONVERSATION + repliedAt (10.9 measurable); dual-channel "venue wrote back" ping. Drafted RESPONSE deferred to 10.8's continue-thread mode (noted at 8.x). *(20e114b)*
- [x] 8.4 Deterministic HOT bump at +6d (one ever, STANDARD-only, PITCHED-only, HOT cap counted; migration hot_follow_up), rides the daily tick + digest. *(committed this iteration)*
- [x] 8.5 Sequence steps auto-send on Pro/Studio trusted sources via sendDraftReply; receipts pushOnly, failures degrade to PENDING + dual ping. *(committed this iteration)*
- [x] 8.6 Report v2: INQUIRIES/THE HUNT/IN MOTION/BOOKED big-line layout, venue replies counted, one action line, hunt-only weeks report. *(this iteration)*
- [x] 8.7 ReceiptsStrip (last-24h proof of work, timestamp-derived, hidden on quiet days) above the checklist. *(this iteration)*
- [x] 8.8 rescoreVenues on every scan + 60d stale-HOT→WARM arc, ordered BEFORE auto-draft. Template rotation folds into P12.1's battery rewrite. *(this iteration)*
- [x] 8.9 downweightedKinds (2+ WRONG_VIBE) halves kind credit with the visible 'skipped rooms like this before' reason, applied in the rescore pass. TOO_FAR/radius rule deferred (homeRadiusKm is still advisory). *(this iteration)*

## P9 — The 30-second phone habit (Theme B)

- [x] 9.1 16px base on all five shared constants + draft textarea. *(fedd536)*
- [x] 9.2 Approve/Edit/Send now: min-h-11 + full-width below sm. *(fedd536)*
- [x] 9.3 BottomTabs (Today/Calendar/Results/Packages/Control, Today badge, safe-area). *(this iteration)*
- [x] 9.4 NeedsYou queue first on the dashboard (drafts deep-linked, pitches anchored, age chips). *(this iteration)*
- [x] 9.5 Agenda-list calendar below `sm` (grouped by day; grid stays at sm+; shared GigChip). Step-4 row stacking DONE *(fedd536)*. *(75f8bea)*
- [x] 9.6 Icons DONE (180 apple + 192/512 + maskable, manifest + metadata). A2HS prompt: dashboard, after first approval, phones only, iOS directions / Chromium beforeinstallprompt button. *(75f8bea)*
- [x] 9.7 HeroCollage hidden below sm; vinyl-spin reduced-motion kill. *(fedd536)*
- [x] 9.8 GigSalad (no-email leads) reply kit: Copy reply + Open GigSalad + "I sent it there" (markSentOnPlatform: draft resolved, no-email outbound on thread, REPLIED + first-reply stamp, ENGAGED never demoted, no sequence started). *(75f8bea)*

## P10 — Trust machinery (Theme C)

- [x] 10.1 Evidence receipts: freshest 3 signals render as hostname provenance chips on Hunt cards (deduped per publication, summary on hover). *(7eb378a)*
- [x] 10.2 WRONG_VIBE skip acks visibly: redirect to /dashboard?tuned=<kind>; strip says "now rank lower" (2+ skips, the real rescore threshold) or "skip one more". *(7eb378a)*
- [x] 10.3 Graduation prompts: 10 untouched approvals per source → queue offers auto-send; Yes posts THROUGH updateAutoSendSources (one writer); Keep reviewing remembered server-side (autoSendDeclinedSources migration). *(e57235a)*
- [x] 10.4 Send buffer: Draft.scheduledSendAt (+15m, migration); pipeline + autopilot schedule instead of send; runScheduledSends fires first in the tick; Hold in NeedsYou (auto-sends in Nm) + lead-page strip; approve-early always wins (10.10 claim). *(5e09420)*
- [x] 10.5 Contact confidence: Hunt autoDraft skips generic info@ (contactConfidence; named contact or events@/bookings@ = high) + card flag; reactive auto-send requires clientEmailGrounded (parser/sender/body-literal) + lead-page verify pill. *(cec121f)*
- [x] 10.6 Spam folder /dashboard/spam behind the (now linked) pill: spamReason per row, one-tap rescue → NEW + draft + deep-link. *(1f69998)*
- [x] 10.7 Speed stopwatch: median-first-reply pill in dashboard header (hidden when no data); math shared via medianReplyMinutes; weekly email already had it. *(1f69998)*
- [x] 10.8 Mid-conversation draft mode: continue-the-thread task; client reply-match + venue replies fire cap-gated mid-thread drafts (suppressPush); venue lead threads seeded with the sent pitch (backdated OUTBOUND). *(b9c41db)*
- [x] 10.9 HTML-only inbound stripped once at the top of processInbound (lib/inbound/html-to-text.ts — labeled form fields keep field-per-line shape). *(6b82b88)*
- [x] 10.10 Atomic claim in sendDraftReply: updateMany PENDING→SENDING (new enum value, additive migration); thrown send releases claim to PENDING. *(6b82b88)*
- [x] 10.11 Fallback classifies form-system senders as WEBSITE_FORM; auto-send card drops Thumbtack/Other (never produced). *(6b82b88)*

## P11 — Money loop, pre-Gate-1 slice (Theme D)

- [x] 11.1 Fee capture on Mark booked (optional, quote-prefilled, both surfaces) → Gig.value (migration); booked-value tiles on Results + weekly "worth X" line; lib/quote/fee.ts parse/format tested. *(0de2047)*
- [x] 11.2 Booking-confirmation draft on booked: deterministic (no LLM — contractual), voice greeting/signoff + grounded facts (date/venue/fee/bookingLinkUrl), wantsQuote pre-arms the PDF; isConfirmation carve-out is the ONE send allowed on BOOKED (stays BOOKED, never starts a sequence; both tested). *(ee45924)*
- [x] 11.3 Gig-brief PDF (/api/gig-brief/[leadId], BOOKED only, Documents strip link): parsed facts + calendar entry render unconditionally; extraction-ONLY thread pass fills requests/logistics, degrades to empty sections. *(66bb11d)*
- [x] 11.4 Monthly ROI receipt (1st UTC via nightly ops cron): answered/found/pitched/won + captured value in artist currency next to plan USD; paying tenants only, empty months silent, no projections. *(27d79d4)*

## P12 — Every-artist engine (Theme E — founder-elevated: ALL kinds)

- [x] 12.1 Per-kind query packs (lib/discovery/query-packs.ts, all 10 enum kinds): warm battery + extraction prompt speak each kind's buyer language; venue-type expansion in packs (theaters, planners, dinner shows, resorts, corporate spaces → EVENT_SPACE); same 8-query cap recut, never grown; HOT battery stays kind-agnostic by design. *(9a34df1)*
- [x] 12.2 KIND_AFFINITY carries non-music acts at every venue kind (full credit for magician/comedian/dancer/photo-booth/host at their buyers, tested per kind); reason copy de-musicked; pitch prompt already kind-aware (verified). *(7e3f610)*
- [x] 12.3 Non-music spot-evals (magician/comedian/dancer, own rate cards; runner grounds prices per scenario) — live run 19/19 PASS 0 safety; caught+fixed a REAL normalizer bug (conflict branch now refusal-first, both directions unit-tested); runner got the regenerate-once retry. *(c6dd5db)*
- [x] 12.4 Residency play kit v1: staffNotes on Hunt+In-play cards (private, capped, never in prompts); WARM CTA = profit-framed no-risk trial night (on-file fallback); 180-day re-touch arc in rescore (PITCHED+silent → QUALIFIED+WARM, retouchedAt chip; replied venues never arc). *(fedb933)*
- [x] 12.5 EPK booker-first: clamped hero bio (~100w), video then 3 photos, sticky CTA pill, mailto replaced by a real inquiry form → tenant's own pipeline (synthetic WEBSITE_FORM notification; honeypot + validation; white-label held). *(b4ff266)*
- [x] 12.6 EPK freshness sweep (rides weekly cron): artist-owned links only; BROKEN = hard 404/410/dead-DNS only (bot walls never flagged); missing-video nag; per-tenant isolation. *(506a3cb)*
- [x] 12.7 "Usually replies within the hour" hero badge — only with 5+ first replies in 90d and median ≤60min. *(506a3cb)*
- [x] 12.8 Right-contact: events/booking paths first; role labels in contactSource; external promoter/agency domain flag (free-mail never flagged); provenance rules untouched. *(4c35043)*
- [x] 12.9 Draw-proof: recentGigs90d (3+ calendar gigs) joins the pitch ammo; rule 3 allows exactly ONE woven proof (rooms/schedule/quote); rule 2b grounding binds. *(4c35043)*

## P13 — Studio minimal roster (restores the recut claims honestly)

- [x] 13.1 Roster section in Control room: add/rename/re-kind/deactivate-reactivate (history kept, tenant-scoped). *(1f2018f)*
- [x] 13.2 Verified existing: gig form performer select + chip render + multi-performer availability engine — surfaced as-is. *(1f2018f)*
- [x] 13.3 Lead page roster-on-the-date strip (2+ active performers + a date): "Nok — free · Mai — booked (title)"; client copy still never names names. *(1f2018f)*
- [x] 13.4 rosterCap 1/1/1/10 in plan-features (enforced at save AND reactivation, tested); Studio claims restored (pricing feature+FAQ, plan card, Stripe catalog) in the SAME commit as enforcement. *(1f2018f)*

## P14 — Security mediums (pre-cutover hardening)

- [x] 14.1 http(s)-only refine on the shared urlSchema. *(e61502a)*
- [x] 14.2 PDF: IP+slug rate limit + 10-min render cache + public Cache-Control; EPK page → 5-min ISR; inquiry form capped per IP+slug. *(e61502a)*
- [x] 14.3 clientIp = right-most XFF hop (spoof-proof with one trusted proxy). *(e61502a)*
- [x] 14.4 resolvesToBlockedIp (all A/AAAA re-checked; ::ffff: unwrapped; unresolvable = blocked; injectable resolver, tested). *(e61502a)*
- [x] 14.5 failClosed() = production OR public https APP_URL — secret gates deny either way. *(e61502a)*

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
