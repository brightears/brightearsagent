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
| Cron `brightears-app-discovery` | `crn-d8lrfh8js32c73b65it0` | `0 5 * * *`; Oregon |
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
- A Point-in-Time Recovery drill completed on 2026-07-30. Render restored the
  22:08:06 GMT+7 recovery point into an isolated Postgres 16 Basic-256mb
  database in Singapore. A read-only verification found all 34 completed
  migrations plus the expected non-empty `Business`, `Lead`, and `Message`
  tables. The temporary database and its one-IP access rule were deleted after
  verification; the live database was never modified.
- Render sends email for service failures. Preview notifications are disabled.
- `/api/health` checks the database and the four `OpsStamp` cron heartbeats.
  A healthy response requires `ok`, `db`, and `cronsHealthy` to be true.
- UptimeRobot monitor `Bright Ears production health` (ID `803627397`) checks
  `https://brightears.io/api/health` every 5 minutes and emails the account's
  existing alert contact. Its first check was Up at 279 ms on 2026-07-30.
  The onboarding test notification was accepted, and no public status page is
  attached.

## Cron authentication

All four live cron commands were corrected on 2026-07-30. They now:

- read `CRON_SECRET` from the cron service's masked environment at runtime;
- send it as `Authorization: Bearer ...`, never in the query string;
- fail the Render run on any non-2xx response; and
- abort after 120 seconds so a hung tick cannot appear green.

`scripts/render-crons.py` is the reproducible source for those wrappers. Never
interpolate the secret into a Render command: command text is visible in the
dashboard and deployment history.

The 2026-07-30 rotation also proved the failure path. The 22:30 sequence run
returned 401 because Render's first web-service edit had redeployed without
persisting the replacement value; the wrapper correctly marked the run failed.
After comparing the masked settings, correcting the web value, and redeploying,
the natural 23:00 run returned 200 and finished successfully. Verify the saved
value on both sides after any future rotation rather than treating a deployment
event alone as proof.

## Postmark webhooks

- Inbound lead mail: `POST /api/inbound`
- Delivery failures and complaints: `POST /api/webhooks/postmark`

Both endpoints fail closed in production. They accept a Bearer token, an HTTP
Basic password, or `x-webhook-secret`. The legacy `?secret=` fallback remains
temporarily for compatibility but should not be used in new configuration.

Postmark does not support arbitrary webhook headers. Configure its HTTP Basic
authentication fields while keeping the endpoint URL free of credentials:

```text
URL:      https://brightears.io/api/webhooks/postmark
Username: postmark
Password: <INBOUND_WEBHOOK_SECRET>
```

Outbound webhook ID `25313522` is subscribed to **Bounce** and **Spam
Complaint** only, with content inclusion disabled. Provider read-back confirmed
both triggers and HTTP Basic authentication on 2026-07-30. Authenticated
production probes for an unknown bounce ID and complaint ID both returned 200;
the endpoint still returns 401 without authentication.

## Credential rotation record

The founder-approved Render rotation completed on 2026-07-30:

- `CRON_SECRET` was regenerated and applied to the web service and all four
  cron jobs. The dashboard values were compared after deployment and
  `/api/health` remained green; the 23:00 scheduled sequence run returned 200
  and completed normally.
- The private Render deploy hook was regenerated and the dashboard confirmed
  that its value changed.
- The dormant `Bright Ears Agent` Render API key was revoked. No replacement
  was created or stored; create a narrowly named key only when a manual Render
  API operation is required.

Rotating `TOKEN_ENCRYPTION_KEY` remains a separate, consequential operation
because it invalidates stored Gmail OAuth tokens.

Git tracks no `.env` files; `.env*` is ignored. Production values belong only in
the relevant provider dashboards or masked Render environment variables.

## Remaining founder launch gates

- Complete the founder profile: two more photos, one performance video, and one
  calendar gig.
- Provide the beta email list for `BETA_COMP_EMAILS`.
- Review, upload, and submit the prepared Google OAuth verification video.

Render account two-factor authentication was enabled and live-verified on
2026-07-31.
