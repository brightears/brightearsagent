# ADR-001: Email provider — Postmark

**Date:** June 10, 2026 · **Status:** accepted (revisit at >10k emails/mo)

## Decision
Postmark for both inbound parse and outbound transactional sending.

## Why
- **Inbound parsing is first-class:** dedicated inbound servers, clean JSON webhook (FromFull/Subject/TextBody/HtmlBody/Headers/MessageID), built-in SpamAssassin headers we can feed into triage, per-address routing for `leads@{slug}.in.brightears.io`.
- **Deliverability reputation is the best in class** — and deliverability IS our product promise ("reply in under 5 minutes" fails silently if replies land in spam). Postmark separates transactional/broadcast message streams to protect reputation.
- **Simple API + excellent docs**; dev tier (100 emails/mo free) covers the entire build phase.
- Mailgun is cheaper at scale and has inbound routes, but its deliverability reputation is more mixed and the API surface is clunkier. At MVP volume (<1k emails/mo) price difference is noise.

## Addendum (June 11, 2026): Cloudflare Email Service evaluated
Founder asked about Cloudflare. Facts as of today: Cloudflare Email Service (sending) entered **public beta April 16, 2026** — REST API + SMTP + Workers bindings, $0.35/1k emails after 3k included on Workers Paid (~$5/mo); inbound handled via Email Routing/Email Workers `email()` handler (GA, free) rather than webhooks. Assessment for us:
- **Capability:** it now covers both halves (send + receive). Inbound would need a small Worker forwarding to our app instead of Postmark's direct webhook — one extra moving part.
- **Deliverability:** the deciding criterion. Beta is two months old, no dedicated-IP option, reputation **unproven over time** — independent commentary says senders for whom inbox placement is revenue-critical should "wait six months and watch the reputation data." Inbox placement IS our product promise; Postmark has a decade of best-in-class record.
- **Stability:** "APIs may change" beta disclaimer — wrong risk for the product's mouth during our launch window.
- **Price:** both are noise at our volumes.
**Decision unchanged: Postmark for launch.** Revisit trigger: Cloudflare Email Service GA + ≥6 months of public reputation data (≈ Q4 2026 quarterly ADR review), especially attractive if our DNS lands on Cloudflare. The provider-agnostic adapter keeps the swap cost to ~an afternoon.

## Consequences
- `POSTMARK_SERVER_TOKEN` env var (founder gate — account creation).
- Webhook endpoint speaks Postmark's inbound JSON shape; the internal `InboundEmail` type isolates us so a later Mailgun/SES swap only touches the webhook adapter.
- Outbound domain (`mail.brightears.io`) DKIM/Return-Path setup happens at Phase 8 (DNS gate); until then Postmark's sandbox/default domain.
