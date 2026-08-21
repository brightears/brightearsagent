# Controlled beta testers

Bright Ears beta access is an invitation entitlement, not a discounted Stripe subscription.

## Tester journey

1. The founder confirms the tester and adds their exact email to the production `BETA_COMP_EMAILS` value before the tester first visits `/onboarding`.
2. The tester opens `https://brightears.io/onboarding` and authenticates through Clerk. For Gmail addresses, **Continue with Google** is the shortest path. Email/password remains available, but the tester creates and controls their own password; Bright Ears never creates, sees or sends it.
3. Clerk verifies the primary email. Only an exact allowlist match receives the beta when the tenant is first provisioned.
4. Bright Ears activates the Starter experience for exactly 30 days. No Stripe customer, Checkout session, payment method or subscription is created.
5. At the end timestamp, all agent work gates pause immediately. The profile, leads, drafts, venues and results remain saved. Only the tester can start a paid subscription.

The authenticated onboarding finale and Plan & billing section show the end date and state clearly that the beta does not renew. Public marketing remains subscribe-to-activate and does not advertise a generic free trial.

## Operational rules

- Keep `BETA_COMP_EMAILS` only in Render environment configuration. Never commit tester emails.
- Use comma-separated full addresses. Matching is exact, case-insensitive and based on Clerk's verified primary email—not a URL parameter or form value.
- Add the address before first tenant provisioning. The allowlist does not retroactively rewrite an already-provisioned ordinary account.
- A tester cannot restart the beta by deleting/recreating their Clerk identity: verified-email membership adoption returns the original business and timestamps.
- Removing an address from the environment after provisioning does not revoke or restart its already-written window.
- Do not create or share passwords on a tester's behalf.
- Do not send invitation mail or act as the tester without separate action-time approval.

## Verification

Before each invite:

```bash
npm test -- --run tests/beta-entitlement.test.ts tests/tenant-adoption.test.ts tests/metering.test.ts tests/billing-checkout.test.ts
npx tsc --noEmit
```

After changing production configuration, confirm `/api/health` is healthy and the Render deployment for the intended Git commit is Live. The beta start timestamp is written only when the tester completes their first authenticated `/onboarding` request.
