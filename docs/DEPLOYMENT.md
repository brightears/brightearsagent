# Deployment — Bright Ears SaaS

Production infrastructure and the deployed revision were last live-verified on
**2026-08-16**. The sanitized verification record is
`docs/RELEASE-EVIDENCE-2026-08-16.md`. Historical recovery evidence below stays
date-stamped; read the dashboard back again before any future release rather
than assuming this snapshot is still current.

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

The live discovery cron was last recorded in Oregon. The recovery planner
standardises newly rebuilt cron jobs in Singapore; that is an intentional
recovery target, not a claim about current live topology. Adopting the existing
discovery job will therefore report region drift until an operator explicitly
chooses to preserve Oregon or relocate it after review.

## Release path

1. Push a scoped release branch, open a pull request in
   `brightears/brightearsagent`, and let GitHub Actions complete. Do not push a
   release directly to `main`.
2. GitHub Actions uses the exact Node version in `.node-version`, installs with
   `npm ci`, validates Prisma, applies every migration to a fresh Postgres 16
   service, checks migration status, and then runs TypeScript, ESLint, the unit
   suite and a production build. The CI database is disposable and contains no
   production data or secrets.
3. Review the diff and checks, then merge the approved pull request to `main`.
   Render must build with `npm ci && npm run build`, run
   `npm run db:deploy` as its pre-deploy command, and start with `npm start`.
   Never replace the migration step with `prisma db push`.
4. Render checks `/api/health` before considering the release healthy.
5. After the manual recovery smoke test passes, Render auto-deploy must be set
   to **After CI Checks Pass**. Read that setting, the build/pre-deploy commands,
   the branch and the health path back from the dashboard before release.

The 2026-07-30 delivery-state release proved this path in production: CI passed,
Render found 34 migrations, applied
`20260730144500_postmark_delivery_state`, and brought the service live.

The 2026-08-16 release then proved the current path on deployed revision
`9ebc937`: GitHub main workflow run #121 applied all 39 migrations to fresh
Postgres 16 and passed TypeScript, ESLint, 963/963 tests across 95 files and the
production build. Render and GitHub `main` both read back at that revision.

The repository's required and live-read-back Render build command is
`npm ci && npm run build`. The old
`npm install --include=dev && npm run build` command is no longer the recovery
baseline because it can resolve a dependency tree different from the lockfile.
The production dashboard was corrected and read back on 2026-08-16; the
pre-deploy command remains `npm run db:deploy` and the start command remains
`npm start`.

### AI release gate

Unit tests prove deterministic boundaries; they do not prove the current live
model still parses and writes well. Before a model/prompt change or production
release, run the four live suites with the configured OpenRouter key:

```text
RUNS=3 npm run eval:parse
RUNS=3 npm run eval:triage
RUNS=3 npm run eval:drafts
RUNS=3 npm run eval:venue-pitches
```

All four commands fail non-zero when their release floor is missed. Parse
requires at least 90% field accuracy, 100% inquiry classification, 95% event-
date accuracy and no hallucinations. Triage permits no genuine inquiry to be
hidden. Reactive drafts and venue pitches permit no runtime-safety failure;
their small quality tolerance exists only for wording variance. Record the
date, model map, pass counts and any accepted quality miss in the release
handoff. Never turn a red eval green by rerunning until the failure disappears:
fix or explicitly investigate the recurring case first.

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
- `/api/health` is deployed as a readiness check. It returns HTTP 503 when the
  production environment contract is
  invalid, the database cannot be reached, or any of the four `OpsStamp` cron
  **completion** heartbeats is stale. Its public config diagnostics expose only
  environment-variable names, issue codes and a count, never values or full
  internal messages. On 2026-08-16 the live endpoint returned HTTP 200 with a
  zero config-issue count, database reachability and all four cron completion
  heartbeats healthy. The 503 contract is covered deterministically; no real
  production dependency was disabled merely to force an outage probe.
