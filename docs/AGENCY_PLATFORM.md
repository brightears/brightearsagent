# Bright Ears agency platform

The apex site presents the agency, its published roster and a free search tool.
The operations app at agency.brightears.io remains the owner of DJ profiles,
venue assignments, venue/DJ portal access and Vinyl's existing LINE integration.
Public profiles are projected to public fields before reaching browser code.

## Search access and costs

Anyone may create a Clerk account to search after verifying their primary email.
This does not create a Business or Artist record or grant agency portal access.
Each fresh search makes at most two Serper requests. PostgreSQL transactions
reserve the calls before execution: 20 per user/day, 200 globally/day and 2,000
globally/month. Failed provider requests retain their reserved allowance.
Cached results do not consume calls and retain their original retrieval date.
Search returns source links and snippets; it never extracts contacts, drafts a
message, sends email, or subscribes anyone to background scanning.

Migration 20260909100000_agency_search adds only the cache and allowance tables.
CI verifies concurrency and allowance boundaries against an isolated database.

## Retired assistant

`lib/assistant-runtime.ts` is the code-owned retirement boundary. The old email,
Gmail token-refresh, LLM, discovery and sequence entry points refuse execution.
Authenticated legacy crons acknowledge retirement without performing work. The
readiness endpoint no longer expects their completion stamps. Re-enabling this
runtime requires an explicit product decision and a reviewed source change.

Saved assistant records, billing management, Stripe webhooks, opt-outs and stored
EPKs remain available. New paid checkout and plan changes are blocked.
`app/api/line/push/route.ts` remains active: it is Vinyl's agency relay and must
not be removed as part of assistant retirement.

After the retired readiness response is verified in production, the sequences,
discovery, weekly-report and margin-guardrail Render cron services can be retired.
Retain the web services, databases, LINE, and Vinyl. Do not delete a shared
provider account or stored documents when removing assistant credentials.

## Finance documents

Withholding certificates are not exposed by this site. Before enabling downloads,
verify Vinyl's authoritative document index and bind each document to the
original agency DJ account. Editable artist contact fields and public Drive
links are not an authorization boundary.
