# NATIVE-APP-LOOP — iOS + Android companion app (run in a fresh session)

**How to run:** open a new session (Opus 4.8, ultracode + fast mode). The app should live in its **own new directory/repo**, NOT inside brightears-app and NEVER touching `../brightears` or `../brightears26`. Paste:

> `/loop Read docs/NATIVE-APP-LOOP.md in the brightears-app repo and execute it to completion — build the Bright Ears mobile app phase by phase per the plan, in its own repo, looping until each phase is built-and-verified or blocked on a founder gate logged in MOBILE-PROGRESS.md. Use ultracode workflows. Report progress each iteration.`

Resumable: maintain `MOBILE-PROGRESS.md` (in the new mobile repo) as the living phase checklist + founder-gate log. Stop when all phases are done or blocked on a gate.

## Why & what
Mobile DJs should run everything from their phone — get pushed "reply ready" / "venues found", approve/edit/send pitches, connect Gmail, manage settings — **without a computer and without wiring up Telegram/WhatsApp**. A native app + push notifications *replaces* the chat-bot control plane entirely (simpler, one surface). It is a **thin client over the existing Next.js/Render backend** — do NOT rebuild the backend.

## Recommended architecture (June 2026)
- **Expo (managed React Native)** — chosen for TypeScript reuse with the existing Next.js 16 codebase, one codebase for iOS+Android, OTA JS updates via EAS Update, first-party push/OAuth/secure-storage, solo-maintainable. (Flutter rejected: second language stack, no OTA for native.)
- **Backend reuse:** Next.js **Server Actions are not callable from a native app.** Add versioned JSON **Route Handlers under `app/api/mobile/*`** in brightears-app (extract logic from server actions into shared `lib/` functions first where needed). This is real backend work in the existing repo — keep it additive and tested; never break the web app.
- **Auth:** `@clerk/expo` with secure token cache (iOS Keychain / Android Keystore via `expo-secure-store`). App sends the Clerk session token as a `Bearer` header; Route Handlers verify networklessly via Clerk JWKS.
- **Push (the Telegram/WhatsApp replacement):** Expo Push over APNs + FCM, one push token per device, $0 setup. Backend cron/inbound jobs POST the device token to Expo's push service; the notification payload deep-links straight into the approve screen.
- **Gmail OAuth on mobile:** system-browser flow (`expo-web-browser` / `expo-auth-session`), NOT an embedded webview. Same `gmail.send` restricted scope as web.
- **Billing stays on web only** (Stripe) — do NOT add Apple IAP (avoids the 30% commission + external-link pitfalls). The app links out to the web billing portal.

## Hard rules
- Own repo; never touch the live agency stack or break the web app. Additive backend changes only, fully tested.
- Don't submit to the stores or publish OAuth without founder sign-off on the gated items below.

## Phased build plan (the loop works these in order)
- **Phase 0 — API foundation (in brightears-app):** `app/api/mobile/*` Route Handlers (pipeline, hunt feed, pitch draft/approve/send, settings, mailbox, profile) returning JSON; Clerk Bearer verification middleware; extract shared logic out of server actions into `lib/`. Tests for each endpoint. Don't regress the web app.
- **Phase 1 — Expo skeleton:** new repo, Expo app, `@clerk/expo` auth + secure token cache, native tab navigation (Pipeline / Hunt / Settings), talks to the mobile API.
- **Phase 2 — Push:** Expo Push tokens registered + stored per business/device; backend pushes "reply ready" / "venues found" / "reply landed"; tapping deep-links to the relevant approve screen.
- **Phase 3 — Core flows:** native approve / edit / send for both leads (reply) and venue pitches, with the lead/pitch counters and caps shown; copy-handoff for gated channels; offline/empty states.
- **Phase 4 — Gmail connect (gated on CASA):** in-app system-browser OAuth to connect the sending mailbox.
- **Phase 5 — Store prep:** Apple privacy nutrition labels + Google Play Data-safety form (declare Gmail access, push tokens, analytics); avoid Apple Guideline **4.2 "wrapped website" rejection** by being genuinely native (native nav, push, native approve/edit screens, biometric unlock, splash, offline). Screenshots, listing, build via EAS, submit.
- **Phase 6 — OTA channels:** EAS Update channels for JS/asset iteration (native/permission changes still need a store build — design most iteration in the JS layer).

## Founder-gated items (log in MOBILE-PROGRESS.md; start the long-lead ones early)
- **Google OAuth out of testing → brand verification (2–3 days) → CASA Tier 2 (annual, ~$500–$4500, 2–6 months).** This gate exists with or without the app — it's the longest lead time; start it now. Until it clears, ship the app with Gmail-connect gated/waitlisted and lean on copy-handoff.
- Apple Developer Program ($99/yr — identity verification takes days, start early), Google Play ($25 one-time).
- APNs key + Firebase/FCM project; an EAS/Expo account (free tier: 15 iOS + 15 Android builds/mo, OTA to 1,000 MAUs; $19/mo Starter raises limits).

## Note
Most ongoing iteration lives in the JS layer (OTA-updatable). Keep native code/permissions stable to minimize store re-reviews.