- Each cron route stamps only after an acceptable completion, so a tick that
  starts and then crashes or fails for every tenant cannot look green. On a
  completely fresh database with no completion stamps, each never-completed job
  gets one full schedule interval plus slack from process start. Once any
  completion exists, its earlier timestamp also anchors missing-job grace so a
  process restart cannot repeatedly hide a job that has never completed. After
  grace it reports `missing_completion` and health returns 503.
- UptimeRobot monitor `Bright Ears production health` (ID `803627397`) checks
  `https://brightears.io/api/health` every 5 minutes and emails the account's
  existing alert contact. Its first check was Up at 279 ms on 2026-07-30.
  HTTP status now represents config, database and cron readiness. No unverified
  JSON keyword matcher is assumed, and the monitor's delivery of a real 503 was
  not tested by inducing a production outage. The onboarding test notification
  was accepted, and no public status page is attached.

## Cron authentication

All four live cron commands were read back on 2026-08-16 and match the current
recovery baseline:

- read `CRON_SECRET` from the cron service's masked environment at runtime;
- send it as `Authorization: Bearer ...`, never in the query string;
- fail the Render run on any non-2xx response;
- log only HTTP status and a bounded allowlist of aggregate numeric counters;
  raw response bodies are forbidden because they can contain tenant slugs,
  recipient addresses and provider error details; and
- abort after 330 seconds. Discovery stops tenant work at 240 seconds and the
  routes declare a 300-second budget, so the wrapper has enough headroom to
  receive and judge the server response instead of aborting legitimate work.

`scripts/render-crons.py` is the reproducible source for those wrappers. Read
all four commands back before each future release and correct any drift from
the 330-second form. Never interpolate the secret into a Render command:
command text is visible in the dashboard and deployment history. Cron services
should be linked only to a dedicated environment group containing
`CRON_SECRET`; they do not need the web service's customer or provider secrets.

All-tenant or systemic failures return non-2xx and do not stamp completion;
isolated tenant failures remain reportable without preventing other tenants
from progressing. Concretely, sequences fail when every attempted draft
generation fails, discovery fails when every attempted business scan fails,
weekly reporting fails when every attempted report or every attempted
freshness check fails, and the margin guardrail requires its operations
heartbeat plus a usable reconciliation result. A partial-success response may
stamp only after all attempted work has settled.

The 2026-07-30 rotation also proved the failure path. The 22:30 sequence run
returned 401 because Render's first web-service edit had redeployed without
persisting the replacement value; the wrapper correctly marked the run failed.
After comparing the masked settings, correcting the web value, and redeploying,
the natural 23:00 run returned 200 and finished successfully. Verify the saved
value on both sides after any future rotation rather than treating a deployment
event alone as proof.

### Uncertain venue-pitch sends

The sequence cron also reports any `VenuePitch` left `SENDING` for more than 10
minutes. This is the narrow crash window where Gmail may have accepted the
message but the terminal database write did not land. The alert and cron result
carry the pitch, tenant and venue identifiers for manual recovery; the sweep is
read-only and must never auto-resend.

For each alert, first verify the tenant's Gmail Sent folder and the Render logs.
If delivery is confirmed, record the pitch as `SENT` (including the verified
send time/message ID when available) and the venue as `PITCHED`. Return it to
`APPROVED` only when non-delivery is certain. If delivery remains ambiguous,
leave it `SENDING` and contact the artist rather than risk emailing the venue
twice.

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

## Production environment contract

`lib/production-config.ts` is the executable contract used by `/api/health`.
It validates at request time only: CI and `next build` do not need production
secrets, while a misconfigured production process remains unready.

