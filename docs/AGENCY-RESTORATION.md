# Bright Ears agency restoration — 9 September 2026

The founder authorized restoring brightears.io to an appealing DJ agency website after the assistant beta produced no feedback. Trialists were mainly resident/club DJs. This is not evidence that nobody used the app or that all accounts are inactive.

## Public product

The homepage presents DJs and music programming for hotels, restaurants and events in Bangkok. It uses the authentic Bright Ears logo, existing public photographs of UFO, RabbitDisco and Benji, and English/Thai copy. Venue experience names come from the founder's current account relationships; they do not imply a group-wide endorsement.

The sound guide helps visitors describe the atmosphere they want. The music brief builder prepares a plain-text inquiry locally: the visitor copies it or opens their email app addressed to info@brightears.io. Nothing is sent automatically or stored by a new backend. This is an inquiry, not a confirmed booking or price. Artist links prefill the chosen name. LINE remains an alternative contact route.

Beat Breeze by BMAsia Music is linked as the existing service for background music and zone scheduling. No new unvalidated subscription product is being sold.

## Existing assistant continuity

- `/assistant` explains existing account access. Public pricing, comparisons, roadmap and free tools redirect there. The public demo returns 410 and cached lead-magnet submissions no longer write to the database.
- `ASSISTANT_ENROLLMENT_OPEN = false` blocks new tenant provisioning, including historical beta invitations, and new Stripe subscriptions. Existing member lookup and verified-email adoption remain available.
- Existing subscribers keep their billing portal and plan controls. Existing beta windows retain their original end dates. No accounts, entitlements, subscriptions or production data were deleted, canceled or reset by this change.
- Existing dashboards, EPKs, integrations, inbound/webhook routes and all four crons remain in place. These retained services may still incur costs; this release is not infrastructure retirement.
- `agency.brightears.io`, Vinyl, its database and existing portal redirects are unchanged.

## Release scope and verification

The release starts from main `29425de71f770822b47c7019c977ecb55252b4d4` and uses the existing Render `brightears-app` service, not a new hosting provider. Preserve DNS, APP_URL, production credentials, migration deployment and health checks. Use a scoped PR and passing CI before merging.

Local validation: 1,019 tests across 101 files passed, TypeScript and ESLint passed, and the production webpack build passed using a dummy local database URL. Tests cover closed enrollment, existing tenant adoption, closed checkout, demo retirement and mailto encoding. CI additionally checks tutorial tooling and clean-database migrations.

No model, prompt, AI engine, schema, migration or dependency changes are part of this release. Live provider quality evaluations are not rerun for this presentation/enrollment change; previous AI results are historical, not fresh release evidence. The AI evaluation gate still applies before changes to those retained model-dependent paths. Browser visual QA has not been performed; source and build validation are recorded without claiming screenshot verification.

Rollback uses the preceding main revision. Database restoration is not part of rollback because this release adds no schema migration or production data change. Do not turn new enrollment back on merely to restore public copy.

Local HTTP smoke: homepage, account-access page, liveness and roster asset returned 200; retired marketing routes redirected to `/assistant`; `/venue-portal` retained its redirect to the separate agency host; public demo returned 410. Protected local onboarding returned the expected missing-auth-configuration 503 with dummy credentials and must be checked on the configured deployment.

Render settings read back before release on 2026-09-09: branch main, After CI Checks Pass, build `npm ci && npm run build`, pre-deploy `npm run db:deploy`, start `npm start`, process check `/api/live`. The previous live revision is `29425de71f770822b47c7019c977ecb55252b4d4`. No settings were changed.
