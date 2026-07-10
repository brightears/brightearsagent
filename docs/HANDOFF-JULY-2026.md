# Handoff — July 2026 build loop

**Branch:** `build/july-2026` (92 commits ahead of `main`, 186 files, +10,998 / −2,187).
**Status:** phases P0–P14 complete; P15 finale done except the two staging-only checks (15.3 E2E, 15.4 Lighthouse) which need the branch deployed — see FOUNDER GATES.
**Gates, last run:** tsc 0 · eslint 0 errors (4 pre-existing warnings) · 535 tests green · `next build` clean · live draft eval 19/19.

This is the "what changed" summary. The line-by-line record with commit hashes is `docs/BUILD-JULY-2026.md`; the audit that started it is `docs/PRODUCT-AUDIT-JULY-2026.md`.

---

## What shipped, in one breath

The audit's verdict was "the wedge is open and the engineering is above par, but the agent is passive." This loop made it active, end to end, for **every** performer kind — and then hardened and money-wired it.

- **The agent acts (P8, P10).** Nightly it auto-drafts venue pitches HOT-first, bumps a silent HOT pitch once at +6 days, captures venue replies into the normal pipeline, and drafts mid-thread answers. On trusted sources it auto-sends — behind a **15-minute "sending soon" cancel buffer** with a Hold button. Autonomy is *earned*: after 10 untouched approvals the queue offers auto-send for that source (never silently expanded).
- **Trust machinery (P10).** Evidence-source chips on every card, a spam folder with one-tap rescue, contact-confidence gating (the agent only auto-acts on addresses that are actually reachable), a visible "we heard you" when a skip re-tunes the hunt, and the speed stopwatch.
- **The money loop (P11).** Optional fee capture on "Mark booked" → booked-value receipts on the dashboard, the weekly report, and a new monthly ROI email. A deterministic booking-confirmation draft, a gig-brief PDF for the day of, all white-label and grounded.
- **Every-artist engine (P12 — your elevation).** Per-kind discovery query packs and scoring so a magician's hunt finds corporate planners and magic nights, a comedian's finds comedy clubs, a dancer's finds dinner shows — not DJ dialect. Verified with a live pitch eval across three non-music kinds (which caught and fixed a real availability-honesty bug). The EPK is booker-first now and its inquiry form feeds your own pipeline — the loop closes on itself.
- **Studio roster (P13).** Real this time: performer CRUD, per-performer availability on gigs and lead dates, `rosterCap` enforced — and the Studio marketing claims returned **in the same commit** as the enforcement.
- **Security + mobile (P9, P14).** Bottom-tab mobile IA, A2HS install prompt, agenda calendar; http(s)-only URL allowlist, public-surface rate limits + caching, right-most-XFF client IP, DNS-resolving SSRF guard, fail-closed-independent-of-NODE_ENV secret gates.

## The finale review (P15.2)

A 6-dimension adversarial workflow (findings put through a 3-skeptic refutation panel) ran over the whole diff. **13 findings survived and are all fixed** — including two HIGH send-path races: a Hold that could be out-run by the tick and still send, and a post-send DB failure that stranded a draft and could double-email a client. One residual (a DNS-rebinding TOCTOU in the image fetch) is documented as an accepted, bounded risk in `lib/pdf/images.ts` — a full fix needs connection-level IP pinning Next's fetch doesn't expose.

## Discipline held throughout

Work stayed on `build/july-2026` (never `main`). Additive migrations only. Every engine change got tests; every claim shipped with its enforcement. White-label, grounding, and the never-do guardrails were review-checked. Secrets never passed through the transcript.

---

## FOUNDER GATES — the batch (nothing else is blocked)

All code is merged-ready. These need **you** because they're credentials, external dashboards, or a live deploy:

1. **Merge the PR** (your review = the merge). Staging deploys on merge.
2. **Render env vars** (set on the service before/at deploy):
   - `STRIPE_PORTAL_CONFIG=bpc_1TqTj2G4fFsdyHFSLLhpadYl` (test-mode; the setup script prints the live one at cutover)
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://relative-bluejay-63.accounts.dev/sign-up`
3. **Staging E2E (15.3)** — run once staging is up: fresh signup → onboarding incl. home city → subscribe (Stripe test card) → first scan fires → auto-drafted pitch → approve → inbound fixture → reply-ready email → 375px mobile pass. I can drive this via Chrome against staging on your go-ahead.
4. **Lighthouse (15.4)** — on staging; record the numbers (expect Clerk-dev + CDN caveats).
5. **Parked ops items** (from P7, need the Render dashboard): live cron header-secret reconfigure (7.3 done in `render-crons.py`, the live URLs still need the header), `healthCheckPath` + UptimeRobot on `"cronsHealthy":true` (7.4), backup drill (7.10).

New migrations to apply on deploy (all additive): `draft_sending_claim`, `send_buffer`, `auto_send_graduation`, `gig_value`, `booking_confirmation`, `residency_play_kit`, `draft_auto_sent`.
