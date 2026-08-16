# Release evidence — 2026-08-16

This is a sanitized evidence snapshot for the currently deployed Bright Ears
release. It records what was verified and distinguishes current production
from inherited historical evidence. It is **not** approval to accept a first
paying customer and
does not replace the controlled beta, founder or legal gates in `ROADMAP.md` and
`docs/DEPLOYMENT.md`.

## Deployed artifact and CI

| Evidence | Verified result |
|---|---|
| Production revision | PR #5 was squash-merged; GitHub `main` and Render were both at `246b411ea35ab9086fe0e548e82fa031fe4d6f1b`. |
| GitHub Actions | Main workflow **#123** (run `31953952713`, job `95181584951`) succeeded in **2m01s**. Its disposable Postgres 16 service applied all **39** migrations before TypeScript, ESLint, Vitest and the production build. |
| Deployed test count | Run #123 passed **989/989 tests across 95 files**. This count is attached to `246b411` and the deployed release. |
| Render | Deployment completed in **2m41s** and reported **Live** at the full revision above. |
| Production dependency audit | `npm audit --omit=dev` reported **0 production vulnerabilities**. |

## Production runtime and recovery

- A production-shell request to the live readiness endpoint returned HTTP
  **200** with `ok`, `db`, `config`, `clerkConfigured` and `cronsHealthy` all
  true. All four cron states were fresh.
- Production and the repository both had **39 applied migrations**. The fresh
  Postgres 16 CI run independently exercised that complete migration chain.
- Dashboard read-back confirmed that all four cron wrappers use the masked
  `CRON_SECRET` at runtime, Bearer authentication, non-2xx failure handling,
  bounded aggregate logging, and a **330-second** wrapper timeout. No command
  exposes the secret in its URL.
- The recovery evidence remains the 2026-07-30 isolated Point-in-Time Recovery
  drill: a historical 34-migration recovery point was restored read-only,
  checked for non-empty core tables, and deleted without touching production.
  Render documents a seven-day PITR window and retains complete logical exports
  for at least seven days. The 34 count describes that historical recovery
  point; it is not the current production count.
- The documented mail preflight remains green: wildcard inbound MX, aligned
  SPF and DKIM for outbound mail, and mail-tester scores of 10/10 for both the
  first-reply and follow-up shapes. `npx tsx scripts/preflight-live.ts` remains
  the standing read-only live check. These deliverability results were recorded
  on 2026-07-30 and are not presented as a new 2026-08-16 send test.

## Production inbound canary

One real Postmark inbound traversed the authenticated production webhook,
parser and triage path and produced exactly one synthetic Lead, its one INBOUND
Message and one PENDING Draft. Approval was not invoked, and there was **zero
client-facing outbound Message or send**. An exact lead-ID-guarded cleanup
deleted those three records. Final read-back found zero rows containing the
unique marker, and the founder STARTER usage/cap returned to its pre-canary
count.

The canary reused the existing founder tenant and inbound path. It did not
create or change a tenant, Business, User, inbound alias/configuration or
provider webhook, so none of those required cleanup. One founder notification
email or push may have been emitted as the expected harmless side effect of a
new pending draft.

## Live AI release gate collected on `fd8f292`

Each suite ran with `RUNS=3` against the configured live provider path:

```text
RUNS=3 MODELS=deepseek/deepseek-v4-flash npm run eval:parse
RUNS=3 npm run eval:triage
RUNS=3 npm run eval:drafts
RUNS=3 npm run eval:venue-pitches
```

| Suite | Result |
|---|---|
| Parse, Flash model | **129/129** checks passed. |
| Triage | **12/12** genuine inquiries remained visible and **6/6** spam cases were filtered, with no provider failures. |
| Reactive drafts | **57/57** passed with zero runtime-safety failures. |
| Venue pitches | **21/21** passed with zero runtime-safety or quality failures. |

These results demonstrate the live model/prompt release floor collected on
`fd8f292`, a direct ancestor of current production `246b411`. Changes since the
evaluated revision were limited to deterministic contact discovery, confidence,
reporting, documentation and their tests; model and prompt paths did not
change. The provider suites were not rerun after `fd8f292`, so this is inherited
evidence rather than a fresh `246b411` live eval. It does not demonstrate artist
satisfaction, venue conversion or beta retention.

## Public-site verification

- Lighthouse accessibility scored **100** on both mobile and desktop.
- The homepage primary CTA measured **5.33:1** contrast; the contrast audit
  passed.
- The homepage process steps expose valid ordered-list semantics, with list
  items directly owned by the ordered list.
- Protected marketing links do not prefetch onboarding or dashboard routes;
  the verification run observed no protected-route prefetch request or related
  Clerk cross-origin console error.
- Canonical and `og:url` values agree on the homepage and pricing page.
- Post-deploy smoke checks for `/`, `/pricing`, `/compare` and `/story` were
  clean, and protected routes produced the expected Clerk redirects.

## Contact discovery evidence and remaining quality gate

The deployed read-only `quality:hunt` run for `norbert` covered one tenant over
the rolling 30-day window. Of **53** attempted venues, **10 were published
(19%)**, including **4 persisted actionable (8%)** and **6 generic**. Latest
attempt outcomes were 4 direct, 6 generic and 43 not found yet, with zero
exhausted, error, in-progress or suppressed outcomes. Attempt coverage remains
unavailable because no historical eligible-at-start denominator was stored.

The scorecard measures the funnel over distinct tenant venues with
`contactLastAttemptAt` inside the reporting window, rather than dividing by all
recently created venues. It separates current stored-contact inventory
(published, persisted actionable, generic and suppressed) from mutually
exclusive latest-attempt states (direct, generic, retryable-not-found,
exhausted-not-found, error, in-progress, suppressed and unclassified), so a
retained email does not disappear while a retry is in progress or errors.
The former 60% actionable-contact
threshold is absent from gates and operational alerts: a terminal-only
denominator would mature successes earlier than retries and bias the reported
rate. Published and actionable yield are descriptive fractions of all distinct
in-window attempted venues and carry no verdict. None of these changes turns
the contact sample into artist-conversion or beta evidence.

The same production read-back found zero reviewed matches, pitches, replies or
bookings. The 14-day human-beta gate was **LEARNING at 0/10**. These zeroes are
an empty evidence cohort, not a negative conversion result.

## Explicitly open gates

- The controlled human beta has not validated the 14-day response/conversion
  target or first-customer experience.
- Google OAuth data-access verification remains open. It was submitted on
  2026-07-31 and was last known to be under review, but the current console
  state still requires founder reauthentication and read-back. Arbitrary-user
  Gmail onboarding must not be described as approved or verified yet.
- Public legal pages and the internal Hunt LIA remain drafts, are not effective,
  and still require founder and qualified-counsel approval.
- The founder profile still has no real `postalAddress`. The field and migration
  are live, but every launching artist—including the founder—must supply their
  own real business mailing address; no value may be inferred.
- Real-world contact yield remains descriptive, and the scorecard still has no
  reviewed matches, pitches, replies or bookings from which to validate the
  first-customer experience.
