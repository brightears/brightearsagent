# Deployment — Bright Ears SaaS

## Render infrastructure (created June 11, 2026, via API)
All in workspace `tea-d13uhr3uibrs73btc1p0` (My Workspace), region Singapore. **Entirely separate from the live `brightears` agency stack and `brightears26` — those were never touched.**

| Resource | ID | Notes |
|---|---|---|
| Web service `brightears-app` | `srv-d8l2ni6gvqtc73ag9gsg` | starter (always-on), auto-deploys from `github.com/brightears/brightearsagent` `main`. URL: https://brightears-app.onrender.com |
| Postgres `brightears-app-db` | `dpg-d8l2martqb8s73anqjig-a` | basic_256mb, Postgres 16. Internal connection string wired as `DATABASE_URL`. |
| Cron `brightears-app-sequences` | (see dashboard) | `*/30 * * * *` → pings `/api/cron/sequences` |
| Cron `brightears-app-weekly-report` | (see dashboard) | `0 14 * * 1` (Mon 14:00 UTC) → `/api/cron/weekly-report` |
| Cron `brightears-app-margin-guardrail` | (see dashboard) | `0 2 * * *` (daily 02:00 UTC) → `/api/cron/margin-guardrail` |

Build: `npm install --include=dev && npm run build` · Pre-deploy: `npm run db:deploy` (migrations) · Start: `npm start` · Health check: `/pricing`.

Reproduce with `scripts/render-deploy.py` (web) + `scripts/render-crons.py` (crons) — both read gitignored env, take `RENDER_API_KEY` from env.

## This is a STAGING deploy
It runs on the temp `onrender.com` URL with **test/sandbox credentials**: Postmark test mode, Clerk Development instance, Stripe test keys. It proves the app runs on production infra (signup, billing, dashboard). It is NOT yet customer-facing.

## Before launch (Phase 8/9 — the cutover)
1. **Postmark:** click "Request approval" (lifts the @brightears.io-only recipient limit); add DKIM + Return-Path DNS.
2. **Domain + inbound email:** point a domain at the service; set up `in.brightears.io` (MX → Postmark inbound) and `mail.brightears.io` (SPF/DKIM/DMARC); update `APP_URL` and the lead-address domain.
3. **Clerk:** create a Production instance for the real domain; swap to production keys.
4. **Stripe:** register the webhook endpoint (`/api/webhooks/stripe`) in the Stripe dashboard → real `whsec_`, set as `STRIPE_WEBHOOK_SECRET`; re-run `scripts/stripe-setup.ts` in LIVE mode; switch to live keys.
5. **brightears.io cutover** (only if taking over the apex — see ROADMAP Phase 8): move the live agency app to `agency.brightears.io`, re-register its LINE webhook, soak 7 days, THEN switch apex. Vinyl must never lose a day.

## Production env vars (set on the web service)
External keys carried from `.env.local`; **internal secrets regenerated fresh** for prod (`INBOUND_WEBHOOK_SECRET`, `CRON_SECRET`, `OPTOUT_SECRET` — not the dev-* values). `STRIPE_WEBHOOK_SECRET` is a placeholder until step 4. `EMAIL_TRANSPORT` and `DEV_TENANT_SLUG` are intentionally unset (so Postmark sends and Clerk resolves real tenants).

## Security note
The Render API key used for setup was shared in chat — **rotate it** in Render → Account Settings → API Keys once setup is confirmed.
