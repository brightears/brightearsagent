# Deferred review findings (June 10, 2026)

The high-effort code review's correctness + security findings were all fixed (commit 4d060c1).
These lower-severity items were consciously deferred — track and address opportunistically.

## Cleanup (do during a `/simplify` pass, not blocking)
- **Duplicated money/price formatting** across `lib/agent/voice.ts` (`money`/`priceRange`), `app/dashboard/packages/page.tsx`, and `lib/marketing/comparisons.ts`. Extract `lib/format.ts` (`formatMoney(cents, currency)`, `formatPriceRange`). Matters when multi-currency lands.
- **Duplicated `fmtDate`/`fmtEventDate`** across dashboard pages — and the kanban copy drops the `timeZone` option the lead-detail copy carries. Extract one `fmtEventDate(d, tz)`.
- **demo-widget.tsx vs tool-reply-generator.tsx** near-identical POST /api/demo-reply logic; the tool copy lacks the 429 special-case. Extract a shared `requestDemoReply()` helper.
- **`try { approveDraft } catch (static generation store)`** pasted 4× across scripts — extract a `scripts/` helper.
- **Lead status labels** duplicated between `app/dashboard/page.tsx` COLUMNS and `leads/[id]/page.tsx` STATUS_META. One shared `LEAD_STATUS_LABELS`.
- **cents→dollars Package mapping** duplicated in onboarding + packages pages. Extract `toPackageFormValues(pkg)`.

## Efficiency (revisit at scale)
- **computeMargins N+1**: one `groupBy` per business in a loop. Replace with a single `groupBy(by: [businessId, model])` bucketed in memory. Trips the margin cron timeout as tenant count grows.
- **Dashboard fetches full Lead rows** (incl. multi-KB `rawBody`) for cards that show name/date only. Add `select`; replace the sequential `spamCount` query with a parallel `groupBy`.

## Altitude (consider when touching these areas)
- **normalizeStatement** regex-patches an LLM self-report that's mostly overwritten anyway. Cleaner: drop `availabilityStatement` from the schema/prompt, compute the label with a pure `classifyAvailability(state, body)`. Saves tokens on every draft; removes the "inconclusive case inherits a 25%-wrong label" gap. (Current code is correct — the derivation now wins in all known-state branches — but the enum field is vestigial.)
- **Single outbound choke point**: compliance footer + opt-out check are split across `approveDraft` and the cron engine. When the Pro per-source auto-send path lands, route ALL sends through one `sendLeadEmail(lead, draft)` that owns the opt-out refusal + footer, so no send path can bypass compliance.

## Parser refinement (needs real fixtures — already in ROADMAP Phase 1 follow-up)
- **theknot extractEmail fallback** can grab the vendor's own footer address when no labeled Email: line exists. Tighten once a real The Knot notification email is captured.

## Display
- **UTC+13/+14 timezones** (Pacific/Auckland): noon-UTC-stored dates can render one day off in the dashboard. Store-and-display convention is internally consistent (availability engine slices UTC too), but a tenant in NZ sees a date that differs from a US-server-rendered view. Low priority; revisit if an NZ/Pacific tenant signs up.