| Area | Required production variables and constraints |
|---|---|
| Runtime | `DATABASE_URL`; `APP_URL` must be exactly the HTTPS `brightears.io` origin |
| Authentication | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` together, both live-mode |
| AI and discovery | `OPENROUTER_API_KEY`; `SERPER_API_KEY` |
| Gmail OAuth | `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` together; `TOKEN_ENCRYPTION_KEY` exactly 64 hexadecimal characters |
| Transactional mail | `POSTMARK_SERVER_TOKEN`; `OUTBOUND_FROM`; `INBOUND_WEBHOOK_SECRET`; `OPTOUT_SECRET` |
| Billing | live-mode `STRIPE_SECRET_KEY`; endpoint signing secret `STRIPE_WEBHOOK_SECRET` |
| Uploads | all five of `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and HTTPS `R2_PUBLIC_BASE_URL` |
| Push | `VAPID_PUBLIC_KEY`, matching `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` |
| Operations | `CRON_SECRET`; `OPS_ALERT_EMAIL` |

`BETA_PROMO_CODE` is allowed without `BETA_COMP_EMAILS`: that is a safe,
inert promotion until the founder supplies the allowlist. The reverse is
invalid because an invited artist could not receive the promised comp.
`STRIPE_PORTAL_CONFIG`, `VAPID_SUBJECT`, Clerk fallback redirects and model
overrides are optional. `EMAIL_TRANSPORT=dev` and `DISCOVERY_PROVIDER=stub` are
forbidden in production.

Treat coupled secrets as external configuration, not interchangeable strings:

- `INBOUND_WEBHOOK_SECRET` must match Postmark inbound and delivery-webhook
  authentication; `CRON_SECRET` must match the web service and every wrapper.
- `STRIPE_WEBHOOK_SECRET` must belong to the live apex endpoint, and any
  `STRIPE_PORTAL_CONFIG` must resolve in the same Stripe mode.
- Rotating `TOKEN_ENCRYPTION_KEY` invalidates stored Gmail tokens. Rotating
  `OPTOUT_SECRET` invalidates previously issued opt-out links. Rotating VAPID
  keys requires browser push subscriptions to be recreated.
- R2 credentials, bucket, public base URL, DNS and CORS must describe the same
  live storage surface.

## Disaster recovery and environment rebuild

The Render helpers are recovery planners, not a second deployment path. Their
default is an offline dry run; they never load `.env.local`, temporary secret
files or development credentials. They do not create Postgres, DNS records,
provider webhooks or customer data.

1. Restore or provision Postgres first and confirm Point-in-Time Recovery or a
   fresh logical export is available. Create a dedicated masked production
   environment group matching the contract above, plus a separate cron group
   containing **only** `CRON_SECRET`.
2. Review the no-network plans:

   ```text
   python3 scripts/render-deploy.py --env-group-id evg-production
   python3 scripts/render-crons.py --env-group-id evg-cron
   ```

3. Create a temporary, narrowly named Render API key and provide it through a
   secret-capable shell/session rather than command history. Add `--apply` only
   after reviewing the exact owner, repository, branch and environment-group
   IDs. API or validation failures exit non-zero. Existing names, duplicates or
   drift fail closed; `--adopt-existing` may link only an exact, manually
   verified existing service. The planners also refuse existing services with
   direct environment variables; migrate those keys into the reviewed group
   and remove the direct copies first, because direct values can override the
   manifest.
4. New services start with auto-deploy **off**. Verify the environment-group
   links and masked values, attach `brightears.io`, verify DNS/TLS, then trigger
   one manual deploy. Render may queue the service's initial creation deploy
   before the API can link the environment group; treat that run as disposable
   and do not enable traffic until the linked, manually triggered deploy is
   healthy. The web pre-deploy command must be `npm run db:deploy`.
5. The repository and production currently contain 39 applied migrations. On
   2026-08-16 the empty-database CI run and live pre-deploy applied the complete
   chain, including the five additive `20260816...` migrations for contact
   fairness, beta measurement, postal address, feedback controls and global
   suppression. Run `npx prisma migrate status` in the live environment after
   each future deploy and compare the applied list, not just the count.
