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
0. **CDN + region note (Lighthouse June 11):** marketing pages score perf 78 / best-practices 73 on staging — NOT code (TBT 0ms, CLS 0.007): causes are (a) Clerk dev-instance cookies/console noise → fixed by the production Clerk instance (step 3), and (b) no CDN in front of the Singapore origin → front the real domain with Cloudflare (free plan: edge-caches static pages, fixes LCP for US/UK buyers). Re-run Lighthouse after cutover; expect ≥90s. If still short, consider recreating the web service in Oregon (US buyers) — region can't be changed in place.
1. **Postmark:** click "Request approval" (lifts the @brightears.io-only recipient limit); add DKIM + Return-Path DNS.
2. **Domain + inbound email:** point a domain at the service; set up `in.brightears.io` (MX → Postmark inbound) and `mail.brightears.io` (SPF/DKIM/DMARC); update `APP_URL` and the lead-address domain.
3. **Clerk:** create a Production instance for the real domain; swap to production keys.
4. **Stripe:** register the webhook endpoint (`/api/webhooks/stripe`) in the Stripe dashboard → real `whsec_`, set as `STRIPE_WEBHOOK_SECRET`; re-run `scripts/stripe-setup.ts` in LIVE mode; switch to live keys.
5. **brightears.io cutover** (only if taking over the apex — see ROADMAP Phase 8): move the live agency app to `agency.brightears.io`, re-register its LINE webhook, soak 7 days, THEN switch apex. Vinyl must never lose a day.

## Production env vars (set on the web service)
External keys carried from `.env.local`; **internal secrets regenerated fresh** for prod (`INBOUND_WEBHOOK_SECRET`, `CRON_SECRET`, `OPTOUT_SECRET` — not the dev-* values). `STRIPE_WEBHOOK_SECRET` is a placeholder until step 4. `EMAIL_TRANSPORT` and `DEV_TENANT_SLUG` are intentionally unset (so Postmark sends and Clerk resolves real tenants).

## Security note
The Render API key used for setup was shared in chat — **rotate it** in Render → Account Settings → API Keys once setup is confirmed.

### Internal endpoint auth — use a header, not `?secret=` (audit B4)
The cron pings (`/api/cron/*`) and the Postmark inbound webhook (`/api/inbound`) authenticate with a shared secret. **Send it as a header, not a query param** — a `?secret=` value leaks into Render/Postmark access logs, proxies and browser history. The code accepts (in order): `Authorization: Bearer <secret>`, then `x-webhook-secret`, then the legacy `?secret=` query param (kept only for backward-compat).
- **Render crons:** configure the job to `curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/<name>` instead of putting `?secret=` in the URL (update `scripts/render-crons.py`).
- **Postmark inbound:** set the webhook's custom HTTP header `Authorization: Bearer <INBOUND_WEBHOOK_SECRET>` instead of `?secret=` in the URL.
Until those external configs are switched to the header, the query-param path still works but the secret keeps leaking into logs — switch them at cutover.
