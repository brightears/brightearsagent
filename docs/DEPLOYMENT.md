# Deployment — Bright Ears SaaS

Last verified: **2026-07-30**.

`brightears.io` is the production Bright Ears SaaS app. It is separate from the
Vinyl agency service at `agency.brightears.io`; never modify, import from, or
redeploy the sibling `../brightears` or `../brightears26` projects while working
on this app.

## Production infrastructure

All resources are in Render's `My Workspace`, Singapore unless noted.

| Resource | ID | Current configuration |
|---|---|---|
| Web `brightears-app` | `srv-d8l2ni6gvqtc73ag9gsg` | Starter, `main`, health `/api/health`, public at `brightears.io` |
| Postgres `brightears-app-db` | `dpg-d8l2martqb8s73anqjig-a` | Postgres 16, Basic-256mb |
| Cron `brightears-app-sequences` | `crn-d8l2qi3tqb8s73anvbg0` | `*/30 * * * *` |
| Cron `brightears-app-discovery` | `crn-d8lrfh8js32c73b65it0` | `0 5 * * *` |
| Cron `brightears-app-weekly-report` | `crn-d8l2qirtqb8s73anvcf0` | `0 14 * * 1` |
| Cron `brightears-app-margin-guardrail` | `crn-d8l2qjernols73ca22f0` | `0 2 * * *` |

## Release path

1. Push to GitHub `brightears/brightearsagent` `main`.
2. GitHub Actions installs with `npm ci`, then runs TypeScript, ESLint, the unit
   suite, and a production build. CI has a non-secret placeholder
   `DATABASE_URL` so Prisma generation can run without a live database.
3. Render auto-deploy is set to **After CI Checks Pass**.
4. Render runs `npm run db:deploy` as its pre-deploy command, then `npm start`.
   Never replace the migration step with `prisma db push`.
5. Render checks `/api/health` before considering the release healthy.

The 2026-07-30 delivery-state release proved this path in production: CI passed,
Render found 34 migrations, applied
`20260730144500_postmark_delivery_state`, and brought the service live.

Current build command: `npm install --include=dev && npm run build`.

## Backups and monitoring

- Render Point-in-Time Recovery is available for any timestamp in the previous
  **7 days**.
- Render can create a complete logical export; export files are retained for at
  least **7 days**.
- A destructive restore drill has not been run. Do that against a temporary
  database, never the live database.
- Render sends email for service failures. Preview notifications are disabled.
- `/api/health` checks the database and the four `OpsStamp` cron heartbeats.
  A healthy response requires `ok`, `db`, and `cronsHealthy` to be true.
- An independent UptimeRobot monitor has not been verified; the available
  browser session is signed out. Add or confirm an HTTPS monitor for
  `https://brightears.io/api/health` and alert on non-200 responses.

## Cron authentication

All four live cron commands were corrected on 2026-07-30. They now:

- read `CRON_SECRET` from the cron service's masked environment at runtime;
- send it as `Authorization: Bearer ...`, never in the query string;
- fail the Render run on any non-2xx response; and
- abort after 120 seconds so a hung tick cannot appear green.

`scripts/render-crons.py` is the reproducible source for those wrappers. Never
interpolate the secret into a Render command: command text is visible in the
dashboard and deployment history.

## Postmark webhooks

- Inbound lead mail: `POST /api/inbound`
- Delivery failures and complaints: `POST /api/webhooks/postmark`

Both endpoints fail closed in production. They accept a Bearer token, an HTTP
Basic password, or `x-webhook-secret`. The legacy `?secret=` fallback remains
temporarily for compatibility but should not be used in new configuration.

Postmark does not support arbitrary webhook headers. Configure HTTP Basic
authentication in the webhook URL so Postmark emits an Authorization header:

```text
https://postmark:<INBOUND_WEBHOOK_SECRET>@brightears.io/api/webhooks/postmark
```

Subscribe that webhook to **Bounce** and **Spam Complaint** events. The endpoint
is deployed and returns 401 without authentication; dashboard registration and
the provider-side test remain pending until a founder-authenticated Postmark
session is available.

## Secrets requiring founder-approved rotation

- `CRON_SECRET`: the previous live Render commands contained it directly.
- Render deploy hook: it appeared during the private deployment audit.
- Render API key: historical project setup notes say it passed through chat.

Rotate only in a coordinated maintenance pass. Update every consumer before
invalidating the old value, then verify `/api/health` and the next scheduled
cron. Rotating `TOKEN_ENCRYPTION_KEY` is a separate, consequential operation
because it invalidates stored Gmail OAuth tokens.

Git tracks no `.env` files; `.env*` is ignored. Production values belong only in
the relevant provider dashboards or masked Render environment variables.

## Remaining founder launch gates

- Complete the founder profile: two more photos, one performance video, and one
  calendar gig.
- Provide the beta email list for `BETA_COMP_EMAILS`.
- Record and submit the Google OAuth verification video.
- Sign into Postmark so the delivery webhook can be registered and tested.
- Sign into UptimeRobot (or choose another independent monitor) and approve the
  coordinated secret-rotation pass.