6. Recreate and read back provider-side state that environment groups cannot
   capture: the Clerk production domain/redirects; Google redirect URI
   `https://brightears.io/api/oauth/google/callback`; Stripe live prices,
   portal and webhook; Postmark inbound domain and authenticated bounce/spam
   webhook; R2 DNS/CORS; the UptimeRobot URL monitor; and Render backup/PITR
   policy.
7. Require a 200 from `/api/health`, confirm its config issue count is zero,
   verify all four cron completions naturally (or via an explicitly approved
   manual run), run `npx tsx scripts/preflight-live.ts` from the live shell, and
   complete the AI release gate. Then enable **After CI Checks Pass**, confirm
   the GitHub check is required, and revoke the temporary Render API key.

### Rollback and forward-fix rule

A Render code rollback does not reverse Prisma migrations. Take or confirm a
recoverable database point before deploying; never use `prisma migrate reset`,
`prisma db push`, or delete an applied migration in production. The five
2026-08-16 migrations are applied, additive and intentionally tolerate the
previous application version, so the normal response to a failed release is to
roll the application back while leaving those schema additions in place, then
ship a corrected forward migration/code change. Restore the database only as a
declared incident operation after identifying the exact recovery point and the
customer writes that would be lost.

## Remaining founder launch gates

- **Controlled comp-beta setup, not a full-price runtime gate:** provide the
  selected tester list for `BETA_COMP_EMAILS` only when those artists are being
  promised the automatic free first month and included in the measured cohort.
  Ordinary full-price checkout does not require this list.
- Before accepting a first paying customer, the founder and qualified privacy
  counsel must review and approve the Privacy Policy, Terms, Cookie Policy,
  DPA and Acceptable Use Policy; set their effective date; and authorise removal
  of the shared "not yet effective" banner. An agent must not do this on its
  own.
- Review, restrict as needed, and sign `docs/HUNT-LIA.md`. At minimum this means
  resolving UK/EU targeting and recipient classification, making the indirect-
  collection notice effective and available from the first outreach message,
  and approving target countries before Hunt sends there.
- Verify the legal documents against the live provider configuration and
  contracts, including Cloudflare R2, OpenRouter/model-provider log retention,
  international-transfer safeguards, company contact/address details and the
  stated retention periods.
- The all-customer hard-stop is implemented in
  `GlobalOutreachSuppression` and consumed at discovery, draft, copy, follow-up
  and send boundaries. Its migration is applied in production and its boundary
  checks were verified for the 2026-08-16 release. Continue the monthly
  retention review and manual privacy-objection intake in
  `docs/PRIVACY-OPERATIONS.md`; global suppression does not replace retention
  operations or a future cross-tenant contact-frequency policy.

The internal privacy procedures are documented in
`docs/PRIVACY-OPERATIONS.md`. They cover access/export, correction, objections,
account closure, database/provider/R2 deletion, backup expiry, identity checks
and incidents. They are deliberately manual because the current product has no
self-serve export/deletion control. The Hunt assessment in `docs/HUNT-LIA.md`
currently concludes **conditional fail / legal approval required**; neither
document makes the public draft policies effective.

Performance video is optional as of 2026-07-31. It is available as an EPK
enhancement but does not affect profile strength, onboarding readiness, weekly
freshness notifications, or pitch readiness. One clear performance photo is
required; three are recommended for a fuller press kit. The founder profile has four live-verified photos,
including an ABar action shot of Norbert DJing, and a confirmed historical gig
(`2025-12-31`, `New Year's Eve DJ`,
`Shore, Hilton Pattaya — Pattaya`).

Render account two-factor authentication was enabled and live-verified on
2026-07-31.

Google OAuth data-access verification for `gmail.send` was submitted on
2026-07-31 and was last known to be under review. The current console state was
not reverified on 2026-08-16 because Google required founder reauthentication;
do not treat arbitrary-user Gmail onboarding as approved until that read-back
is complete. The reviewer video is the unlisted Bright Ears YouTube upload at
`https://youtu.be/RQUNmQg0vRc`.
