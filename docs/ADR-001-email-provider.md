# ADR-001: Email provider — Postmark

**Date:** June 10, 2026 · **Status:** accepted (revisit at >10k emails/mo)

## Decision
Postmark for both inbound parse and outbound transactional sending.

## Why
- **Inbound parsing is first-class:** dedicated inbound servers, clean JSON webhook (FromFull/Subject/TextBody/HtmlBody/Headers/MessageID), built-in SpamAssassin headers we can feed into triage, per-address routing for `leads@{slug}.in.brightears.io`.
- **Deliverability reputation is the best in class** — and deliverability IS our product promise ("reply in under 5 minutes" fails silently if replies land in spam). Postmark separates transactional/broadcast message streams to protect reputation.
- **Simple API + excellent docs**; dev tier (100 emails/mo free) covers the entire build phase.
- Mailgun is cheaper at scale and has inbound routes, but its deliverability reputation is more mixed and the API surface is clunkier. At MVP volume (<1k emails/mo) price difference is noise.

## Consequences
- `POSTMARK_SERVER_TOKEN` env var (founder gate — account creation).
- Webhook endpoint speaks Postmark's inbound JSON shape; the internal `InboundEmail` type isolates us so a later Mailgun/SES swap only touches the webhook adapter.
- Outbound domain (`mail.brightears.io`) DKIM/Return-Path setup happens at Phase 8 (DNS gate); until then Postmark's sandbox/default domain.
