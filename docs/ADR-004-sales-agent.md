# ADR-004: The Sales Agent — proactive discovery + outreach

**Status:** Accepted (founder, June 12, 2026) · **Research basis:** docs/RESEARCH-PROACTIVE-AGENT.md (15-agent deep dive, June 12) · **Supersedes nothing** — this ADDS the proactive half; the reactive product (ADR-001..003) stays intact.

## Context

Founder verdict: reactive inquiry-answering alone is "half the circle — nobody will pay just for that." The product becomes a **personal AI sales agent for art freelancers**: it finds work, pitches in the artist's voice, and closes through the existing pipeline. His 20-year agency experience: by the time a clean "inquiry" lands in an inbox, much of the market has already moved — and the best gigs often come from venues that never posted anything.

## Decision 1 — Identity: sales agent, not assistant

The product is **"your AI sales agent"** — it goes out and gets work. Primary v1 customer: **newcomers and working artists worldwide who burn hours hunting opportunities**, not marketplace power-users. Marketplace alert integration remains supported (it's free demand intake) but is not the identity or the marketing lead.

## Decision 2 — Two demand engines

1. **Posted-demand speed** (the early-win engine): watch places where clients publicly ask for performers and be first to respond. Alerts-first architecture — marketplace/Craigslist alert emails land in the tenant's existing Bright Ears address and ride the existing parser. Free channels prioritized (newcomer-friendly); paid-marketplace alerts supported for those who have memberships.
2. **Venue prospecting** (the differentiator; founder's addition): detect venues that *will* or *should* need performers even though nobody posted —
   - **New openings:** local news/press ("rooftop bar opening"), brand-new Google Maps listings, venue hiring posts (staffing up = opening soon), new venue social accounts, liquor-license filings (public records).
   - **Operating venues:** bars/hotels/restaurants that match the artist's act, location, fee level — found via public business data.
   - Outreach goes to the venue's **published booking/events contact** with a tailored pitch + the artist's hosted press kit (EPK). This is what a human booking agent does all day; it also defeats the Sonicbids junk-gig dynamic — the artist is the only pitch in the GM's inbox, not applicant #30 on a board.

## Decision 3 — Channel classes (enforced in code, not prompts)

| Class | Examples | Behavior |
|---|---|---|
| Auto-eligible | Artist's own mailbox → alert-sourced posters, venue published contacts | Draft → approve → send. Per-channel autopilot earnable after a streak of unedited approvals; anything that spends money never auto-fires |
| Approve-gated | Marketplace on-platform inboxes (GigSalad, The Bash) | Agent drafts; human taps send in the platform's own UI via deep link. No server-side session automation, ever |
| Handoff-only | Facebook groups, **LinkedIn**, Instagram, Nextdoor | Agent finds lawfully (public/logged-out data or the artist's own notification emails), pings artist with link + uniquely-generated reply + Copy button: "gated for agents — you take over." LinkedIn is find-only: identify the GM/entertainment manager from public business data; profile link goes on the handoff card. Never automate LinkedIn (2025–26 ban wave killed every vendor that did) |

## Decision 4 — Outreach infrastructure & safety rails

- **Sends from the artist's own Gmail/Microsoft mailbox** via OAuth (a required onboarding step, designed as an easy guided flow). Never from Postmark/shared infrastructure — one artist's cold pitches must never endanger the reactive product's deliverability (Postmark ToS requires permission-based mail).
- **Hard caps:** 10–20 outbound/day per artist, business-hours recipient-local sends, master suppression list, cross-channel dedup (one bride in two places = one coherent touch), repliers exit sequences instantly, same-day kill on any cease-and-desist.
- **Jurisdiction rules engine** (extends the existing per-country compliance footers): cold B2B email is jurisdiction-dependent — US/UK/TH standard mode (identity + opt-out), **Canada consent-mode** (CASL: soft/handoff outreach only), **Germany strict-mode**, etc. Rules keyed on the *recipient's* country. Quality gatekeeper both directions: junk-gig filter on inbound opportunities; fit filter (act/geo/fee-floor) on outbound prospects.
- **Global + multilingual from day one:** pitches drafted in the recipient's language with culturally tuned templates; product sold worldwide (Thai entity, Stripe). Channel depth is strongest in English markets at first; venue prospecting is inherently global.

## Decision 5 — Pricing posture

Agent **folded into the subscription** — no credit packs, no token charges (Bark's expiring credits are this niche's trauma; opaque AI-credit burn is the category's most-hated mechanic). Cadence is the tier lever: **daily scans on the base tier, ~every-3-hours on the premium tier. No 24/7 scanning is sold** (margin death at ~$280/mo cost). Fair-use caps per tier (cities scanned, venue pitches/mo) protect margin and spam-safety — caps, not charges. Exact tier mapping decided later with the pricing pass. Door open for *future* paid add-on agent services; explicitly not now. Success fees remain banned (ADR-003).

## Decision 6 — Vertical sequencing

Schema stays freelancer-generic (already polymorphic). Go-to-market sequenced: **performing artists v1 → photographers/videographers next** (same wedding/event/venue demand graph) → others later. **Casting verticals (actors/models) deferred indefinitely** — closed, agency-dominated ecosystem; different product. Site copy de-DJ-fication happens in a later cleanup pass (founder-confirmed).

## Decision 7 — Remote control plane

**Telegram first** (free, button-rich) **+ WhatsApp** (utility-template digest; scoped business assistant — general-purpose AI bots are banned on WhatsApp since Jan 2026, booking-scoped is permitted); existing web push as universal fallback. Approve/Edit/Skip buttons on every actionable message; Edit deep-links into the PWA. **LINE deferred** until a Thai-market product exists (no verified accounts for US-facing services; Thailand/Japan only relevance — founder-confirmed). iMessage: watch (first agent approved on Messages for Business June 2026).

## Gate before the full build

**City probe** (run by us, no founder ops needed): measure 7-day fitting-opportunity volume for a representative mobile-DJ/performer profile in 2–3 metros — posted demand on free channels + venue-prospecting signals. Healthy (≥~10 fitting fresh opportunities/wk/metro combined) → full Phase 10 build. Thin → narrow the promise to marketplace-speed + venue-led outreach and re-scope. Secondary beta gates: ≥30% of beta artists get ≥1 real conversation from an agent-found opportunity within 14 days; north star = % with an agent-sourced booking inside 90 days.

## Non-goals (fence)

LinkedIn automation · Reddit commercial API (~$12k/mo) · server-side logins / credential custody / browser farms · auto-posting to social · chrome extension (v1; ban-risk reports — revisit later) · Thumbtack partner program (parked: US-marketplace-centric, off-identity for newcomers) · 24/7 scanning tier · credit/token pricing · success fees · casting verticals.

## Rejected alternatives

- **Credit-pool pricing** — rejected for trauma + opacity (research: most-complained-about mechanic).
- **Scrape-everything architecture** — rejected for cost, fragility, legal surface; alerts-first + sanctioned feeds + rented per-result scrapers for the long tail.
- **Marketplace-incumbent positioning** ("works the channels you already pay for") — demoted with the newcomer decision; remains a supported capability and a secondary pitch.
